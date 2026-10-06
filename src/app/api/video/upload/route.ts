import { NextResponse } from "next/server";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { saveUpload, updateUpload } from "@/lib/video/storage";
import { ACCEPTED_VIDEO_TYPES, MAX_UPLOAD_MB, type UploadResponse } from "@/lib/video/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Multipart upload of one recorded take: fields `file`, `durationSec`, optional `videoId`. */
export async function POST(request: Request) {
  const processor = await getProcessor();
  const ready = processor.readiness();
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.reason }, { status: 503 });

  // Refuse oversized bodies before reading them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 1024 * 1024) return NextResponse.json({ ok: false, error: `Videos can be up to ${MAX_UPLOAD_MB} MB` }, { status: 413 });
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return NextResponse.json({ ok: false, error: "Expected multipart/form-data" }, { status: 415 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t read the upload" }, { status: 400 });
  }

  const file = form.get("file");
  const durationSec = Number(form.get("durationSec"));
  const videoId = form.get("videoId");
  const errors: string[] = [];
  if (!(file instanceof File)) errors.push("file is required");
  else {
    const base = file.type.split(";")[0].trim().toLowerCase();
    if (!ACCEPTED_VIDEO_TYPES.includes(base)) errors.push(`file must be a video (${ACCEPTED_VIDEO_TYPES.join(", ")})`);
    if (file.size === 0) errors.push("file is empty");
    if (file.size > MAX_BYTES) errors.push(`Videos can be up to ${MAX_UPLOAD_MB} MB`);
  }
  if (!Number.isFinite(durationSec) || durationSec < 0.5 || durationSec > 3600) errors.push("durationSec must be between 0.5 and 3600");
  if (videoId !== null && (typeof videoId !== "string" || !/^[\w-]{1,40}$/.test(videoId))) errors.push("videoId is invalid");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });

  const f = file as File;
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const rec = await saveUpload(
      { filename: f.name || "take", mimeType: f.type.split(";")[0].trim().toLowerCase(), size: f.size, durationSec, videoId: (videoId as string | null) ?? undefined },
      bytes
    );
    const { remoteId } = await processor.upload(rec, bytes);
    await updateUpload(rec.id, { remoteId });
    const body: UploadResponse = { ok: true, sourceId: rec.id, processor: processor.id };
    return NextResponse.json(body);
  } catch (e) {
    const status = e instanceof VideoProcessorError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof VideoProcessorError ? e.message : "Couldn’t save the upload" }, { status });
  }
}
