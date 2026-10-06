import { NextResponse } from "next/server";
import { objects } from "@/lib/storage/objects";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB, MEDIA_KINDS, mediaKey, mediaUrl, newMediaId, type MediaKind } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

const MAX_BYTES = MAX_IMAGE_MB * 1024 * 1024;

/** Multipart upload of one image: fields `file`, `kind` (headshot | thumbnail | logo). */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 256 * 1024) return NextResponse.json({ ok: false, error: `Images can be up to ${MAX_IMAGE_MB} MB` }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t read the upload" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(type)) return NextResponse.json({ ok: false, error: "Use a PNG, JPEG or WebP image" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: `Images can be up to ${MAX_IMAGE_MB} MB` }, { status: 413 });
  if (!MEDIA_KINDS.includes(kind as MediaKind)) return NextResponse.json({ ok: false, error: "kind is invalid" }, { status: 400 });

  const id = newMediaId();
  try {
    await objects().put(mediaKey(id), new Uint8Array(await file.arrayBuffer()), type);
  } catch (e) {
    console.error("[media] upload failed", e);
    return NextResponse.json({ ok: false, error: "Couldn’t save the image" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, url: mediaUrl(id), storage: objects().kind });
}

/** Which store files go to, so Settings can say whether they are safe. */
export async function GET() {
  return NextResponse.json({ storage: objects().kind });
}
