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

const mock = { calls: [] as { method: string; url: string; body: string; idem?: string }[], polls: new Map<string, number>(), consent: "pending" as string, failVoice: false, failAvatarV: false };
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
      if (url === "/v3/avatars/looks" && req.method === "POST") {
        const b = JSON.parse(body || "{}");
        const n = b.type === "look_pack" ? 5 : 2;
        return send({ group_id: "group_1", looks: Array.from({ length: n }, (_, i) => ({ id: `look_${b.type}_${i + 1}` })) });
      }
      if (url.startsWith("/v3/avatars/look-templates")) {
        res.setHeader("content-type", "application/json");
        const page2 = url.includes("token=p2");
        const items = page2
          ? [{ id: "b".repeat(32), type: "template", name: "Studio Streamer", gender: "male", preview_image_url: `${base}/preview.jpg`, looks_count: 2 }]
          : [
              { id: "5e659e76755d47fd9160a2d7dedce124", type: "look_pack", name: "Modern Corporate", gender: "male", preview_image_url: `${base}/preview.jpg`, looks_count: 5 },
              { id: "a".repeat(32), type: "template", name: "Professor", gender: null, preview_image_url: null, looks_count: 2 },
            ];
        return res.end(JSON.stringify({ data: items, has_more: !page2, next_token: page2 ? null : "p2" }));
      }
      if (url.startsWith("/v3/avatars/looks/") && req.method === "DELETE") return send({ id: url.split("/").pop() });
      if (url.startsWith("/v3/avatars/looks/")) return send(ready(url) ? { status: "completed", supported_api_engines: ["avatar_iv", "avatar_v"], preview_image_url: `${base}/preview.jpg` } : { status: "processing" });
      if (url === "/preview.jpg") {
        res.setHeader("content-type", "image/jpeg");
        return res.end(readFileSync(path.join(dir, "face.jpg")));
      }
      if (url === "/v3/avatars/group_1/consent") return send({ url: "https://consent.example/abc", avatar_group: { consent_status: "pending" } });
      if (url === "/v3/avatars/group_1" && req.method === "GET") return send({ id: "group_1", consent_status: mock.consent });
      if (url === "/v3/avatars/group_1" && req.method === "DELETE") return send({});
      if (url === "/v3/videos" && req.method === "POST") return send({ video_id: mock.failAvatarV && JSON.parse(body).engine?.type === "avatar_v" ? "vid_bad" : "vid_1" });
      if (url === "/v3/videos/vid_bad") return send({ status: "failed", failure_code: "engine_unavailable", failure_message: "Avatar V is not available for this look" });
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

test("an iPhone voice memo (.m4a) is converted and cloned too", async () => {
  const ffmpeg = (await import("ffmpeg-static")).default as unknown as string;
  execFileSync(ffmpeg, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=200:duration=45", "-c:a", "aac", path.join(dir, "memo.m4a")]);
  const v = await twin.setVoice(user, { bytes: new Uint8Array(readFileSync(path.join(dir, "memo.m4a"))), name: "memo.m4a" }, undefined, "yes");
  assert.equal(v.voice?.seconds, 45);
  assert.match(mock.calls.filter((c) => c.url === "/v3/assets").at(-1)!.body, /audio\/mpeg/);
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

test("new looks come from the gallery: templates and look packs, applied to the advisor's own look", async () => {
  const start = await twin.refresh(user);
  assert.ok(start.looks.find((l) => l.kind === "video")?.mediaId, "the twin's own look gets a picture in Renom's storage");

  const gallery = (await twin.lookTemplates()).map(twin.viewTemplate);
  assert.deepEqual(gallery.map((t) => [t.name, t.kind, t.styling, t.count]), [["Modern Corporate", "pack", "men", 5], ["Professor", "single", null, 2], ["Studio Streamer", "single", "men", 2]], "every page is read");
  assert.equal(JSON.stringify(gallery).includes("preview.jpg"), false, "covers come through Renom, not the provider");
  assert.match(gallery[0].image ?? "", /^\/api\/twin\/templates\/[a-f0-9]{32}$/);
  assert.ok((await twin.templateImage(gallery[0].id))?.bytes.length, "a cover can be fetched");
  assert.equal(await twin.templateImage("../etc/passwd"), null);

  await assert.rejects(() => twin.addTemplateLooks(user, { templateId: "f".repeat(32) }), /Pick one of the templates/);
  const v = await twin.addTemplateLooks(user, { templateId: "a".repeat(32), aspect: "16:9" });
  assert.deepEqual(v.scenesPending.map((p) => p.name), ["Professor 1", "Professor 2"]);
  const single = JSON.parse(mock.calls.filter((c) => c.url === "/v3/avatars/looks").at(-1)!.body);
  assert.equal(single.type, "template");
  assert.match(single.reference_look_id, /^look_/, "the advisor's own look is the reference");
  assert.equal(single.aspect_ratio, undefined, "single templates keep their own shape");

  await twin.addTemplateLooks(user, { templateId: "5e659e76755d47fd9160a2d7dedce124", aspect: "16:9" });
  const pack = JSON.parse(mock.calls.filter((c) => c.url === "/v3/avatars/looks").at(-1)!.body);
  assert.deepEqual([pack.type, pack.template_id, pack.aspect_ratio], ["look_pack", "5e659e76755d47fd9160a2d7dedce124", "16:9"]);

  const done = await until(() => twin.refresh(user), (x) => x.scenesPending.length === 0);
  const scenes = done.looks.filter((l) => l.kind === "scene");
  assert.equal(scenes.length, 7);
  assert.ok(scenes.every((l) => l.mediaId), "each look's picture is kept in Renom's storage");
  assert.equal(done.limits.looksLeft, done.limits.looksPerMonth - 7);
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

test("the plan mixes up the looks: least recently used first, matching the shape, never the same twice in a run", async () => {
  const L = (id: string, aspect?: "9:16" | "16:9") => ({ id, label: id, kind: "scene" as const, aspect, engines: [] });
  const looks = [L("a"), L("b", "9:16"), L("wide", "16:9"), L("c")];
  const jobs = [
    { lookId: "a", createdAt: "2026-11-02", status: "ready" as const },
    { lookId: "b", createdAt: "2026-11-01", status: "ready" as const },
    { lookId: "c", createdAt: "2026-11-03", status: "failed" as const },
  ];
  assert.equal(twin.rotateLook(looks, jobs, "9:16").id, "c", "a look whose only video failed counts as unused");
  assert.equal(twin.rotateLook(looks, [...jobs, { lookId: "c", createdAt: "2026-11-04", status: "ready" }], "9:16").id, "b");
  assert.equal(twin.rotateLook(looks, jobs, "16:9").id, "wide", "a wide video prefers a wide look");
  assert.equal(twin.rotateLook([L("x"), L("y")], [], "9:16", "y").id, "y", "the default goes first among unused looks");

  const before = mock.calls.filter((c) => c.url === "/v3/videos").length;
  const script = "Three things to check before you file your taxes this year.";
  await Promise.all([1, 2, 3].map(() => twin.startAiVideo(user, { script, aspect: "9:16", rotate: true })));
  const used = mock.calls.filter((c) => c.url === "/v3/videos").slice(before).map((c) => JSON.parse(c.body).avatar_id);
  assert.equal(new Set(used).size, 3, `three different looks: ${used}`);
  const plain = await twin.startAiVideo(user, { script, aspect: "9:16" });
  assert.equal(plain.lookId, (await twin.refresh(user)).defaultLook, "without rotate, the default look");
});

test("new looks stop at the monthly allowance", async () => {
  process.env.AI_LOOKS_MONTHLY_LIMIT = "8";
  await assert.rejects(() => twin.addTemplateLooks(user, { templateId: "5e659e76755d47fd9160a2d7dedce124" }), /1 more look this month/);
  delete process.env.AI_LOOKS_MONTHLY_LIMIT;
});

test("a failed video is tried once more on the standard engine, and the reason is kept", async () => {
  mock.failAvatarV = true;
  const job = await twin.startAiVideo(user, { script: "One quick idea for business owners before the year ends.", aspect: "9:16" });
  const done = await until(() => twin.advanceJob(job.id), (j) => j?.status !== "working");
  mock.failAvatarV = false;
  assert.equal(done?.status, "ready");
  assert.equal(done?.fellBack, true);
  assert.match(done?.providerError ?? "", /engine_unavailable/);
  const retry = JSON.parse(mock.calls.filter((c) => c.url === "/v3/videos" && c.method === "POST").at(-1)!.body);
  assert.equal(retry.engine, undefined, "the retry uses the standard engine");
  assert.equal(retry.voice_id, "voice_1");
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
