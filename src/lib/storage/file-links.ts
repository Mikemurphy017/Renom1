import { timingSafeEqual } from "node:crypto";
import { sign } from "@/lib/secrets";

/**
 * Public links to a finished video or cover, for Buffer (and the networks) to
 * fetch: signed, and they expire a few days after the post time, so a post
 * scheduled weeks ahead still finds its file.
 */
const sig = (name: string) => sign("file-links", name).slice(0, 32);

/** `kind` v = rendered video (upload id), c = cover image (media id). */
export function fileLink(origin: string, kind: "v" | "c", id: string, until: number, ext: string) {
  const name = `${kind}-${id}-${Math.floor(until / 1000).toString(36)}`;
  return `${origin}/api/social/file/${name}-${sig(name)}.${ext}`;
}

export function readFileLink(file: string): { kind: "v" | "c"; id: string } | null {
  const m = /^([vc])-([a-z0-9]{6,40})-([a-z0-9]{1,10})-([a-f0-9]{32})\.[a-z0-9]{2,5}$/.exec(file);
  if (!m) return null;
  const name = `${m[1]}-${m[2]}-${m[3]}`;
  let want: Buffer;
  try {
    want = Buffer.from(sig(name));
  } catch {
    return null;
  }
  const got = Buffer.from(m[4]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (parseInt(m[3], 36) * 1000 < Date.now()) return null;
  return { kind: m[1] as "v" | "c", id: m[2] };
}
