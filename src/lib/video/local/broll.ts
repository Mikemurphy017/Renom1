import { promises as fs } from "node:fs";
import path from "node:path";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import type { Aspect } from "../types";
import type { Beat } from "./ass";

/**
 * Footage for b-roll cutaways: the advisor's own library first (photos and
 * clips they uploaded), then stock footage from Pexels when PEXELS_API_KEY is
 * set. Everything is downloaded into the render's work folder.
 */

export interface Clip {
  file: string;
  kind: "video" | "image";
}

const MAX_BYTES = 60 * 1024 * 1024;

async function fromLibrary(ids: string[], dir: string): Promise<Clip[]> {
  const out: Clip[] = [];
  for (const id of ids.filter(isMediaId).slice(0, 12)) {
    const r = await objects().read(mediaKey(id)).catch(() => null);
    if (!r) continue;
    const kind = r.contentType.startsWith("video/") ? "video" : r.contentType.startsWith("image/") ? "image" : null;
    if (!kind) continue;
    const file = path.join(dir, `lib-${id}`);
    await fs.writeFile(file, new Uint8Array(await new Response(r.body).arrayBuffer()));
    out.push({ file, kind });
  }
  return out;
}

interface PexelsVideo {
  duration: number;
  video_files: { link: string; width: number; height: number; file_type: string }[];
}

async function fromPexels(query: string, aspect: Aspect, dir: string, n: number): Promise<Clip | null> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key || !query) return null;
  const orientation = aspect === "9:16" ? "portrait" : "landscape";
  try {
    const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=medium&per_page=6`, { headers: { Authorization: key }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const body = (await res.json()) as { videos?: PexelsVideo[] };
    const target = aspect === "9:16" ? 1080 : 1920;
    for (const v of body.videos ?? []) {
      if (v.duration < 2) continue;
      const files = v.video_files.filter((f) => f.file_type === "video/mp4" && f.width && f.height && (aspect === "9:16" ? f.height >= f.width : f.width >= f.height));
      const best = files.sort((a, b) => Math.abs(Math.max(a.width, a.height) - target) - Math.abs(Math.max(b.width, b.height) - target))[0];
      if (!best) continue;
      const clip = await fetch(best.link, { signal: AbortSignal.timeout(30_000) });
      const len = Number(clip.headers.get("content-length") ?? 0);
      if (!clip.ok || len > MAX_BYTES) continue;
      const bytes = new Uint8Array(await clip.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) continue;
      const file = path.join(dir, `pexels-${n}.mp4`);
      await fs.writeFile(file, bytes);
      return { file, kind: "video" };
    }
  } catch (e) {
    console.warn(`[video] stock footage for "${query}" unavailable:`, (e as Error).message);
  }
  return null;
}

export const stockFootageEnabled = () => !!process.env.PEXELS_API_KEY?.trim();

/** A clip for every b-roll moment we can fill; moments without one just get their keyword card. */
export async function footageFor(beats: Beat[], libraryIds: string[], aspect: Aspect, dir: string): Promise<Map<Beat, Clip>> {
  const out = new Map<Beat, Clip>();
  const wanted = beats.filter((b) => b.broll);
  if (!wanted.length) return out;
  const library = await fromLibrary(libraryIds, dir);
  let li = 0;
  for (const [n, b] of wanted.entries()) {
    const stock = library.length ? null : await fromPexels(b.query ?? b.keyword, aspect, dir, n);
    const clip = stock ?? (library.length ? library[li++ % library.length] : null);
    if (clip) out.set(b, clip);
  }
  return out;
}
