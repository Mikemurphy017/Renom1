"use client";

import * as React from "react";

export type Aspect = "9:16" | "16:9";

export interface CaptureDevice {
  deviceId: string;
  label: string;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  width: number;
  height: number;
}

// ── quality ──────────────────────────────────────────────────────────────────

export type QualityId = "auto" | "2160p" | "1440p" | "1080p" | "720p";
export type FrameRate = 30 | 60;

/** Recording sizes, by the short side of the frame (16:9, or 9:16 on a phone held upright). */
export const QUALITY_OPTIONS: { id: QualityId; label: string; short: number }[] = [
  { id: "auto", label: "Auto (best your camera offers)", short: 2160 },
  { id: "2160p", label: "4K (2160p)", short: 2160 },
  { id: "1440p", label: "1440p (2K)", short: 1440 },
  { id: "1080p", label: "1080p (Full HD)", short: 1080 },
  { id: "720p", label: "720p (HD)", short: 720 },
];
const LEVELS: QualityId[] = ["2160p", "1440p", "1080p", "720p"];
const shortSide = (q: QualityId) => QUALITY_OPTIONS.find((o) => o.id === q)!.short;

export interface CaptureQuality {
  quality: QualityId;
  fps: FrameRate;
}
const QUALITY_KEY = "renom.capture.v1";
const DEFAULT_QUALITY: CaptureQuality = { quality: "auto", fps: 30 };

function loadQuality(): CaptureQuality {
  try {
    const raw = JSON.parse(localStorage.getItem(QUALITY_KEY) ?? "null") as Partial<CaptureQuality> | null;
    return {
      quality: QUALITY_OPTIONS.some((o) => o.id === raw?.quality) ? raw!.quality! : DEFAULT_QUALITY.quality,
      fps: raw?.fps === 60 ? 60 : 30,
    };
  } catch {
    return DEFAULT_QUALITY;
  }
}

const isPortraitPhone = () => typeof window !== "undefined" && !!window.matchMedia?.("(orientation: portrait) and (pointer: coarse)").matches;

/**
 * Camera constraints for a quality. A phone held upright records portrait: ask
 * for a tall frame so a 9:16 video uses the whole sensor instead of a narrow
 * slice of a wide one. `strict` sets minimums (both sides at least the short
 * side, so it holds in either orientation), which makes a camera that can't do
 * it fail fast with OverconstrainedError instead of quietly giving less.
 */
function videoConstraints(quality: QualityId, fps: FrameRate, strict: boolean): MediaTrackConstraints {
  const short = shortSide(quality);
  const long = Math.round((short * 16) / 9);
  const portrait = isPortraitPhone();
  const min = strict && quality !== "auto" ? { min: short } : {};
  return {
    width: { ideal: portrait ? short : long, ...min },
    height: { ideal: portrait ? long : short, ...min },
    frameRate: strict && fps === 60 ? { ideal: 60, min: 50 } : { ideal: fps },
  };
}

/** What to try, best first: the choice, then each lower size, then 30 fps, then anything. */
function ladder({ quality, fps }: CaptureQuality): { quality: QualityId; fps: FrameRate; strict: boolean }[] {
  const sizes = quality === "auto" ? (["auto"] as QualityId[]) : LEVELS.slice(LEVELS.indexOf(quality));
  const steps = (fps === 60 ? [60, 30] : [30]).flatMap((f) => sizes.map((q) => ({ quality: q, fps: f as FrameRate, strict: true })));
  return [...steps, { quality, fps: 30, strict: false }];
}

const overconstrained = (e: unknown) => (e as { name?: string })?.name === "OverconstrainedError";

/** The sizes and frame rates this camera can offer, from its capabilities. */
function cameraCaps(track: MediaStreamTrack | undefined): { qualities: QualityId[]; fps60: boolean } {
  const caps = typeof track?.getCapabilities === "function" ? track.getCapabilities() : undefined;
  // Unknown (older browsers): offer everything and let the fallback sort it out.
  const maxShort = caps?.width?.max && caps?.height?.max ? Math.min(caps.width.max, caps.height.max) : Infinity;
  return {
    qualities: QUALITY_OPTIONS.filter((o) => o.id === "auto" || o.short <= maxShort).map((o) => o.id),
    fps60: !caps?.frameRate?.max || caps.frameRate.max >= 59,
  };
}

/** The offered quality closest to (not above) a saved choice. */
export function nearestQuality(choice: QualityId, offered: QualityId[]): QualityId {
  if (choice === "auto" || offered.includes(choice)) return choice;
  return LEVELS.slice(LEVELS.indexOf(choice)).find((q) => offered.includes(q)) ?? "auto";
}

export interface CameraSettings {
  width: number;
  height: number;
  fps: number;
}

/** The recorded frame: the camera's, center-cropped when its shape doesn't match the video's. */
export function recordSize(cam: { width: number; height: number }, aspect: Aspect): { width: number; height: number; cropped: boolean } {
  const { width: sw, height: sh } = cam;
  if ((aspect === "9:16") === sh > sw) return { width: sw, height: sh, cropped: false };
  const cropW = aspect === "9:16" ? Math.round((sh * 9) / 16) : sw;
  const cropH = aspect === "9:16" ? sh : Math.round((sw * 9) / 16);
  return { width: cropW - (cropW % 2), height: cropH - (cropH % 2), cropped: true };
}

/**
 * Video bitrate for a frame size and rate: about 5 Mbps at 720p, 10 at 1080p,
 * 18 at 1440p and 40 at 4K (30 fps); 60 fps gets 1.5× (motion between frames
 * is smaller, so it doesn't need double).
 */
export function videoBitrate(width: number, height: number, fps: number) {
  const perPixel = 0.16 * (fps > 40 ? 0.75 : 1);
  const bps = width * height * Math.min(60, Math.max(24, fps)) * perPixel;
  return Math.round(Math.min(60e6, Math.max(5e6, bps)) / 5e5) * 5e5;
}

/** H.264 level (hex level_idc) that fits a frame size and rate. */
function h264Level(width: number, height: number, fps: number) {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  // [level, max macroblocks per frame, max macroblocks per second]
  const levels: [string, number, number][] = [["1F", 3600, 108000], ["28", 8192, 245760], ["2A", 8704, 522240], ["32", 22080, 589824], ["33", 36864, 983040], ["34", 36864, 2073600]];
  return (levels.find(([, f, r]) => mbs <= f && mbs * fps <= r) ?? levels[levels.length - 1])[0];
}

/**
 * The recording format, best first: H.264 MP4 (hardware-encoded on most
 * machines, so 4K doesn't drop frames; plays everywhere; the editor decodes it
 * fastest) at a profile/level that fits the frame, then WebM. WebM is encoded
 * in software: VP9 makes smaller files but can't keep up above 1080p30 on a
 * typical laptop (it records 4K at ~20 fps where VP8 holds 30), so bigger
 * frames take VP8.
 */
function pickMime(size?: { width: number; height: number; fps: number }) {
  if (typeof MediaRecorder === "undefined") return "";
  const lvl = size ? h264Level(size.width, size.height, size.fps) : "28";
  const heavy = !!size && size.width * size.height * size.fps > 1920 * 1080 * 31;
  const webm = heavy ? ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus"] : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"];
  const candidates = [
    `video/mp4;codecs=avc1.6400${lvl},mp4a.40.2`,
    `video/mp4;codecs=avc1.4D00${lvl},mp4a.40.2`,
    `video/mp4;codecs=avc1.42E0${lvl},mp4a.40.2`,
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    ...webm,
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function describeError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (typeof window !== "undefined" && !window.isSecureContext) return "The camera only works on https:// or localhost.";
  switch (name) {
    case "NotAllowedError":
      return "Camera access was blocked. Allow camera and microphone for this site in your browser's address bar, then try again.";
    case "NotFoundError":
      return "No camera or microphone was found.";
    case "NotReadableError":
      return "The camera is in use by another app (Zoom, Teams, FaceTime…). Close it and try again.";
    case "OverconstrainedError":
      return "That camera doesn't support the requested settings.";
    default:
      return (e as Error)?.message || "Couldn't start the camera.";
  }
}

/**
 * Webcam + microphone capture with a live level meter and MediaRecorder.
 * 9:16 is produced by center-cropping the camera through a canvas, so the
 * saved file is truly vertical (and never mirrored). Quality (size and frame
 * rate) is remembered per browser and limited to what the camera can do.
 */
export function useCapture() {
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [cameras, setCameras] = React.useState<CaptureDevice[]>([]);
  const [mics, setMics] = React.useState<CaptureDevice[]>([]);
  const [level, setLevel] = React.useState(0);
  /** When the mic last hit full scale (ms), so the meter can warn about clipping. */
  const [clippedAt, setClippedAt] = React.useState(0);
  /** The advisor's choice (remembered on this browser). */
  const [choice, setChoice] = React.useState<CaptureQuality>(DEFAULT_QUALITY);
  const choiceRef = React.useRef(choice);
  /** What this camera offers, once it's on. */
  const [caps, setCaps] = React.useState<{ qualities: QualityId[]; fps60: boolean }>({ qualities: QUALITY_OPTIONS.map((o) => o.id), fps60: true });
  /** What the camera is actually delivering. */
  const [settings, setSettings] = React.useState<CameraSettings | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const recorderRef = React.useRef<{ rec: MediaRecorder; stopCanvas?: () => void; started: number; w: number; h: number; mime: string } | null>(null);

  React.useEffect(() => {
    const saved = loadQuality();
    choiceRef.current = saved;
    setChoice(saved);
  }, []);

  const readSettings = React.useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return setSettings(null);
    const { width = 0, height = 0, frameRate = 30 } = track.getSettings();
    setSettings((prev) => (prev && prev.width === width && prev.height === height && prev.fps === Math.round(frameRate) ? prev : { width, height, fps: Math.round(frameRate) }));
  }, []);

  // A phone turned sideways (or a camera renegotiating) changes the frame; keep the readout honest.
  React.useEffect(() => {
    if (!stream) return;
    const t = setInterval(readSettings, 1500);
    return () => clearInterval(t);
  }, [stream, readSettings]);

  const refreshDevices = React.useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const map = (kind: MediaDeviceKind, fallback: string) =>
      all.filter((d) => d.kind === kind && d.deviceId).map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
    setCameras(map("videoinput", "Camera"));
    setMics(map("audioinput", "Microphone"));
  }, []);

  const stopTracks = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setStream(null);
    setSettings(null);
    setLevel(0);
  }, []);

  // Stop the camera only when the component really unmounts.
  React.useEffect(() => stopTracks, [stopTracks]);

  React.useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  const start = React.useCallback(
    async (opts: { cameraId?: string; micId?: string } = {}) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(describeError(new Error("This browser doesn't support camera capture.")));
        return false;
      }
      setStarting(true);
      try {
        // Studio capture: the browser's call processing (echo cancellation,
        // noise suppression, auto gain) flattens a voice and makes levels pump,
        // and a good mic doesn't need it. Record it clean at 48 kHz; the edit
        // does the denoise, EQ, compression and loudness properly.
        const audio: MediaTrackConstraints = {
          deviceId: opts.micId ? { exact: opts.micId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 24 },
        };
        // The chosen quality, stepping down if this camera can't do it.
        let s: MediaStream | null = null;
        let lastError: unknown;
        for (const step of ladder(choiceRef.current)) {
          try {
            s = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: opts.cameraId ? { exact: opts.cameraId } : undefined,
                facingMode: opts.cameraId ? undefined : { ideal: "user" },
                ...videoConstraints(step.quality, step.fps, step.strict),
              },
              audio,
            });
            break;
          } catch (e) {
            lastError = e;
            if (!overconstrained(e)) break;
          }
        }
        if (!s) throw lastError;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        setStream(s);
        setCaps(cameraCaps(s.getVideoTracks()[0]));
        readSettings();

        // live mic level
        audioCtxRef.current?.close().catch(() => {});
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        // Safari starts audio contexts paused unless resumed; the meter would sit at zero.
        if (ctx.state === "suspended") void ctx.resume().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        let lastClip = 0;
        const tick = () => {
          if (audioCtxRef.current !== ctx) return;
          analyser.getFloatTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v));
          setLevel(Math.min(1, peak * 1.6));
          if (peak >= 0.98 && performance.now() - lastClip > 300) {
            lastClip = performance.now();
            setClippedAt(Date.now());
          }
          requestAnimationFrame(tick);
        };
        tick();
        await refreshDevices(); // labels become available after permission
        return true;
      } catch (e) {
        setError(describeError(e));
        return false;
      } finally {
        setStarting(false);
      }
    },
    [refreshDevices, readSettings]
  );

  /**
   * Change size / frame rate. Remembered on this browser; a live camera is
   * switched in place (no new permission prompt), stepping down if needed.
   * False if the camera refused every option (it keeps what it had).
   */
  const setQuality = React.useCallback(
    async (patch: Partial<CaptureQuality>) => {
      const next = { ...choiceRef.current, ...patch };
      choiceRef.current = next;
      setChoice(next);
      try {
        localStorage.setItem(QUALITY_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the choice lasts for this visit */
      }
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return true;
      for (const step of ladder(next)) {
        try {
          await track.applyConstraints(videoConstraints(step.quality, step.fps, step.strict));
          readSettings();
          return true;
        } catch (e) {
          if (!overconstrained(e)) break;
        }
      }
      readSettings();
      return false;
    },
    [readSettings]
  );

  const startRecording = React.useCallback((aspect: Aspect) => {
    const s = streamRef.current;
    if (!s) throw new Error("Camera is not on");
    const track = s.getVideoTracks()[0];
    const { width: sw = 1280, height: sh = 720, frameRate = 30 } = track.getSettings();
    const fps = Math.min(60, Math.max(15, Math.round(frameRate)));
    const out = recordSize({ width: sw, height: sh }, aspect);
    const { width: w, height: h } = out;
    const mime = pickMime({ width: w, height: h, fps });
    let recStream: MediaStream = s;
    let stopCanvas: (() => void) | undefined;

    if (out.cropped) {
      // Center-crop to the target aspect through a canvas at full camera
      // resolution and the camera's frame rate (no downscaling).
      const video = document.createElement("video");
      video.srcObject = new MediaStream([track]);
      video.muted = true;
      video.playsInline = true;
      void video.play();
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d", { alpha: false })!;
      let raf = 0;
      const draw = () => {
        if (video.readyState >= 2) g.drawImage(video, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, w, h);
        raf = requestAnimationFrame(draw);
      };
      draw();
      const canvasStream = canvas.captureStream(fps);
      recStream = new MediaStream([...canvasStream.getVideoTracks(), ...s.getAudioTracks()]);
      stopCanvas = () => {
        cancelAnimationFrame(raf);
        canvasStream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
    }

    const rec = new MediaRecorder(recStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: videoBitrate(w, h, fps),
      audioBitsPerSecond: 256_000,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    (rec as MediaRecorder & { _chunks: Blob[] })._chunks = chunks;
    rec.start(1000);
    recorderRef.current = { rec, stopCanvas, started: performance.now(), w, h, mime: rec.mimeType || mime || "video/webm" };
  }, []);
  const stopRecording = React.useCallback(
    () =>
      new Promise<RecordingResult>((resolve, reject) => {
        const r = recorderRef.current;
        if (!r) return reject(new Error("Not recording"));
        r.rec.onstop = () => {
          r.stopCanvas?.();
          recorderRef.current = null;
          const chunks = (r.rec as MediaRecorder & { _chunks: Blob[] })._chunks;
          const type = r.mime.split(";")[0];
          resolve({
            blob: new Blob(chunks, { type }),
            mimeType: type,
            durationSec: (performance.now() - r.started) / 1000,
            width: r.w,
            height: r.h,
          });
        };
        r.rec.stop();
      }),
    []
  );

  return {
    stream,
    error,
    starting,
    cameras,
    mics,
    level,
    clippedAt,
    /** Saved quality choice, and what this camera offers. */
    quality: choice,
    qualities: caps.qualities,
    fps60: caps.fps60,
    /** What the camera is delivering right now (null when off). */
    settings,
    setQuality,
    start,
    stop: stopTracks,
    startRecording,
    stopRecording,
    supported: !!pickMime(),
  };
}
