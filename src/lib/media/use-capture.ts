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

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
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
 * saved file is truly vertical (and never mirrored).
 */
export function useCapture() {
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [cameras, setCameras] = React.useState<CaptureDevice[]>([]);
  const [mics, setMics] = React.useState<CaptureDevice[]>([]);
  const [level, setLevel] = React.useState(0);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const recorderRef = React.useRef<{ rec: MediaRecorder; stopCanvas?: () => void; started: number; w: number; h: number; mime: string } | null>(null);

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
        // A phone held upright records portrait: ask for a tall frame so a 9:16
        // video uses the whole sensor instead of a narrow slice of a wide one.
        const portrait = typeof window !== "undefined" && window.matchMedia?.("(orientation: portrait) and (pointer: coarse)").matches;
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: opts.cameraId ? { exact: opts.cameraId } : undefined,
            facingMode: opts.cameraId ? undefined : { ideal: "user" },
            width: { ideal: portrait ? 1080 : 1920 },
            height: { ideal: portrait ? 1920 : 1080 },
            frameRate: { ideal: 30 },
          },
          audio: {
            deviceId: opts.micId ? { exact: opts.micId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        setStream(s);

        // live mic level
        audioCtxRef.current?.close().catch(() => {});
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (audioCtxRef.current !== ctx) return;
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(Math.min(1, (peak / 128) * 1.6));
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
    [refreshDevices]
  );

  const startRecording = React.useCallback((aspect: Aspect) => {
    const s = streamRef.current;
    if (!s) throw new Error("Camera is not on");
    const mime = pickMime();
    const track = s.getVideoTracks()[0];
    const { width: sw = 1280, height: sh = 720 } = track.getSettings();
    const sourceVertical = sh > sw;
    let recStream: MediaStream = s;
    let stopCanvas: (() => void) | undefined;
    let w = sw;
    let h = sh;

    const needsCrop = (aspect === "9:16") !== sourceVertical;
    if (needsCrop) {
      // Center-crop to the target aspect through a canvas.
      const video = document.createElement("video");
      video.srcObject = new MediaStream([track]);
      video.muted = true;
      video.playsInline = true;
      void video.play();
      const target = aspect === "9:16" ? 9 / 16 : 16 / 9;
      const cropW = aspect === "9:16" ? Math.round(sh * target) : sw;
      const cropH = aspect === "9:16" ? sh : Math.round(sw / target);
      w = cropW - (cropW % 2);
      h = cropH - (cropH % 2);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext("2d")!;
      let raf = 0;
      const draw = () => {
        if (video.readyState >= 2) g.drawImage(video, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, w, h);
        raf = requestAnimationFrame(draw);
      };
      draw();
      const canvasStream = canvas.captureStream(30);
      recStream = new MediaStream([...canvasStream.getVideoTracks(), ...s.getAudioTracks()]);
      stopCanvas = () => {
        cancelAnimationFrame(raf);
        canvasStream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      };
    }

    const rec = new MediaRecorder(recStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 160_000,
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

  return { stream, error, starting, cameras, mics, level, start, stop: stopTracks, startRecording, stopRecording, supported: !!pickMime() };
}
