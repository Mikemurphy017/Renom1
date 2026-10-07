import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * The ffmpeg binary: FFMPEG_PATH, else the one bundled by ffmpeg-static
 * (so production needs no system packages), else `ffmpeg` on PATH.
 */
let cached: string | undefined;
export function ffmpegPath(): string {
  if (cached) return cached;
  if (process.env.FFMPEG_PATH) return (cached = process.env.FFMPEG_PATH);
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static") as string | null;
    if (p && existsSync(p)) return (cached = p);
  } catch {
    /* fall through */
  }
  return (cached = "ffmpeg");
}

export interface RunResult {
  stdout: Buffer;
  stderr: string;
}

/** Run ffmpeg; `onTime` gets seconds of output written so far (from its progress lines). */
export function runFfmpeg(args: string[], opts: { onTime?: (sec: number) => void; captureStdout?: boolean } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (d: Buffer) => opts.captureStdout && out.push(d));
    child.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      err = (err + s).slice(-64_000);
      if (opts.onTime) {
        const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
        if (m) opts.onTime(+m[1] * 3600 + +m[2] * 60 + +m[3]);
      }
    });
    child.on("error", (e) => reject(new Error(`Couldn’t start the video engine (${(e as NodeJS.ErrnoException).code ?? e.message}).`)));
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: Buffer.concat(out), stderr: err });
      else reject(Object.assign(new Error(`ffmpeg exited with code ${code}`), { stderr: err }));
    });
  });
}

/**
 * Real length, frame size and frame rate of a file. MediaRecorder WebM often
 * has no duration in its header (and a nominal 1000 fps), so remux to nowhere
 * and read the last timestamp and the number of frames.
 */
export async function probe(file: string): Promise<{ durationSec: number; hasAudio: boolean; hasVideo: boolean; width: number; height: number; fps: number }> {
  // verbose: the end summary counts each stream's packets (the frame count).
  const { stderr } = await runFfmpeg(["-v", "verbose", "-i", file, "-map", "0", "-c", "copy", "-f", "null", "-"]);
  const times = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = times.at(-1);
  let durationSec = last ? +last[1] * 3600 + +last[2] * 60 + +last[3] : 0;
  if (!durationSec) {
    const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    if (d) durationSec = +d[1] * 3600 + +d[2] * 60 + +d[3];
  }
  // Frame size as decoded: phones store portrait MP4 as landscape plus a rotation.
  const size = /Stream #\d+:\d+.*: Video: .*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  let width = size ? +size[1] : 0;
  let height = size ? +size[2] : 0;
  if (/rotation of -?(90|270)\.00 degrees/.test(stderr)) [width, height] = [height, width];
  const frames = /Input stream #\d+:\d+ \(video\): (\d+) packets read/.exec(stderr);
  const fps = frames && durationSec > 0 ? +frames[1] / durationSec : 30;
  return { durationSec, hasAudio: /Stream #\d+:\d+.*: Audio:/.test(stderr), hasVideo: /Stream #\d+:\d+.*: Video:/.test(stderr), width, height, fps };
}
