import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { VoiceError, speak } from "@/lib/voice/server";
import { buildAvatarTake } from "@/lib/video/local/avatar";
import { getProcessor } from "@/lib/video/processor";
import { saveUpload, updateUpload } from "@/lib/video/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Avatar videos per advisor per hour (each one costs voice time and a render). */
const PER_HOUR = 6;
const recent = new Map<string, number[]>();

/**
 * Makes an avatar take: the script in the advisor's AI voice over their photos.
 * Body: { text, photoIds: media ids (1–6), vertical, videoId }. Returns the
 * stored take, ready for the AI edit.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("AI avatar videos");
  const b = (await request.json().catch(() => null)) as { text?: unknown; photoIds?: unknown; vertical?: unknown; videoId?: unknown } | null;
  const text = typeof b?.text === "string" ? b.text.replace(/\s+/g, " ").trim().slice(0, 4500) : "";
  const ids = Array.isArray(b?.photoIds) ? b.photoIds.filter(isMediaId).slice(0, 6) : [];
  const videoId = typeof b?.videoId === "string" && /^[\w-]{1,40}$/.test(b.videoId) ? b.videoId : undefined;
  if (text.length < 20) return NextResponse.json({ ok: false, error: "The script is too short to read." }, { status: 400 });
  if (!ids.length) return NextResponse.json({ ok: false, error: "Pick at least one photo of you." }, { status: 400 });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= PER_HOUR) return NextResponse.json({ ok: false, error: `That’s ${PER_HOUR} avatar videos this hour. Try again a little later.` }, { status: 429 });
  recent.set(user.id, [...mine, now]);

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-avatar-"));
  try {
    const photos: string[] = [];
    for (const [i, id] of ids.entries()) {
      const r = await objects().read(mediaKey(id)).catch(() => null);
      if (!r) continue;
      if (!/^image\/(jpeg|png|webp)$/.test(r.contentType)) {
        void r.body.cancel().catch(() => {});
        continue;
      }
      const file = path.join(dir, `photo${i}`);
      await fs.writeFile(file, new Uint8Array(await new Response(r.body).arrayBuffer()));
      photos.push(file);
    }
    if (!photos.length) return NextResponse.json({ ok: false, error: "Those photos couldn’t be read. Pick others." }, { status: 400 });

    const audio = path.join(dir, "voice.mp3");
    await fs.writeFile(audio, await speak(user, text));
    const out = path.join(dir, "avatar.mp4");
    const take = await buildAvatarTake({ photos, audio, out, vertical: b?.vertical !== false });
    const size = (await fs.stat(out)).size;
    const rec = await saveUpload({ filename: "avatar.mp4", mimeType: "video/mp4", size, durationSec: take.durationSec, videoId }, out);
    const processor = await getProcessor();
    const { remoteId } = await processor.upload(rec, out);
    await updateUpload(rec.id, { remoteId });
    return NextResponse.json({ ok: true, take: { sourceId: rec.id, url: `/api/video/files/${rec.id}`, mimeType: "video/mp4", durationSec: take.durationSec, width: take.width, height: take.height, recordedAt: new Date().toISOString() } });
  } catch (e) {
    recent.set(user.id, (recent.get(user.id) ?? []).filter((t) => t !== now));
    if (e instanceof VoiceError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[avatar]", e);
    return NextResponse.json({ ok: false, error: "Couldn’t make the avatar video. Please try again." }, { status: 500 });
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
