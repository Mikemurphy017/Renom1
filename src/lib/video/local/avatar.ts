import { runFfmpeg } from "./ffmpeg";

/**
 * An avatar video take from the advisor's photos and their AI voice: each
 * photo holds for a few seconds with a slow push in or pull out framed on the
 * face, crossfading into the next, for as long as the voice speaks. The take
 * then goes through the normal AI edit (captions, graphics, covers, posting).
 */

const FPS = 30;
const FADE = 0.5;

export async function audioDuration(file: string): Promise<number> {
  const { stderr } = await runFfmpeg(["-i", file]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

export async function buildAvatarTake(o: { photos: string[]; audio: string; out: string; vertical: boolean }): Promise<{ durationSec: number; width: number; height: number }> {
  const [W, H] = o.vertical ? [1080, 1920] : [1920, 1080];
  const D = await audioDuration(o.audio);
  if (!D) throw new Error("The voice track couldn’t be read.");
  // A new photo every ~5 seconds, cycling through the ones chosen.
  const count = Math.max(1, Math.round(D / 5));
  const seg = count === 1 ? D + 0.2 : (D + (count - 1) * FADE) / count;
  const args = ["-y"];
  for (let i = 0; i < count; i++) args.push("-i", o.photos[i % o.photos.length]);
  args.push("-i", o.audio);
  const f: string[] = [];
  const frames = Math.ceil(seg * FPS);
  for (let i = 0; i < count; i++) {
    // Oversize first so the zoom never shows an edge; frame the upper-middle, where the face usually is.
    const z = i % 2 === 0 ? `min(1.0+0.10*on/${frames},1.10)` : `max(1.10-0.10*on/${frames},1.0)`;
    f.push(`[${i}:v]scale=${Math.round(W * 1.2)}:${Math.round(H * 1.2)}:force_original_aspect_ratio=increase,crop=${Math.round(W * 1.2)}:${Math.round(H * 1.2)},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih*0.4-(ih/zoom*0.4)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[p${i}]`);
  }
  let last = "p0";
  for (let i = 1; i < count; i++) {
    const offset = (seg - FADE) * i;
    f.push(`[${last}][p${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[x${i}]`);
    last = `x${i}`;
  }
  args.push(
    "-filter_complex", f.join(";"),
    "-map", `[${last}]`, "-map", `${count}:a`,
    "-t", D.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    o.out
  );
  await runFfmpeg(args);
  return { durationSec: Math.round(D * 100) / 100, width: W, height: H };
}

/**
 * The photo sent for a talking avatar, already in the video's shape: vertical
 * fills the frame (kept to the upper part, where the face is); wide puts the
 * portrait on a soft, blurred copy of itself.
 */
export async function prepareAvatarPhoto(input: string, out: string, vertical: boolean) {
  const filter = vertical
    ? "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)*0.3,setsar=1"
    : "split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=30:2,eq=brightness=-0.08[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,setsar=1";
  await runFfmpeg(["-y", "-i", input, "-frames:v", "1", "-filter_complex", filter, "-q:v", "2", out]);
}

/** The finished talking-avatar video at the studio's size, frame rate and sound format. */
export async function normalizeTalkingVideo(input: string, out: string, vertical: boolean): Promise<{ durationSec: number; width: number; height: number }> {
  const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
  await runFfmpeg([
    "-y", "-i", input,
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0b1526,setsar=1,fps=${FPS},format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", out,
  ]);
  const D = await audioDuration(out);
  if (!D) throw new Error("The avatar video couldn’t be read.");
  return { durationSec: Math.round(D * 100) / 100, width: W, height: H };
}
