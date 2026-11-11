/**
 * Cinematic videos: prompt templating, script-length rules, job state
 * transitions and the pipeline itself against a mock Higgsfield (no credits
 * are spent). Run with `npm run test:cinematic`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { SETTINGS, clipSeconds, countWords, customSetting, maxWordsFor, nextStatus, priceFrom, resolveSetting, stillPrompt, validateScript, videoPrompt } from "@/lib/cinematic/core";

// ── Prompt templating ──

test("still prompt fills wardrobe, setting and lighting, and keeps the camera language", () => {
  const office = resolveSetting("corner-office")!;
  const p = stillPrompt({ wardrobe: "navy blazer and white open-collar shirt", setting: office });
  assert.match(p, /^Cinematic film still, ultra-photorealistic\. The exact same person from the reference photo/);
  assert.match(p, /wearing navy blazer and white open-collar shirt, standing in a high-floor executive corner office at dusk/);
  assert.match(p, /teal-and-amber color grade\. Natural skin texture/);
  assert.match(p, /ARRI Alexa with a 50mm anamorphic lens at T2/);
  assert.match(p, /mouth closed\.$/);
  assert.ok(!/[{}]/.test(p), "no unfilled placeholders");
});

test("video prompt quotes the script, names the setting and voice, and asks for no music or captions", () => {
  const p = videoPrompt({ setting: resolveSetting("corner-office")!, voice: "confident, warm American male voice", script: 'We help you   book "real" meetings.' });
  assert.match(p, /The person in the corner office looks into the lens/);
  assert.match(p, /speaks in a natural, confident, warm American male voice with realistic lip sync/);
  assert.match(p, /They say: "We help you book ”real” meetings\." Very slow, subtle dolly-in/);
  assert.match(p, /City lights twinkle softly in the background bokeh\. Quiet room tone, no music, no captions\.$/);
});

test("every preset has all four parts and a unique id", () => {
  assert.ok(SETTINGS.length >= 7);
  assert.equal(new Set(SETTINGS.map((s) => s.id)).size, SETTINGS.length);
  for (const s of SETTINGS) for (const k of ["name", "description", "lighting", "short", "backgroundMotion"] as const) assert.ok(s[k].length > 3, `${s.id}.${k}`);
});

test("a custom setting gets the lighting and grade language added", () => {
  const s = customSetting("a vineyard terrace at sunset.");
  assert.match(s.description, /^standing in a vineyard terrace at sunset\. /);
  assert.match(s.lighting, /cinematic color grade/);
  assert.equal(resolveSetting("custom", "short"), null);
  assert.equal(resolveSetting("nope"), null);
});

// ── Script length ──

test("32 words fit a 15-second clip, 33 don't", () => {
  assert.equal(maxWordsFor(15), 32);
  const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
  assert.equal(validateScript(words(32), 15).ok, true);
  const over = validateScript(words(33), 15);
  assert.equal(over.ok, false);
  assert.match((over as { error: string }).error, /33 words\. Keep it to 32 or fewer/);
  assert.equal(validateScript("Too short.", 15).ok, false);
});

test("word count ignores extra whitespace; clip length leaves room to finish", () => {
  assert.equal(countWords("  one   two\nthree  "), 3);
  assert.equal(clipSeconds(13, 4, 30), 8); // 5.2s of speech + headroom
  assert.equal(clipSeconds(2, 4, 30), 4); // never under the model's minimum
  assert.equal(clipSeconds(200, 4, 30), 30); // never over its maximum
});

test("cost comes from a figure or from a per-second rate", () => {
  assert.equal(priceFrom({ usd: "0.09" }, {}), 0.09);
  const rates = { pricing_description: "Standard self-serve rates in USD per video second: 480p: $0.1177; 720p: $0.2647; 1080p: $0.6518. Total price = selected rate × output duration in seconds." };
  assert.equal(priceFrom(rates, { resolution: "720p", duration: 8 }), 2.118);
  assert.equal(priceFrom(rates, { resolution: "1080p", duration: 15 }), 9.777);
  assert.equal(priceFrom(rates, { resolution: "4k", duration: 15 }), null);
  assert.equal(priceFrom({}, { resolution: "720p", duration: 8 }), null);
});

// ── State transitions ──

test("the happy path, and what isn't allowed", () => {
  assert.equal(nextStatus("uploading", "uploaded"), "scene");
  assert.equal(nextStatus("scene", "still_ready"), "approval");
  assert.equal(nextStatus("approval", "approve"), "filming");
  assert.equal(nextStatus("approval", "regenerate"), "scene");
  assert.equal(nextStatus("filming", "video_ready"), "ready");
  // The video can't start before the still is approved, and a finished video doesn't move.
  assert.equal(nextStatus("scene", "approve"), null);
  assert.equal(nextStatus("uploading", "approve"), null);
  assert.equal(nextStatus("ready", "approve"), null);
  assert.equal(nextStatus("filming", "regenerate"), null);
});

test("a retry resumes at the step that failed", () => {
  assert.equal(nextStatus("scene", "fail"), "failed");
  assert.equal(nextStatus("failed", "retry", "scene"), "scene");
  assert.equal(nextStatus("failed", "retry", "filming"), "filming");
  assert.equal(nextStatus("failed", "approve"), null);
});

// ── The pipeline against a mock Higgsfield ──

type Mode = "ok" | "plan" | "moderate_still" | "flaky_submit" | "fail_video";
const mock = { mode: "ok" as Mode, submits: [] as { path: string; key: string; body: Record<string, unknown> }[], keys: new Map<string, string>(), flaked: false, polls: new Map<string, number>() };
let server: http.Server;
let dir: string;
let base: string;
let pipeline: typeof import("@/lib/cinematic/server");
let storage: typeof import("@/lib/storage/objects");
let media: typeof import("@/lib/storage/media");
const user = { id: "utest0000000000000a", email: "advisor@example.com", name: "Test Advisor", createdAt: "" } as never;

before(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "renom-cine-test-"));
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string;
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=navy:size=360x640:rate=24:duration=1", "-f", "lavfi", "-i", "sine=frequency=300:duration=1", "-shortest", "-pix_fmt", "yuv420p", path.join(dir, "v.mp4")]);
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:size=360x640", "-frames:v", "1", path.join(dir, "s.jpg")]);
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const send = (o: unknown, code = 200) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
      const url = req.url ?? "";
      if (url === "/files/generate-upload-url") return send({ public_url: `${base}/pub/in.jpg`, upload_url: `${base}/put/in.jpg`, upload_headers: { "Content-Type": "image/jpeg" } });
      if (url.startsWith("/put/")) return send({});
      if (url.startsWith("/out/")) { res.setHeader("content-type", url.endsWith(".mp4") ? "video/mp4" : "image/jpeg"); return res.end(readFileSync(path.join(dir, url.endsWith(".mp4") ? "v.mp4" : "s.jpg"))); }
      if (url.startsWith("/estimate/")) return send(url.includes("video") ? { type: "description", pricing_description: "Standard self-serve rates in USD per video second: 720p: $0.2; 1080p: $0.5." } : { type: "estimate", usd: "0.09" });
      const st = /^\/requests\/([\w-]+)\/status$/.exec(url);
      if (st) {
        const id = st[1];
        const n = (mock.polls.get(id) ?? 0) + 1;
        mock.polls.set(id, n);
        if (n < 2) return send({ status: "in_progress", request_id: id });
        const isVideo = id.startsWith("vid");
        if (!isVideo && mock.mode === "moderate_still") return send({ status: "nsfw", request_id: id });
        if (isVideo && mock.mode === "fail_video") return send({ status: "failed", request_id: id, error: "Generation failed" });
        return send(isVideo ? { status: "completed", request_id: id, video: { url: `${base}/out/${id}.mp4` } } : { status: "completed", request_id: id, images: [{ url: `${base}/out/${id}.jpg` }] });
      }
      // A generation submission.
      const key = String(req.headers["idempotency-key"] ?? "");
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      mock.submits.push({ path: url, key, body });
      if (mock.mode === "plan") return send({ detail: "Requires plus plan or higher" }, 403);
      if (mock.mode === "flaky_submit" && !mock.flaked) { mock.flaked = true; return send({ detail: "queue admission unavailable" }, 503); }
      if (!mock.keys.has(key)) mock.keys.set(key, `${url.includes("video") ? "vid" : "img"}-${mock.keys.size + 1}`);
      return send({ request_id: mock.keys.get(key), status: "queued" });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  Object.assign(process.env, { HF_CREDENTIALS: "test-id:test-secret", HF_API_URL: base, VIDEO_DATA_DIR: path.join(dir, "data"), NO_PROXY: "127.0.0.1,localhost" });
  pipeline = await import("@/lib/cinematic/server");
  storage = await import("@/lib/storage/objects");
  media = await import("@/lib/storage/media");
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
async function start(mode: Mode, extra: Record<string, unknown> = {}) {
  Object.assign(mock, { mode, submits: [], flaked: false });
  const headshot = media.newMediaId();
  await storage.objects().put(media.mediaKey(headshot), new Uint8Array(readFileSync(path.join(dir, "s.jpg"))), "image/jpeg");
  // A separate advisor each time, so the monthly limit never gets in the way.
  const u = { ...(user as object), id: `utest000000000000${(n++).toString().padStart(2, "0")}` } as never;
  const job = await pipeline.createJob(u, { headshotIds: [headshot], script: "Most people think a Roth conversion is all or nothing. It is not.", settingId: "corner-office", voiceId: "male-us", aspect: "9:16", aiLabel: false, consent: true, ...extra });
  return { u, id: job.id };
}
/** Advance until the status changes from a working one (or a few tries pass). */
async function settle(id: string, until: (s: string) => boolean) {
  for (let i = 0; i < 12; i++) {
    const j = await pipeline.advance(id);
    if (j && until(j.status)) return j;
  }
  return (await pipeline.getJob(id))!;
}

test("consent is required and recorded with a timestamp", async () => {
  await assert.rejects(() => start("ok", { consent: false }), /Confirm that you’re the person/);
  const { id } = await start("ok");
  const job = (await pipeline.getJob(id))!;
  assert.match(job.consent.text, /I am the person in these photos/);
  assert.ok(Date.parse(job.consent.at) > 0);
});

test("uploading → scene → approval → filming → ready, with our own copies and costs logged", async () => {
  const { u, id } = await start("ok");
  let job = await settle(id, (s) => s === "approval");
  assert.equal(job.status, "approval");
  assert.ok(job.still?.mediaId, "still copied into Renom's storage");
  // Nothing is filmed before approval.
  assert.equal(mock.submits.filter((s) => s.path.includes("video")).length, 0);
  job = await pipeline.act(u, id, "approve");
  job = await settle(id, (s) => s === "ready");
  assert.equal(job.status, "ready");
  assert.ok(job.video?.uploadId, "video copied into Renom's storage");
  const still = mock.submits.find((s) => s.path.includes("image"))!;
  const video = mock.submits.find((s) => s.path.includes("video"))!;
  assert.deepEqual(still.body.image_urls, [`${base}/pub/in.jpg`]);
  assert.equal(still.body.aspect_ratio, "9:16");
  assert.equal(video.body.image_url, `${base}/pub/in.jpg`);
  assert.equal(video.body.duration, 8);
  assert.match(String(video.body.prompt), /They say: "Most people think a Roth conversion/);
  assert.deepEqual(job.costs.map((c) => [c.step, c.usd, c.outcome]), [["still", 0.09, "charged"], ["video", 4, "charged"]]);
  // What the advisor's page gets has no prompts, request ids or costs.
  const v = pipeline.view(job) as unknown as Record<string, unknown>;
  assert.ok(v.videoUrl && v.stillUrl);
  assert.ok(!("costs" in v) && !("still" in v) && !JSON.stringify(v).includes("img-"));
});

test("a busy submit is retried with the same idempotency key, creating one request", async () => {
  const { id } = await start("flaky_submit");
  const first = (await pipeline.getJob(id))!;
  // createJob doesn't submit; the first advance hits the 503 and backs off.
  let job = (await pipeline.advance(id))!;
  assert.equal(job.status, "uploading");
  assert.ok(job.still?.retryAt, "backs off before trying again");
  job.still!.retryAt = 0;
  await storage.putJSON(`cinematic/${id}.json`, job);
  job = await settle(id, (s) => s === "approval");
  assert.equal(job.status, "approval");
  const stills = mock.submits.filter((s) => s.path.includes("image"));
  assert.ok(stills.length >= 2);
  assert.equal(new Set(stills.map((s) => s.key)).size, 1, "same key every time");
  assert.deepEqual(stills[0].body, stills.at(-1)!.body, "same request body every time");
  assert.equal(job.costs.filter((c) => c.step === "still").length, 1);
  assert.equal(first.status, "uploading");
});

test("a plan or entitlement error fails at once, isn't retried, and is spelled out for the admin", async () => {
  const { id } = await start("plan");
  const job = (await pipeline.advance(id))!;
  assert.equal(job.status, "failed");
  assert.equal(mock.submits.length, 1, "not retried");
  assert.match(job.adminError ?? "", /plan/i);
  assert.match(job.error ?? "", /aren’t available right now/);
  assert.ok(!/plan/i.test(job.error ?? ""), "the advisor isn't shown billing details");
});

test("a moderated still fails kindly, costs nothing, and a retry makes a new still", async () => {
  const { u, id } = await start("moderate_still");
  let job = await settle(id, (s) => s === "failed");
  assert.equal(job.status, "failed");
  assert.equal(job.failedAt, "scene");
  assert.deepEqual(job.costs.map((c) => c.outcome), ["refunded"]);
  const firstKey = mock.submits[0].key;
  mock.mode = "ok";
  job = await pipeline.act(u, id, "retry");
  job = await settle(id, (s) => s === "approval");
  assert.equal(job.status, "approval");
  assert.notEqual(mock.submits.at(-1)!.key, firstKey, "a deliberate new generation gets a new key");
});

test("asking for another still goes back to the scene; a failed video retries from the approved still", async () => {
  const { u, id } = await start("ok");
  let job = await settle(id, (s) => s === "approval");
  const firstStill = job.still!.mediaId;
  job = await pipeline.act(u, id, "regenerate");
  job = await settle(id, (s) => s === "approval");
  assert.notEqual(job.still!.mediaId, firstStill);
  assert.equal(job.pastStills?.length, 1);
  mock.mode = "fail_video";
  await pipeline.act(u, id, "approve");
  job = await settle(id, (s) => s === "failed");
  assert.equal(job.failedAt, "filming");
  const keptStill = job.still!.mediaId;
  mock.mode = "ok";
  await pipeline.act(u, id, "retry");
  job = await settle(id, (s) => s === "ready");
  assert.equal(job.status, "ready");
  assert.equal(job.still!.mediaId, keptStill, "the approved still is reused");
});

test("one advisor can't see or act on another's video", async () => {
  const { id } = await start("ok");
  await assert.rejects(() => pipeline.act({ ...(user as object), id: "usomeoneelse0000001" } as never, id, "approve"), /Not found/);
});
