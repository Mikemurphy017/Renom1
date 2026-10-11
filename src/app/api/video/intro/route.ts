import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { downloadTo } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import { prependCover, INTRO_SEC } from "@/lib/video/local/intro";
import { downloadUpload, getUpload, isStorageId, saveUpload } from "@/lib/video/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// One at a time, like the editor's own jobs, so a small server stays responsive.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Put the cover at the start of a rendered video.
 * Body: { outputId (the render from Edit, without a cover), coverId (media id of the cover image) }.
 * Answers with the new file; the original render is kept, so the cover can be changed or removed.
 */
export async function POST(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as { outputId?: unknown; coverId?: unknown } | null;
  if (!b || !isStorageId(b.outputId) || !isMediaId(b.coverId)) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  const source = await getUpload(b.outputId);
  if (!source || !source.mimeType.includes("mp4")) return NextResponse.json({ ok: false, error: "That video wasn’t found. Finish the edit again." }, { status: 404 });
  if (source.coverIntro) return NextResponse.json({ ok: false, error: "That video already starts on a cover." }, { status: 400 });
  const coverId = b.coverId;

  const job = queue.then(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "renom-cover-"));
    try {
      const video = path.join(dir, "video.mp4");
      const cover = path.join(dir, "cover");
      await downloadUpload(source, video);
      if (!(await downloadTo(mediaKey(coverId), cover))) throw new Error("That cover image wasn’t found.");
      const out = path.join(dir, "final-cover.mp4");
      const t = Date.now();
      const r = await prependCover({ video, cover, out, workDir: dir });
      console.info(`[video] cover intro for ${source.id}: ${r.joined} in ${Date.now() - t} ms`);
      const { size } = await fs.stat(out);
      return await saveUpload({ filename: "video.mp4", mimeType: "video/mp4", size, durationSec: r.durationSec, videoId: source.videoId, coverIntro: { coverId, from: source.id } }, out);
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
  queue = job.catch(() => {});
  try {
    const rec = await job;
    return NextResponse.json({ ok: true, output: { id: rec.id, url: `/api/video/files/${rec.id}`, durationSec: rec.durationSec, sizeBytes: rec.size }, introSec: INTRO_SEC });
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr;
    console.error("[video] cover intro failed:", stderr?.slice(-1500) ?? e);
    return NextResponse.json({ ok: false, error: stderr ? "The video engine couldn’t add the cover." : (e as Error).message }, { status: 502 });
  }
}
