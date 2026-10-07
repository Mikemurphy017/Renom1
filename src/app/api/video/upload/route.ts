import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { saveUpload, updateUpload } from "@/lib/video/storage";
import { ACCEPTED_VIDEO_TYPES, MAX_UPLOAD_LABEL, MAX_UPLOAD_MB, type UploadResponse } from "@/lib/video/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const TOO_BIG = `Videos can be up to ${MAX_UPLOAD_LABEL}. Record a shorter take or pick a lower quality in the camera settings.`;

interface Received {
  fields: Record<string, string>;
  file?: { path: string; filename: string; mimeType: string; size: number; tooBig: boolean };
}

/**
 * Read the multipart body as it arrives: the file goes straight to a temp file,
 * so a 4K take never sits in memory (request.formData() would buffer all of it).
 */
function receive(request: Request, dir: string): Promise<Received> {
  return new Promise((resolve, reject) => {
    if (!request.body) return reject(new Error("No body"));
    let bb: Busboy.Busboy;
    try {
      bb = Busboy({ headers: Object.fromEntries(request.headers), limits: { files: 1, fileSize: MAX_BYTES, fields: 10, fieldSize: 1024 } });
    } catch (e) {
      return reject(e);
    }
    const out: Received = { fields: {} };
    let writing: Promise<void> = Promise.resolve();
    bb.on("field", (name, value) => (out.fields[name] = value));
    bb.on("file", (name, stream, info) => {
      if (name !== "file" || out.file) return stream.resume();
      const f = { path: path.join(dir, "take"), filename: info.filename, mimeType: info.mimeType, size: 0, tooBig: false };
      out.file = f;
      stream.on("data", (d: Buffer) => (f.size += d.length));
      // Past the cap busboy stops writing and discards the rest.
      stream.on("limit", () => (f.tooBig = true));
      writing = pipeline(stream, createWriteStream(f.path));
    });
    bb.on("error", reject);
    bb.on("close", () => writing.then(() => resolve(out), reject));
    const body = Readable.fromWeb(request.body as unknown as NodeReadableStream);
    body.on("error", reject);
    body.pipe(bb);
  });
}

/**
 * Multipart upload of one recorded take: fields `file`, `durationSec`, optional `videoId`.
 * This route is left out of the middleware (which would buffer and cut off big
 * bodies), so it checks the session itself.
 */
export async function POST(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const processor = await getProcessor();
  const ready = processor.readiness();
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.reason }, { status: 503 });

  // Refuse oversized bodies before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 1024 * 1024) return NextResponse.json({ ok: false, error: TOO_BIG }, { status: 413 });
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return NextResponse.json({ ok: false, error: "Expected multipart/form-data" }, { status: 415 });

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-up-"));
  try {
    let form: Received;
    try {
      form = await receive(request, dir);
    } catch {
      return NextResponse.json({ ok: false, error: "Couldn’t read the upload. Check your connection and try again." }, { status: 400 });
    }

    const file = form.file;
    const durationSec = Number(form.fields.durationSec);
    const videoId = form.fields.videoId ?? null;
    const mimeType = file?.mimeType.split(";")[0].trim().toLowerCase() ?? "";
    if (file?.tooBig) return NextResponse.json({ ok: false, error: TOO_BIG }, { status: 413 });
    const errors: string[] = [];
    if (!file) errors.push("file is required");
    else {
      if (!ACCEPTED_VIDEO_TYPES.includes(mimeType)) errors.push(`file must be a video (${ACCEPTED_VIDEO_TYPES.join(", ")})`);
      if (file.size === 0) errors.push("file is empty");
    }
    if (!Number.isFinite(durationSec) || durationSec < 0.5 || durationSec > 3600) errors.push("durationSec must be between 0.5 and 3600");
    if (videoId !== null && !/^[\w-]{1,40}$/.test(videoId)) errors.push("videoId is invalid");
    if (errors.length) return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });

    const f = file!;
    try {
      const rec = await saveUpload({ filename: f.filename || "take", mimeType, size: f.size, durationSec, videoId: videoId ?? undefined }, f.path);
      const { remoteId } = await processor.upload(rec, f.path);
      await updateUpload(rec.id, { remoteId });
      const body: UploadResponse = { ok: true, sourceId: rec.id, processor: processor.id };
      return NextResponse.json(body);
    } catch (e) {
      if (!(e instanceof VideoProcessorError)) console.error("[upload] couldn’t store the take:", e);
      const status = e instanceof VideoProcessorError ? e.status : 500;
      return NextResponse.json({ ok: false, error: e instanceof VideoProcessorError ? e.message : "Couldn’t save the upload" }, { status });
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
