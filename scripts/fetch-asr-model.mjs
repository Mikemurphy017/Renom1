#!/usr/bin/env node
/**
 * Downloads the speech-recognition model the video editor uses for word-accurate
 * captions (sherpa-onnx zipformer, trained on GigaSpeech: podcasts and YouTube).
 * Keeps only the int8 files (~71 MB). Runs on `npm install`; never fails the
 * install, because the editor falls back to timing captions from the audio alone.
 *
 *   node scripts/fetch-asr-model.mjs [--force]
 *   ASR_MODEL_DIR=… overrides where it goes (default .models/asr-gigaspeech)
 *   SKIP_ASR_MODEL=1 skips the download
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const NAME = "sherpa-onnx-zipformer-gigaspeech-2023-12-12";
const URL = `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${NAME}.tar.bz2`;
const FILES = ["encoder-epoch-30-avg-1.int8.onnx", "decoder-epoch-30-avg-1.int8.onnx", "joiner-epoch-30-avg-1.int8.onnx", "tokens.txt"];
const dir = path.resolve(process.env.ASR_MODEL_DIR || ".models/asr-gigaspeech");

export async function fetchModel({ force = false, log = console.log } = {}) {
  if (!force && FILES.every((f) => existsSync(path.join(dir, f)))) return dir;
  const bz2 = require("unbzip2-stream");
  const tar = require("tar-stream");
  const tmp = `${dir}.partial`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  log(`[asr] downloading speech model (${NAME})…`);
  const res = await fetch(URL);
  if (!res.ok || !res.body) throw new Error(`download failed: ${res.status}`);
  const extract = tar.extract();
  const found = new Set();
  extract.on("entry", (header, stream, next) => {
    const base = path.basename(header.name);
    if (header.type === "file" && FILES.includes(base)) {
      found.add(base);
      pipeline(stream, createWriteStream(path.join(tmp, base))).then(() => next(), next);
    } else {
      stream.on("end", next);
      stream.resume();
    }
  });
  await pipeline(Readable.fromWeb(res.body), bz2(), extract);
  const missing = FILES.filter((f) => !found.has(f));
  if (missing.length) throw new Error(`model archive is missing ${missing.join(", ")}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.dirname(dir), { recursive: true });
  renameSync(tmp, dir);
  log(`[asr] speech model ready in ${path.relative(process.cwd(), dir) || dir}`);
  return dir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.SKIP_ASR_MODEL === "1") process.exit(0);
  fetchModel({ force: process.argv.includes("--force") }).catch((e) => {
    console.warn(`[asr] couldn't fetch the speech model (${e.message}). Captions will be timed from the audio instead.`);
  });
}
