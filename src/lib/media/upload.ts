"use client";

import type { MediaKind } from "@/lib/storage/media-types";

export interface UploadedImage {
  id: string;
  url: string;
  storage: "bucket" | "disk";
}

/** Shrink big photos before upload: covers never need more than this. */
async function downscale(file: Blob, max = 1800): Promise<Blob> {
  if (file.size < 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn’t read that image"))), "image/jpeg", 0.9));
  } catch {
    return file;
  }
}

/** Save an image to platform storage. */
export async function uploadImage(file: Blob, kind: MediaKind, name = "image"): Promise<UploadedImage> {
  const blob = kind === "headshot" ? await downscale(file) : file;
  const form = new FormData();
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  form.append("file", new File([blob], `${name}.${ext}`, { type: blob.type || "image/jpeg" }));
  form.append("kind", kind);
  const res = await fetch("/api/media", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) throw new Error(body.error || `Upload failed (${res.status})`);
  return body as UploadedImage;
}

/** Seven-day public https link for a stored file (/api/video/files/… or /api/media/…), or null on local disk. */
export async function publicLinkFor(path: string): Promise<string | null> {
  if (!/^\/api\/(video\/files|media)\/[a-z0-9]+$/.test(path)) return null;
  try {
    const res = await fetch(`${path}/link`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    return res.ok && body.ok ? (body.url as string) : null;
  } catch {
    return null;
  }
}
