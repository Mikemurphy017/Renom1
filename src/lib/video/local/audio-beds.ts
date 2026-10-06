/**
 * Royalty-free background music beds and sound effects, synthesized from
 * scratch with ffmpeg (lavfi `aevalsrc` expressions + stock filters). Nothing
 * is downloaded and no third-party audio is used, so every output is ours.
 *
 * Beds are 32 s seamless loops (44.1 kHz stereo WAV, ~-20 LUFS) meant to sit
 * quietly under a talking head and be looped with `-stream_loop -1`.
 *
 * How the loop stays seamless: every oscillator, envelope and pattern is a
 * function of T = t mod 32 (notes use their own local time, free-running
 * oscillators use frequencies that complete whole cycles in 32 s), so the
 * signal is exactly periodic. We render 8 s of pre-roll + 32 s and keep the
 * last 32 s, so filter/echo state at the start of the kept window already
 * holds the tail of the previous loop. Noise is not periodic, but its
 * envelopes are, which is inaudible at the seam.
 *
 * Results are cached in os.tmpdir()/renom-audio/ (written to a temp file and
 * renamed into place), and concurrent calls for the same asset share one render.
 */
import { randomBytes } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runFfmpeg } from "./ffmpeg";

export type MusicMood = "calm" | "uplift" | "pulse" | "cinematic";

export const MUSIC_MOODS: { id: MusicMood; label: string; description: string }[] = [
  { id: "calm", label: "Calm — soft piano-like pads", description: "Slow warm pads with gentle electric-piano notes. No drums. Reassuring and unobtrusive." },
  { id: "uplift", label: "Uplift — bright plucked arpeggios", description: "Optimistic plucked arpeggios over soft pads, a light kick and shaker. Friendly and forward-moving." },
  { id: "pulse", label: "Pulse — modern minimal groove", description: "Minimal sub-bass pulse, soft kick and clap, filtered hats and a sidechained pad. Contemporary and focused." },
  { id: "cinematic", label: "Cinematic — slow swells and drones", description: "Low drone with slowly swelling detuned pads and a soft boom every 8 s, in a wide reverb. Thoughtful and serious." },
];

export type SfxKind = "whoosh" | "pop" | "riser" | "hit";

const VERSION = "v1";
const SR = 44100;
const LOOP_SEC = 32;
const PREROLL_SEC = 8;
const BED_TARGET_LUFS = -20;
const BED_PEAK_CEIL_DB = -1.5;
const SFX_PEAK_DB = -6;

/* ------------------------------------------------------------------ */
/* Expression helpers                                                  */
/* ------------------------------------------------------------------ */
// aevalsrc variables (0..9, persistent across samples, one set per channel):
// 0 T (time in loop) · 1 local time u · 2 chord index · 3 step / prev chord ·
// 4 envelope / crossfade · 5 frequency / filter coef · 6 scratch / filter state ·
// 7 vibrato / filter state · 8 phase · 9 noise seed

const PI = Math.PI;
const TAU = 2 * Math.PI;

/** Compact number literal for expressions (parenthesized when negative). */
function num(x: number): string {
  let s = x.toFixed(6);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return x < 0 && s !== "0" ? `(${s})` : s;
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
/** Snap a frequency so it completes whole cycles in the loop (for free-running oscillators). */
const loopHz = (f: number) => Math.round(f * LOOP_SEC) / LOOP_SEC;

/** Nested if() picking items[ld(v)]; ffmpeg evaluates only the chosen branch. */
function sel(v: number, items: string[]): string {
  if (items.length === 1) return items[0];
  let out = items[items.length - 1];
  for (let i = items.length - 2; i >= 0; i--) out = `if(eq(ld(${v}),${i}),${items[i]},${out})`;
  return out;
}

/** T = loop time; offset so the kept window (after the pre-roll) starts on the downbeat of the first chord. */
const PRE = `st(0,mod(t+${LOOP_SEC - PREROLL_SEC},${LOOP_SEC}));`;
/** Seed the noise generator differently per channel on the first sample. */
const seed = (s: number) => `if(eq(n,0),st(9,${s}));`;
const NOISE = "(2*random(9)-1)";

interface PadOpts {
  /** MIDI notes per chord (4 chords, cycled). */
  chords: number[][];
  chordSec: number;
  xfadeSec: number;
  /** Voices in this channel as [detune ratio, amplitude]. */
  voices: [number, number][];
  /** Harmonic amplitudes, [1, a2, a3, ...]. */
  partials: number[];
  /** Vibrato depth as a frequency ratio (4.5 Hz). */
  vib: number;
  /** Optional multiplier expression (may use ld(0) = T). */
  ampMod?: string;
}

/** Sustained chords with an equal-power crossfade from the previous chord. */
function padExpr(o: PadOpts): string {
  const cs = num(o.chordSec);
  const wave = o.partials.map((a, i) => `${a === 1 ? "" : num(a) + "*"}sin(${i === 0 ? "" : i + 1 + "*"}ld(8))`).join("+");
  const chord = (midis: number[], u: string) =>
    midis
      .flatMap((m) =>
        o.voices.map(([d, amp]) => {
          const f = midiHz(m) * d;
          return `${amp === 1 ? "" : num(amp) + "*"}(st(8,${num(TAU * f)}*${u}+${num((f * o.vib) / 4.5)}*ld(7));${wave})`;
        }),
      )
      .join("+");
  const cur = sel(2, o.chords.map((c) => chord(c, "ld(1)")));
  const prev = sel(3, o.chords.map((c) => chord(c, `(ld(1)+${cs})`)));
  const n = o.chords.length;
  return (
    PRE +
    `st(1,mod(ld(0),${cs}));st(2,mod(floor(ld(0)/${cs}),${n}));st(3,mod(ld(2)+${n - 1},${n}));` +
    `st(7,sin(${num(TAU * 4.5)}*ld(0)));st(4,clip(ld(1)/${num(o.xfadeSec)},0,1));` +
    `(sin(${num(PI / 2)}*ld(4))*(${cur})+if(lt(ld(4),1),cos(${num(PI / 2)}*ld(4))*(${prev}),0))` +
    (o.ampMod ? `*(${o.ampMod})` : "")
  );
}

interface PluckOpts {
  /** Four MIDI tones per chord; the pattern indexes into them. */
  tones: number[][];
  pattern: number[];
  stepSec: number;
  chordSec: number;
  decay: number;
  /** -1 left-leaning ping-pong start, +1 right, 0 centered. */
  pan: number;
}

/** Plucked / electric-piano-like notes on a step grid. */
function pluckExpr(o: PluckOpts): string {
  const st = num(o.stepSec);
  const tone = sel(6, o.pattern.map(String));
  const freq = sel(2, o.tones.map((ts) => sel(6, ts.map((m) => num(midiHz(m))))));
  const panAmt = o.pan === 0 ? "1" : `(0.72+${num(0.28 * o.pan)}*cos(${num(PI)}*ld(3)))`;
  return (
    PRE +
    `st(3,floor(ld(0)/${st}));st(1,ld(0)-ld(3)*${st});st(2,mod(floor(ld(0)/${num(o.chordSec)}),${o.tones.length}));` +
    `st(6,mod(ld(3),${o.pattern.length}));st(6,${tone});st(5,${freq});st(8,${num(TAU)}*ld(5)*ld(1));` +
    `st(4,min(1,ld(1)/0.003)*exp(${num(-o.decay)}*ld(1))*clip((${st}-ld(1))/0.02,0,1)*(0.82+0.18*eq(mod(ld(3),4),0)));` +
    `ld(4)*${panAmt}*(sin(ld(8))+0.3*exp(-5*ld(1))*sin(2*ld(8))+0.1*exp(-9*ld(1))*sin(3*ld(8)))`
  );
}

/**
 * Percussive hits on a step grid. `accents` cycles per step (0 = silent);
 * `body` is an expression of u = ld(1) (time since the hit) and may use noise.
 */
function hitsExpr(stepSec: number, accents: number[], body: string, offsetSec = 0, seedVal = 0): string {
  const st = num(stepSec);
  const tt = offsetSec ? `mod(ld(0)+${num(LOOP_SEC - offsetSec)},${LOOP_SEC})` : "ld(0)";
  return (
    PRE +
    (seedVal ? seed(seedVal) : "") +
    `st(6,${tt});st(3,floor(ld(6)/${st}));st(1,ld(6)-ld(3)*${st});st(3,mod(ld(3),${accents.length}));` +
    `st(4,${sel(3, accents.map((a) => num(a)))});ld(4)*(${body})*clip((${st}-ld(1))/0.01,0,1)`
  );
}

/** Pitch-dropping sine thump (kick / boom). */
function thump(f0: number, f1: number, rate: number, decay: number, attack = 0.002): string {
  return `sin(${num(TAU)}*(${num(f1)}*ld(1)+${num((f0 - f1) / rate)}*(1-exp(${num(-rate)}*ld(1)))))*exp(${num(-decay)}*ld(1))*min(1,ld(1)/${num(attack)})`;
}

const noiseBurst = (attack: number, decay: number) => `${NOISE}*min(1,ld(1)/${num(attack)})*exp(${num(-decay)}*ld(1))`;

/* ------------------------------------------------------------------ */
/* Graph assembly                                                      */
/* ------------------------------------------------------------------ */

interface Stem {
  /** One expression (mono) or [left, right]. */
  expr: string | [string, string];
  /** Filters applied to the stem (comma-separated chain, may be empty). */
  filters?: string;
  gain: number;
  /** Mono stems: left/right gains for placement. */
  pan?: [number, number];
  /** Route through the reverb bus. */
  send?: boolean;
  /** Synthesis sample rate (cheaper for band-limited stems); resampled to 44.1 kHz. */
  sr?: number;
}

interface Reverb {
  left: string;
  right: string;
}

const ROOM: Reverb = {
  left: "aecho=0.8:0.8:47|89|163|241:0.3|0.24|0.18|0.12,aecho=0.9:0.9:31|73:0.25|0.16",
  right: "aecho=0.8:0.8:53|97|151|263:0.3|0.24|0.18|0.12,aecho=0.9:0.9:37|79:0.25|0.16",
};
const HALL: Reverb = {
  left: "aecho=0.7:0.8:97|181|331|557|811:0.36|0.3|0.24|0.18|0.12,aecho=0.9:0.9:43|113|211:0.3|0.22|0.14",
  right: "aecho=0.7:0.8:107|193|353|521|877:0.36|0.3|0.24|0.18|0.12,aecho=0.9:0.9:47|127|199:0.3|0.22|0.14",
};

function buildGraph(stems: Stem[], durSec: number, reverb: Reverb | null, master: string, trim: [number, number] | null): string {
  const parts: string[] = [];
  const wet: string[] = [];
  const dry: string[] = [];
  stems.forEach((s, i) => {
    const exprs = typeof s.expr === "string" ? s.expr : s.expr.join("|");
    const chain = [`aevalsrc=exprs='${exprs}':s=${s.sr ?? SR}:d=${num(durSec)}`];
    if (s.filters) chain.push(s.filters);
    if (s.sr && s.sr !== SR) chain.push(`aresample=${SR}`);
    if (typeof s.expr === "string") {
      const [l, r] = s.pan ?? [1, 1];
      chain.push(`pan=stereo|c0=${num(l * s.gain)}*c0|c1=${num(r * s.gain)}*c0`);
    } else {
      chain.push(`volume=${num(s.gain)}`);
    }
    parts.push(`${chain.join(",")}[s${i}]`);
    (s.send && reverb ? wet : dry).push(`[s${i}]`);
  });
  const mix = (ins: string[], out: string) =>
    ins.length === 1 ? `${ins[0]}anull[${out}]` : `${ins.join("")}amix=inputs=${ins.length}:normalize=0[${out}]`;
  if (wet.length && reverb) {
    parts.push(mix(wet, "wetin"));
    parts.push(`[wetin]channelsplit=channel_layout=stereo[wl][wr]`);
    parts.push(`[wl]${reverb.left}[wl2]`);
    parts.push(`[wr]${reverb.right}[wr2]`);
    parts.push(`[wl2][wr2]join=inputs=2:channel_layout=stereo[wet]`);
    dry.push("[wet]");
  }
  const tail = [master];
  if (trim) tail.push(`atrim=start_sample=${trim[0]}:end_sample=${trim[1]}`, "asetpts=N/SR/TB");
  tail.push("ebur128=peak=sample:framelog=quiet");
  parts.push(`${dry.join("")}amix=inputs=${dry.length}:normalize=0,${tail.filter(Boolean).join(",")}[out]`);
  return parts.join(";");
}

/* ------------------------------------------------------------------ */
/* Music beds                                                          */
/* ------------------------------------------------------------------ */

// I–V–vi–IV in C, smooth voice leading around middle C.
const POP_PAD = [
  [52, 55, 60], // C: E3 G3 C4
  [50, 55, 59], // G: D3 G3 B3
  [52, 57, 60], // Am: E3 A3 C4
  [53, 57, 60], // F: F3 A3 C4
];
const POP_BASS = [[36], [43], [45], [41]]; // C2 G2 A2 F2
const POP_TONES = [
  [60, 64, 67, 72],
  [59, 62, 67, 71],
  [57, 60, 64, 69],
  [57, 60, 65, 69],
];
const WARM = [1, 0.18, 0.06];

/**
 * Stereo pad: each side has a centered voice plus a detuned one (opposite
 * detune left vs right) for width. The shared center voice keeps the mono
 * fold-down (phone speakers) from beating down to silence.
 */
function stereoPad(o: Omit<PadOpts, "voices">, spread: number, side = 0.5): [string, string] {
  const vs = (sign: number): [number, number][] => [
    [1, 1],
    [1 + sign * spread, side],
  ];
  return [padExpr({ ...o, voices: vs(-1) }), padExpr({ ...o, voices: vs(1) })];
}

function bedStems(mood: MusicMood): { stems: Stem[]; reverb: Reverb } {
  switch (mood) {
    case "calm": {
      // 60 BPM, one chord per 4 s bar; pads + soft electric-piano broken chords.
      return {
        reverb: ROOM,
        stems: [
          {
            expr: stereoPad({ chords: POP_PAD, chordSec: 4, xfadeSec: 1.6, partials: WARM, vib: 0.0025 }, 0.0015),
            filters: "lowpass=f=1800,lowpass=f=2400",
            gain: 0.16,
            sr: 11025,
            send: true,
          },
          {
            expr: padExpr({ chords: POP_BASS, chordSec: 4, xfadeSec: 1.2, voices: [[1, 1]], partials: [1, 0.12], vib: 0 }),
            filters: "lowpass=f=400",
            gain: 0.22,
            sr: 11025,
          },
          {
            expr: [
              pluckExpr({ tones: POP_TONES, pattern: [0, 2, 3, 2], stepSec: 1, chordSec: 4, decay: 2.6, pan: -0.6 }),
              pluckExpr({ tones: POP_TONES, pattern: [0, 2, 3, 2], stepSec: 1, chordSec: 4, decay: 2.6, pan: 0.6 }),
            ],
            filters: "lowpass=f=2600",
            gain: 0.13,
            sr: 22050,
            send: true,
          },
        ],
      };
    }
    case "uplift": {
      // 120 BPM, chord every 2 bars (4 s); 8th-note plucked arpeggio, kick on every beat, offbeat shaker.
      const arp = [0, 1, 2, 3, 1, 2, 3, 2];
      return {
        reverb: ROOM,
        stems: [
          {
            expr: stereoPad({ chords: POP_PAD, chordSec: 4, xfadeSec: 0.8, partials: WARM, vib: 0.002 }, 0.0015),
            filters: "lowpass=f=2400",
            gain: 0.09,
            sr: 11025,
            send: true,
          },
          {
            expr: padExpr({ chords: POP_BASS, chordSec: 4, xfadeSec: 0.4, voices: [[1, 1]], partials: [1, 0.2], vib: 0 }),
            filters: "lowpass=f=450",
            gain: 0.2,
            sr: 11025,
          },
          {
            expr: [
              pluckExpr({ tones: POP_TONES, pattern: arp, stepSec: 0.25, chordSec: 4, decay: 9, pan: -1 }),
              pluckExpr({ tones: POP_TONES, pattern: arp, stepSec: 0.25, chordSec: 4, decay: 9, pan: 1 }),
            ],
            filters: "highpass=f=180,lowpass=f=4500",
            gain: 0.15,
            sr: 22050,
            send: true,
          },
          {
            expr: hitsExpr(0.5, [1], thump(120, 50, 30, 10)),
            filters: "lowpass=f=1800",
            gain: 0.32,
            sr: 22050,
          },
          {
            expr: hitsExpr(0.25, [0.45, 1], noiseBurst(0.012, 28), 0, 7),
            filters: "highpass=f=6000,lowpass=f=11000",
            gain: 0.2,
            pan: [0.75, 1],
          },
        ],
      };
    }
    case "pulse": {
      // 120 BPM, vi–IV–I–V (Am F C G) every 4 s; 8th-note sub, kick on 1 & 3, clap on 2 & 4, 16th hats, pumped pad.
      const pad = [
        [52, 57, 60], // Am
        [53, 57, 60], // F
        [52, 55, 60], // C
        [50, 55, 59], // G
      ];
      const sub = [33, 29, 36, 31].map(midiHz); // A1 F1 C2 G1
      const subExpr =
        PRE +
        `st(3,floor(ld(0)/0.25));st(1,ld(0)-ld(3)*0.25);st(2,mod(floor(ld(0)/4),4));st(5,${sel(2, sub.map(num))});` +
        `st(8,${num(TAU)}*ld(5)*ld(1));min(1,ld(1)/0.006)*clip((0.215-ld(1))/0.03,0,1)*(0.7+0.3*exp(-10*ld(1)))*(0.9+0.1*eq(mod(ld(3),2),0))*(sin(ld(8))+0.35*sin(2*ld(8))+0.1*sin(3*ld(8)))`;
      const pump = "1-0.35*exp(-7*mod(ld(0),1))*min(1,mod(ld(0),1)/0.01)";
      return {
        reverb: ROOM,
        stems: [
          {
            expr: stereoPad({ chords: pad, chordSec: 4, xfadeSec: 0.6, partials: WARM, vib: 0.002, ampMod: pump }, 0.002),
            filters: "lowpass=f=1500,highpass=f=150",
            gain: 0.11,
            sr: 11025,
            send: true,
          },
          { expr: subExpr, filters: "lowpass=f=320", gain: 0.28, sr: 11025 },
          { expr: hitsExpr(1, [1], thump(140, 48, 28, 8)), filters: "lowpass=f=2000", gain: 0.36, sr: 22050 },
          {
            expr: hitsExpr(1, [1], `${noiseBurst(0.001, 20)}+0.35*sin(${num(TAU * 190)}*ld(1))*exp(-30*ld(1))`, 0.5, 11),
            filters: "highpass=f=500,lowpass=f=5000",
            gain: 0.14,
            send: true,
          },
          {
            expr: hitsExpr(0.125, [0.25, 0.12, 0.6, 0.12], noiseBurst(0.001, 50), 0, 5),
            filters: "highpass=f=8000,lowpass=f=13000",
            gain: 0.3,
            pan: [0.8, 1],
          },
        ],
      };
    }
    case "cinematic": {
      // Am – F – C – G, 8 s each; detuned swelling pads over an A drone, soft boom on each chord change.
      const pad = [
        [57, 60, 64, 69], // Am
        [57, 60, 65, 69], // F
        [55, 60, 64, 67], // C
        [55, 59, 62, 67], // G
      ];
      const swell = `0.62-0.38*cos(${num(TAU / 8)}*ld(0))`;
      const [a1, e2, a2] = [55, 82.41, 110].map(loopHz);
      const drone =
        PRE +
        `(0.55*sin(${num(TAU * a1)}*ld(0))+0.3*sin(${num(TAU * e2)}*ld(0))+0.2*sin(${num(TAU * a2)}*ld(0)))*(0.8-0.2*cos(${num(TAU / 16)}*ld(0)))`;
      return {
        reverb: HALL,
        stems: [
          {
            expr: stereoPad({ chords: pad, chordSec: 8, xfadeSec: 3.5, partials: [1, 0.3, 0.08], vib: 0.0015, ampMod: swell }, 0.003, 0.6),
            filters: "lowpass=f=1400,highpass=f=120",
            gain: 0.1,
            sr: 11025,
            send: true,
          },
          { expr: drone, filters: "lowpass=f=300", gain: 0.2, sr: 11025 },
          {
            expr: hitsExpr(8, [1], `${thump(75, 36, 4, 1.6, 0.025)}+0.25*${noiseBurst(0.02, 5)}`, 0, 3),
            filters: "lowpass=f=180",
            gain: 0.32,
            sr: 11025,
            send: true,
          },
          {
            // faint airy wash that breathes with the swells
            expr: [PRE + seed(17) + `${NOISE}*(${swell})`, PRE + seed(23) + `${NOISE}*(${swell})`],
            filters: "highpass=f=2500,lowpass=f=6000",
            gain: 0.012,
            send: true,
          },
        ],
      };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Sound effects                                                       */
/* ------------------------------------------------------------------ */

const SFX_DUR: Record<SfxKind, number> = { whoosh: 0.45, pop: 0.12, riser: 0.9, hit: 0.6 };

/** Chamberlin state-variable filter step on input expr `x`; vars 4 = low, 6 = band, 2 = high, 5 = coef. */
function svf(fcExpr: string, q: number, x: string): string {
  return (
    `st(5,2*sin(${num(PI)}*min(${fcExpr},9000)/${SR}));` +
    `st(4,ld(4)+ld(5)*ld(6));st(2,${x}-ld(4)-${num(q)}*ld(6));st(6,ld(6)+ld(5)*ld(2));`
  );
}

function sfxStems(kind: SfxKind): Stem[] {
  const d = SFX_DUR[kind];
  const fadeOut = (sec: number) => `clip((${num(d)}-t)/${num(sec)},0,1)`;
  switch (kind) {
    case "whoosh": {
      // Band-passed noise sweeping up then down, panning left -> right.
      const ch = (s: number, gainExpr: string) =>
        seed(s) +
        `st(1,clip(t/${num(d)},0,1));` +
        svf("350+2600*pow(sin(" + num(PI) + "*pow(ld(1),0.8)),2)", 0.75, NOISE) +
        `pow(sin(${num(PI)}*ld(1)),2)*(1-0.3*ld(1))*(ld(6)+0.2*ld(2))*${gainExpr}*${fadeOut(0.02)}`;
      return [
        {
          expr: [ch(101, `cos(${num(PI / 2)}*(0.2+0.6*ld(1)))`), ch(202, `sin(${num(PI / 2)}*(0.2+0.6*ld(1)))`)],
          filters: "highpass=f=200,lowpass=f=9000",
          gain: 1,
        },
      ];
    }
    case "pop": {
      // Short rising "bloop" with a quick decay.
      const e =
        `st(8,${num(TAU)}*(380*t+520*(t-(1-exp(-55*t))/55)));` +
        `min(1,t/0.002)*exp(-38*t)*${fadeOut(0.02)}*(sin(ld(8))+0.15*sin(2*ld(8)))`;
      return [{ expr: e, filters: "lowpass=f=5000,highpass=f=120", gain: 1 }];
    }
    case "riser": {
      // Gliding tone (root + fifth + octave) under band-passed noise with rising cutoff, swelling in.
      const ch = (s: number, det: number) =>
        seed(s) +
        `st(1,clip(t/${num(d)},0,1));st(3,${num(180 * det)}*pow(2,2*pow(ld(1),1.5)));st(8,ld(8)+${num(TAU / SR)}*ld(3));` +
        svf("500+5500*pow(ld(1),1.6)", 0.9, NOISE) +
        `pow(ld(1),2)*${fadeOut(0.04)}*(0.6*(sin(ld(8))+0.4*sin(1.5*ld(8))+0.25*sin(2*ld(8)))+0.5*ld(6))`;
      return [{ expr: [ch(31, 0.997), ch(57, 1.003)], filters: "highpass=f=100,lowpass=f=9000", gain: 1 }];
    }
    case "hit": {
      // Soft low impact: pitch-dropping sine plus a low-passed noise thud.
      const e =
        seed(77) +
        `st(1,t);` +
        svf("500", 1.2, NOISE) +
        `(${thump(100, 45, 18, 6, 0.003)}+0.6*ld(4)*exp(-14*t)*min(1,t/0.003))*${fadeOut(0.05)}`;
      return [{ expr: e, filters: "lowpass=f=1200,highpass=f=30,aecho=0.9:0.6:37|61:0.25|0.15", gain: 1 }];
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rendering + cache                                                   */
/* ------------------------------------------------------------------ */

const inflight = new Map<string, Promise<string>>();

function cacheDir(): string {
  return path.join(os.tmpdir(), "renom-audio");
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 44;
  } catch {
    return false;
  }
}

function parseLoudness(stderr: string): { integrated: number; peak: number } {
  const i = [...stderr.matchAll(/I:\s+(-?[\d.]+|-inf|nan) LUFS/g)].at(-1)?.[1];
  const p = [...stderr.matchAll(/Peak:\s+(-?[\d.]+|-inf|nan) dBFS/g)].at(-1)?.[1];
  const val = (s?: string) => (s && /^-?[\d.]+$/.test(s) ? parseFloat(s) : -Infinity);
  return { integrated: val(i), peak: val(p) };
}

/** Render `graph` to the cache as `name`, normalizing loudness (beds) or peak (sfx). */
function cached(name: string, make: () => { graph: string; gainDb: (m: { integrated: number; peak: number }) => number }): Promise<string> {
  const file = path.join(cacheDir(), `${name}-${VERSION}.wav`);
  const pending = inflight.get(file);
  if (pending) return pending;
  const job = (async () => {
    if (await exists(file)) return file;
    await mkdir(cacheDir(), { recursive: true });
    const tag = `${process.pid}-${randomBytes(4).toString("hex")}`;
    const raw = `${file}.${tag}.raw.wav`;
    const tmp = `${file}.${tag}.tmp.wav`;
    try {
      const { graph, gainDb } = make();
      const { stderr } = await runFfmpeg(["-y", "-filter_complex", graph, "-map", "[out]", "-c:a", "pcm_f32le", "-f", "wav", raw]);
      const m = parseLoudness(stderr);
      if (!Number.isFinite(m.peak)) throw new Error(`Audio render for ${name} came out silent.`);
      const gain = gainDb(m);
      await runFfmpeg(["-y", "-i", raw, "-af", `volume=${gain.toFixed(2)}dB`, "-ar", String(SR), "-ac", "2", "-c:a", "pcm_s16le", "-f", "wav", tmp]);
      await rename(tmp, file);
      return file;
    } finally {
      await rm(raw, { force: true });
      await rm(tmp, { force: true });
    }
  })();
  inflight.set(file, job);
  job.then(
    () => inflight.delete(file),
    () => inflight.delete(file),
  );
  return job;
}

/** Render a seamless loop for the mood to a 44.1 kHz stereo WAV, cached on disk (os.tmpdir()/renom-audio/<mood>-v1.wav). Returns the path. Length 32 s (a multiple of the bar length) so it can be looped with -stream_loop -1. */
export async function musicBed(mood: MusicMood): Promise<string> {
  if (!MUSIC_MOODS.some((m) => m.id === mood)) throw new Error(`Unknown music mood: ${mood}`);
  return cached(mood, () => {
    const { stems, reverb } = bedStems(mood);
    // Sources run 0.5 s past the kept window so resampler/filter flush at EOF never lands inside it.
    const graph = buildGraph(stems, PREROLL_SEC + LOOP_SEC + 0.5, reverb, "highpass=f=28", [PREROLL_SEC * SR, (PREROLL_SEC + LOOP_SEC) * SR]);
    return {
      graph,
      gainDb: ({ integrated, peak }) => {
        const toTarget = Number.isFinite(integrated) ? BED_TARGET_LUFS - integrated : 0;
        return Math.min(toTarget, BED_PEAK_CEIL_DB - peak);
      },
    };
  });
}

/** Render a short sound effect WAV (cached the same way). whoosh ~0.45 s airy filtered-noise sweep, pop ~0.12 s soft UI pop, riser ~0.9 s rising tone/noise, hit ~0.6 s soft low impact. Peak around -6 dBFS. */
export async function sfx(kind: SfxKind): Promise<string> {
  if (!(kind in SFX_DUR)) throw new Error(`Unknown sound effect: ${kind}`);
  return cached(`sfx-${kind}`, () => ({
    graph: buildGraph(sfxStems(kind), SFX_DUR[kind], null, "", null),
    gainDb: ({ peak }) => SFX_PEAK_DB - peak,
  }));
}
