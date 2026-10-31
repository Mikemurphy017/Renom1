"use client";

/** A video file's type, from the browser or its name (some systems leave MOV files untyped). */
export function videoType(f: File) {
  const t = f.type.split(";")[0].trim().toLowerCase();
  if (t) return t === "video/x-m4v" ? "video/mp4" : t;
  const ext = f.name.toLowerCase().split(".").pop();
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : ext === "mp4" || ext === "m4v" ? "video/mp4" : "";
}

/** Length and size of a video file, when this browser can read it (some MOV files it can't; the edit still can). */
export function readVideoMeta(f: File): Promise<{ durationSec: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(f);
    const done = (r: { durationSec: number; width: number; height: number } | null) => {
      clearTimeout(t);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve(r);
    };
    const t = setTimeout(() => done(null), 10_000);
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(v.videoWidth ? { durationSec: Number.isFinite(v.duration) ? Math.round(v.duration) : 0, width: v.videoWidth, height: v.videoHeight } : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}
