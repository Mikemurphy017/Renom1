import { NextResponse } from "next/server";
import { objects } from "@/lib/storage/objects";
import { stockFootageEnabled } from "@/lib/video/local/broll";
import { MAX_IMAGE_MB, MAX_MEDIA_MB, MEDIA_KINDS, acceptedTypes, mediaKey, mediaUrl, newMediaId, type MediaKind } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

const limitFor = (kind: MediaKind) => (kind === "broll" || kind === "music" ? MAX_MEDIA_MB : MAX_IMAGE_MB);

/** Multipart upload of one file: fields `file`, `kind` (headshot | thumbnail | logo: images; broll: images or clips; music: audio). */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_MEDIA_MB * 1024 * 1024 + 256 * 1024) return NextResponse.json({ ok: false, error: `Files can be up to ${MAX_MEDIA_MB} MB` }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t read the upload" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
  if (!MEDIA_KINDS.includes(kind as MediaKind)) return NextResponse.json({ ok: false, error: "kind is invalid" }, { status: 400 });
  const k = kind as MediaKind;
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (!acceptedTypes(k).includes(type))
    return NextResponse.json({ ok: false, error: k === "music" ? "Use an MP3, M4A, WAV or OGG file" : k === "broll" ? "Use a photo (PNG, JPEG, WebP) or a clip (MP4, MOV, WebM)" : "Use a PNG, JPEG or WebP image" }, { status: 415 });
  if (file.size > limitFor(k) * 1024 * 1024) return NextResponse.json({ ok: false, error: `Files like this can be up to ${limitFor(k)} MB` }, { status: 413 });

  const id = newMediaId();
  try {
    await objects().put(mediaKey(id), new Uint8Array(await file.arrayBuffer()), type);
  } catch (e) {
    console.error("[media] upload failed", e);
    return NextResponse.json({ ok: false, error: "Couldn’t save the image" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, url: mediaUrl(id), storage: objects().kind });
}

/** Which store files go to, and whether stock footage is configured. */
export async function GET() {
  return NextResponse.json({ storage: objects().kind, stock: stockFootageEnabled() });
}
