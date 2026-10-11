import { promises as fs } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";

/**
 * Put the cover at the very start of a rendered video, so the networks that
 * show the first frame (and Buffer's frame picker) show the cover, and the
 * advisor never has to add a thumbnail by hand.
 *
 * Fast path: the cover becomes a short clip encoded exactly like render.ts
 * encodes, and the two are joined without re-encoding the video (well under a
 * second). If the two clips' H.264 or audio settings don't match, the whole
 * thing is re-encoded instead.
 */

/** How long the cover holds before the video starts. */
export const INTRO_SEC = 0.5;

export interface Rendered {
  width: number;
  height: number;
  fps: number;
}

/** Frame size and rate of a rendered MP4 (as render.ts writes it: 30 or 60 fps). */
export async function readRendered(file: string): Promise<Rendered> {
  const { stderr } = await runFfmpeg(["-i", file], {}).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const v = /Stream #\d+:\d+.*: Video: .*?(\d{2,5})x(\d{2,5}).*?(\d+(?:\.\d+)?) fps/.exec(stderr);
  if (!v) throw new Error("That video couldn’t be read.");
  return { width: +v[1], height: +v[2], fps: Math.round(+v[3]) >= 50 ? 60 : 30 };
}

const encodeArgs = (fps: number, W: number, H: number) => [
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(fps),
  "-threads:v", W * H > 2_100_000 ? "8" : "16",
  "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
];

const coverFilter = (W: number, H: number, fps: number, bt709: boolean) =>
  `scale=${W}:${H}:force_original_aspect_ratio=increase${bt709 ? ":out_color_matrix=bt709" : ""},crop=${W}:${H},setsar=1,fps=${fps},format=yuv420p`;

/** The SPS and PPS of a file's video, which must match for a join without re-encoding. */
async function paramSets(file: string): Promise<Buffer> {
  const { stdout } = await runFfmpeg(["-v", "error", "-i", file, "-map", "0:v:0", "-c", "copy", "-bsf:v", "h264_mp4toannexb", "-frames:v", "1", "-f", "h264", "-"], { captureStdout: true });
  const parts: Buffer[] = [];
  let i = 0;
  const starts: number[] = [];
  while (i < stdout.length - 3) {
    if (stdout[i] === 0 && stdout[i + 1] === 0 && (stdout[i + 2] === 1 || (stdout[i + 2] === 0 && stdout[i + 3] === 1))) {
      const len = stdout[i + 2] === 1 ? 3 : 4;
      starts.push(i + len);
      i += len;
    } else i++;
  }
  starts.forEach((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] - 3 : stdout.length;
    const type = stdout[s] & 0x1f;
    if (type === 7 || type === 8) parts.push(stdout.subarray(s, end));
  });
  return Buffer.concat(parts);
}

/**
 * Encoder options that tag the intro with the same colour info (range,
 * primaries, transfer, matrix, chroma siting) the video's SPS carries, so the
 * two can be joined as they are. A take from a phone and one from a webcam tag
 * these differently, and render.ts passes the take's tags through.
 */
async function colourArgs(file: string): Promise<{ args: string[]; bt709: boolean }> {
  const { stderr } = await runFfmpeg(["-i", file, "-map", "0:v:0", "-c", "copy", "-bsf:v", "filter_units=pass_types=7-8,trace_headers", "-frames:v", "1", "-f", "null", "-"]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const field = (name: string) => {
    const m = new RegExp(`\\b${name}\\s+[01]+ = (\\d+)`).exec(stderr);
    return m ? +m[1] : undefined;
  };
  const args: string[] = [];
  let bt709 = false;
  if (field("video_signal_type_present_flag") === 1) {
    args.push("-color_range", field("video_full_range_flag") === 1 ? "pc" : "tv");
    if (field("colour_description_present_flag") === 1) {
      const matrix = field("matrix_coefficients") ?? 2;
      bt709 = matrix === 1;
      args.push("-color_primaries", String(field("colour_primaries") ?? 2), "-color_trc", String(field("transfer_characteristics") ?? 2), "-colorspace", String(matrix));
    }
  }
  const loc = field("chroma_loc_info_present_flag") === 1 ? field("chroma_sample_loc_type_top_field") : undefined;
  // FFmpeg's chroma locations are H.264's types plus one; 0 is "not set".
  args.push("-chroma_sample_location", loc === undefined ? "0" : String(loc + 1));
  return { args, bt709 };
}

/** "aac (LC) … 48000 Hz, stereo" for a file's audio, or null if it has none. */
async function audioFormat(file: string): Promise<string | null> {
  const { stderr } = await runFfmpeg(["-i", file]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const m = /Stream #\d+:\d+.*: Audio: (\w+)[^,]*, (\d+) Hz, ([\w.]+)/.exec(stderr);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : null;
}

export async function prependCover(o: { video: string; cover: string; out: string; workDir: string; onProgress?: (p: number) => void }): Promise<{ durationSec: number; joined: "copy" | "encode" }> {
  const { width: W, height: H, fps } = await readRendered(o.video);
  const d = INTRO_SEC.toFixed(2);
  const introMp4 = path.join(o.workDir, "intro.mp4");
  const colour = await colourArgs(o.video);
  await runFfmpeg([
    "-y", "-loop", "1", "-framerate", String(fps), "-t", d, "-i", o.cover,
    "-f", "lavfi", "-t", d, "-i", "anullsrc=r=48000:cl=stereo",
    "-vf", coverFilter(W, H, fps, colour.bt709),
    "-map", "0:v", "-map", "1:a", "-t", d,
    ...encodeArgs(fps, W, H),
    ...colour.args,
    introMp4,
  ]);
  o.onProgress?.(0.2);

  let joined: "copy" | "encode" = "encode";
  // Same H.264 parameter sets and the same audio format: the files can be joined as they are.
  const [a, b, aa, ab] = await Promise.all([paramSets(introMp4), paramSets(o.video), audioFormat(introMp4), audioFormat(o.video)]).catch(() => [null, null, null, null]);
  if (a && b && a.length && a.equals(b) && aa && aa === ab) {
    try {
      const list = path.join(o.workDir, "join.txt");
      await fs.writeFile(list, [introMp4, o.video].map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
      await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", list, "-map", "0", "-c", "copy", "-movflags", "+faststart", o.out]);
      joined = "copy";
    } catch (e) {
      console.warn("[video] cover join without re-encoding failed, re-encoding:", (e as { stderr?: string }).stderr?.slice(-500) || e);
    }
  }
  if (joined === "encode") {
    await runFfmpeg(
      [
        "-y", "-i", introMp4, "-i", o.video,
        "-filter_complex", `[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]`,
        "-map", "[v]", "-map", "[a]",
        ...encodeArgs(fps, W, H),
        "-movflags", "+faststart", o.out,
      ],
      { onTime: () => o.onProgress?.(0.6) }
    );
  }
  o.onProgress?.(0.9);
  const { stderr } = await runFfmpeg(["-i", o.out]).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }));
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const durationSec = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
  return { durationSec: Math.round(durationSec * 100) / 100, joined };
}
