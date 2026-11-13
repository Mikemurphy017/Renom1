/**
 * The AI twin and AI videos against a stand-in for the provider's API (nothing
 * is billed). Run with `npm run test:twin`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const mock = { calls: [] as { method: string; url: string; body: string; idem?: string }[], polls: new Map<string, number>(), consent: "pending" as string, failVoice: false };
let server: http.Server;
let dir: string;
let base: string;
let twin: typeof import("@/lib/twin/server");
let storage: typeof import("@/lib/storage/objects");
let media: typeof import("@/lib/storage/media");
let videoStore: typeof import("@/lib/video/storage");
const user = { id: "utwin000000000000a", email: "advisor@example.com", name: "Test Advisor", createdAt: "" } as never;

const ready = (id: string, after = 2) => {
  const n = (mock.polls.get(id) ?? 0) + 1;
  mock.polls.set(id, n);
  return n >= after;
};

before(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), "renom-twin-test-"));
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string;
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=navy:size=360x640:rate=24:duration=20", "-f", "lavfi", "-i", "sine=frequency=300:duration=20", "-shortest", "-pix_fmt", "yuv420p", path.join(dir, "talk.mp4")]);
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=40", path.join(dir, "voice.webm")]);
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=gray:size=360x640", "-frames:v", "1", path.join(dir, "face.jpg")]);
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const url = req.url ?? "";
      const body = Buffer.concat(chunks).toString("latin1");
      mock.calls.push({ method: req.method ?? "", url, body: body.slice(0, 400), idem: req.headers["idempotency-key"] as string | undefined });
      const send = (data: unknown, code = 200) => {
        res.statusCode = code;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(code < 400 ? { data } : data));
      };
      // Storage and file downloads never get the API key; everything else needs it.
      const keyless = url === "/s3/put" || url === "/out.mp4" || url === "/preview.jpg";
      if (keyless && req.headers["x-api-key"]) return send({ error: { code: "leak", message: "the API key was sent to storage" } }, 400);
      if (!keyless && req.headers["x-api-key"] !== "test-key") return send({ error: { code: "unauthorized", message: "bad key" } }, 401);
      if (url === "/v3/assets" && req.method === "POST") return send({ asset_id: `asset_small_${mock.calls.length}` });
      if (url === "/v3/assets/direct-uploads") return send({ asset_id: "asset_big", upload_url: `${base}/s3/put`, upload_headers: { "content-type": "video/mp4" } });
      if (url === "/s3/put") return res.end("");
      if (/^\/v3\/assets\/[^/]+\/complete$/.test(url)) return send({ asset_id: "asset_big", status: "processing" });
      if (url === "/v3/models/audio/voices" && req.method === "POST") return send({ voice_id: "voice_1" }, 202);
      if (/^\/v3\/models\/audio\/voices\/voice_1$/.test(url) && req.method === "GET") return send(ready("voice") ? (mock.failVoice ? { status: "FAILED", failure_reason: "PREPROCESSING_FAILED" } : { status: "ACTIVE", preview_audio_url: "x" }) : { status: "PENDING" });
      if (url.startsWith("/v3/models/audio/voices/") && req.method === "DELETE") return send({});
      if (url === "/v3/avatars" && req.method === "POST") {
        const b = JSON.parse(body || "{}");
        if (b.type === "prompt") return send({ avatar_item: { id: `look_prompt_${mock.calls.length}` }, avatar_group: { id: b.avatar_group_id } });
        if (b.type === "digital_twin") return send({ avatar_item: { id: "look_twin", default_voice_id: "voice_twin" }, avatar_group: { id: "group_1" } });
        return send({ avatar_item: { id: `look_photo_${b.file.asset_id}` }, avatar_group: { id: b.avatar_group_id } });
      }
      if (url === "/v3/avatars/looks" && req.method === "POST") return send({ group_id: "group_1", looks: [1, 2, 3, 4, 5].map((i) => ({ id: `look_pack_${i}` })) });
      if (url.startsWith("/v3/avatars/looks/") && req.method === "DELETE") return send({ id: url.split("/").pop() });
      if (url.startsWith("/v3/avatars/looks/")) return send(ready(url) ? { status: "completed", supported_api_engines: ["avatar_iv", "avatar_v"], preview_image_url: `${base}/preview.jpg` } : { status: "processing" });
      if (url === "/preview.jpg") {
        res.setHeader("content-type", "image/jpeg");
        return res.end(readFileSync(path.join(dir, "face.jpg")));
      }
      if (url === "/v3/avatars/group_1/consent") return send({ url: "https://consent.example/abc", avatar_group: { consent_status: "pending" } });
      if (url === "/v3/avatars/group_1" && req.method === "GET") return send({ id: "group_1", consent_status: mock.consent });
      if (url === "/v3/avatars/group_1" && req.method === "DELETE") return send({});
      if (url === "/v3/videos" && req.method === "POST") return send({ video_id: "vid_1" });
      if (url === "/v3/videos/vid_1") return send(ready("vid", 2) ? { status: "completed", video_url: `${base}/out.mp4` } : { status: "processing" });
      if (url === "/out.mp4") {
        res.setHeader("content-type", "video/mp4");
        return res.end(readFileSync(path.join(dir, "talk.mp4")));
      }
      send({ error: { code: "not_found", message: url } }, 404);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  Object.assign(process.env, { HEYGEN_API_KEY: "test-key", HEYGEN_API_URL: base, VIDEO_DATA_DIR: path.join(dir, "data"), NO_PROXY: "127.0.0.1,localhost" });
  twin = await import("@/lib/twin/server");
  storage = await import("@/lib/storage/objects");
  media = await import("@/lib/storage/media");
  videoStore = await import("@/lib/video/storage");
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, n = 8) {
  let v = await fn();
  for (let i = 0; i < n && !ok(v); i++) v = await fn();
  return v;
}

test("nothing is made without the advisor's consent", async () => {
  await assert.rejects(() => twin.setVoice(user, { bytes: new Uint8Array(readFileSync(path.join(dir, "voice.webm"))), name: "voice.webm" }, 40, false), /Confirm that this is you/);
});

test("the voice is converted to MP3 and cloned, then becomes ready", async () => {
  const v = await twin.setVoice(user, { bytes: new Uint8Array(readFileSync(path.join(dir, "voice.webm"))), name: "voice.webm" }, 40, "yes");
  assert.equal(v.voice?.status, "working");
  const clone = mock.calls.find((c) => c.url === "/v3/models/audio/voices" && c.method === "POST")!;
  assert.match(clone.body, /"mode":"instant"/);
  assert.ok(clone.idem, "an Idempotency-Key is sent");
  const upload = mock.calls.find((c) => c.url === "/v3/assets")!;
  assert.match(upload.body, /audio\/mpeg/);
  const done = await until(() => twin.refresh(user), (x) => x.voice?.status === "ready");
  assert.equal(done.voice?.status, "ready");
  assert.equal(done.ready, false, "not ready without the twin");
});

test("a too-short voice recording is turned down before anything is sent", async () => {
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string;
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=8", path.join(dir, "short.webm")]);
  await assert.rejects(() => twin.setVoice(user, { bytes: new Uint8Array(readFileSync(path.join(dir, "short.webm"))), name: "short.webm" }, 8, "yes"), /at least 30 seconds/);
});

test("the talking video trains a twin through a direct upload, gets a consent link, and photos join its group", async () => {
  const rec = await videoStore.saveUpload({ filename: "talk.mp4", mimeType: "video/mp4", size: 1, durationSec: 20 }, path.join(dir, "talk.mp4"));
  const v = await twin.setVideo(user, rec.id, "https://renom.example/settings#ai-twin", "yes");
  assert.equal(v.video?.status, "working");
  assert.equal(v.video?.consent, "pending");
  assert.equal(v.video?.consentUrl, "https://consent.example/abc");
  assert.ok(mock.calls.some((c) => c.url === "/s3/put" && c.method === "PUT"), "bytes go straight to storage");
  assert.ok(mock.calls.some((c) => c.url === "/v3/assets/asset_big/complete"));
  assert.match(mock.calls.find((c) => c.url === "/v3/avatars")!.body, /"type":"digital_twin"/);

  const photo = media.newMediaId();
  await storage.objects().put(media.mediaKey(photo), new Uint8Array(readFileSync(path.join(dir, "face.jpg"))), "image/jpeg");
  await twin.setPhotos(user, [photo], "yes");
  const trained = await until(() => twin.refresh(user), (x) => x.video?.status === "ready" && x.photos.every((p) => p.status === "ready"));
  assert.equal(trained.video?.status, "ready");
  assert.equal(trained.photos[0].status, "ready");
  assert.match(mock.calls.filter((c) => c.url === "/v3/avatars").at(-1)!.body, /"avatar_group_id":"group_1"/);
  assert.equal(trained.ready, false, "not ready until consent is accepted");
  await assert.rejects(() => twin.startAiVideo(user, { script: "Most people get Roth conversions wrong, and here is why." }), /Finish setting up/);

  mock.consent = "accepted";
  const ok = await twin.refresh(user);
  assert.equal(ok.video?.consent, "accepted");
  assert.equal(ok.ready, true);
  assert.equal(ok.video?.consentUrl, undefined, "no link once consent is in");
  assert.equal(ok.looks[0].mediaId, photo, "photo looks come first");
});

test("an AI video uses the look, the cloned voice and Avatar V, then lands in Renom's storage", async () => {
  const job = await twin.startAiVideo(user, { script: "Most people get Roth conversions wrong, and here is why it matters.", videoId: "vabc123", aspect: "9:16", title: "Roth" });
  const sent = JSON.parse(mock.calls.find((c) => c.url === "/v3/videos")!.body);
  assert.equal(sent.type, "avatar");
  assert.equal(sent.voice_id, "voice_1");
  assert.equal(sent.engine.type, "avatar_v");
  assert.equal(sent.aspect_ratio, "9:16");
  assert.match(sent.avatar_id, /^look_photo_/);
  const done = await until(() => twin.advanceJob(job.id), (j) => j?.status !== "working");
  assert.equal(done?.status, "ready");
  const view = twin.viewJob(done!);
  assert.match(view.videoUrl ?? "", /^\/api\/video\/files\//);
  assert.equal(view.videoId, "vabc123");
  assert.deepEqual([view.width, view.height], [360, 640]);
});

test("new looks: a described outfit and setting, and a set of five, made from the twin in its group", async () => {
  const start = await twin.refresh(user);
  assert.ok(start.looks.find((l) => l.kind === "video")?.mediaId, "the twin's own look gets a picture in Renom's storage");
  await assert.rejects(() => twin.addLook(user, { prompt: "suit" }), /Describe the outfit/);

  const v = await twin.addLook(user, { prompt: "Navy suit and white shirt, modern office with a city view", aspect: "16:9" });
  assert.equal(v.scenesPending[0].status, "working");
  assert.equal(v.scenesPending[0].name, "Navy suit and white shirt");
  const sent = JSON.parse(mock.calls.filter((c) => c.url === "/v3/avatars").at(-1)!.body);
  assert.equal(sent.type, "prompt");
  assert.equal(sent.avatar_group_id, "group_1");
  assert.match(sent.avatar_id, /^look_/, "the advisor's own look is the reference");
  assert.equal(sent.aspect_ratio, "16:9");
  assert.match(sent.prompt, /Navy suit.*Same person/);

  await assert.rejects(() => twin.addLookPack(user, { pack: "corporate" }), /men’s or women’s/);
  await twin.addLookPack(user, { pack: "corporate", styling: "men" });
  const pack = JSON.parse(mock.calls.find((c) => c.url === "/v3/avatars/looks")!.body);
  assert.equal(pack.type, "look_pack");
  assert.equal(pack.template_id, "5e659e76755d47fd9160a2d7dedce124");

  const done = await until(() => twin.refresh(user), (x) => x.scenesPending.length === 0);
  const scenes = done.looks.filter((l) => l.kind === "scene");
  assert.equal(scenes.length, 6);
  assert.ok(scenes.every((l) => l.mediaId), "each look's picture is kept in Renom's storage");
  assert.equal(done.limits.looksLeft, done.limits.looksPerMonth - 6);
  assert.equal(JSON.stringify(done).includes("preview.jpg"), false, "no provider URLs reach the page");

  const office = scenes.find((l) => l.aspect === "16:9")!;
  await twin.setDefaultLook(user, office.id);
  await twin.renameLook(user, office.id, "City office");
  const job = await twin.startAiVideo(user, { script: "Here is one thing to check before the end of the year.", aspect: "16:9" });
  assert.equal(JSON.parse(mock.calls.filter((c) => c.url === "/v3/videos").at(-1)!.body).avatar_id, office.id);
  assert.equal(job.lookId, office.id);

  const after = await twin.removeLook(user, office.id);
  assert.ok(mock.calls.some((c) => c.method === "DELETE" && c.url === `/v3/avatars/looks/${office.id}`));
  assert.equal(after.looks.some((l) => l.id === office.id), false);
  assert.notEqual(after.defaultLook, office.id);
});

test("new looks stop at the monthly allowance", async () => {
  process.env.AI_LOOKS_MONTHLY_LIMIT = "8";
  await assert.rejects(() => twin.addLookPack(user, { pack: "casual", styling: "women" }), /2 more looks this month/);
  delete process.env.AI_LOOKS_MONTHLY_LIMIT;
});

test("scripts that are too long or empty are turned down", async () => {
  await assert.rejects(() => twin.startAiVideo(user, { script: "Hi." }), /at least a sentence/);
  await assert.rejects(() => twin.startAiVideo(user, { script: Array.from({ length: 401 }, () => "word").join(" ") }), /400 words/);
});

test("one advisor can't read another's video", async () => {
  const [job] = await twin.listJobs("utwin000000000000a");
  await assert.rejects(() => twin.getOwnJob({ id: "usomeoneelse00000001" } as never, job.id), /Not found/);
});

test("deleting the twin removes the voice and the group", async () => {
  const before = mock.calls.length;
  await twin.removeTwin(user);
  const after = mock.calls.slice(before);
  assert.ok(after.some((c) => c.method === "DELETE" && c.url === "/v3/models/audio/voices/voice_1"));
  assert.ok(after.some((c) => c.method === "DELETE" && c.url === "/v3/avatars/group_1"));
  assert.equal((await twin.refresh(user)).voice, null);
});
