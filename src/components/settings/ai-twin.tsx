"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own photos */
import * as React from "react";
import Link from "next/link";
import { Check, CircleAlert, ExternalLink, ImagePlus, LoaderCircle, Mic, RefreshCw, Square, Trash2, Upload, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProBadge } from "@/components/shared/pro";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { persistTake } from "@/lib/video/client";
import { readVideoMeta, videoType } from "@/lib/media/video-file";
import { cn, fmtDuration } from "@/lib/utils";

/**
 * The advisor's AI twin: their voice, a video of them talking (so it moves and
 * sounds like them), and photos of them. Set up once, in onboarding or
 * Settings; then AI videos are made of them, in their voice. Nothing here
 * names the provider.
 */

type Part = "working" | "ready" | "failed";
export interface TwinView {
  available: boolean;
  voice: { status: Part; error?: string; createdAt: string; seconds?: number } | null;
  video: { status: Part; error?: string; createdAt: string; consent: "none" | "pending" | "accepted" | "rejected"; consentUrl?: string } | null;
  photos: { mediaId: string; status: Part; error?: string }[];
  ready: boolean;
  looks: { id: string; label: string; mediaId?: string }[];
  defaultLook?: string;
}

export function useTwin() {
  const [state, setState] = React.useState<{ pro: boolean; consentText: string; twin: TwinView } | null>(null);
  const load = React.useCallback(async () => {
    const r = await fetch("/api/twin", { cache: "no-store" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setState({ pro: j.pro, consentText: j.consentText, twin: j.twin });
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  // Training and consent finish on their own: keep looking while something is working.
  const working = !!state && (state.twin.voice?.status === "working" || state.twin.video?.status === "working" || state.twin.video?.consent === "pending" || state.twin.photos.some((p) => p.status === "working"));
  React.useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(t);
  }, [working, load]);
  return { state, reload: load, set: (twin: TwinView) => setState((s) => (s ? { ...s, twin } : s)) };
}

const PASSAGE = [
  "Hi, I’m a financial advisor, and I spend most of my days helping families make sense of their money.",
  "People usually come to me with one question, and leave with a plan. When should I retire? How much is enough? What do I do with the stock options from work?",
  "The honest answer is that it depends, and that’s exactly why it’s worth sitting down together. Taxes, timing and the way you actually want to live all matter more than any single fund.",
  "I like to start simple. Where are you today, where do you want to be, and what keeps you up at night? From there, we build something you can follow.",
];
const mediaIdOf = (url?: string) => /\/api\/media\/(img[a-f0-9]{18})/.exec(url ?? "")?.[1];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

function Status({ part, label }: { part?: Part | null; label?: string }) {
  if (!part) return <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Not added</span>;
  if (part === "ready") return <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success"><Check className="size-3" /> {label ?? "Ready"}</span>;
  if (part === "working") return <span className="inline-flex items-center gap-1 rounded-full bg-brass-soft px-2 py-0.5 text-[11px] font-medium text-[#7d6238] dark:text-primary"><LoaderCircle className="size-3 animate-spin" /> {label ?? "Processing"}</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"><CircleAlert className="size-3" /> {label ?? "Needs another try"}</span>;
}

function Step({ n, title, hint, status, children }: { n: number; title: string; hint: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-navy-foreground dark:bg-primary dark:text-primary-foreground">{n}</span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{title}</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        {status}
      </div>
      <div className="mt-3 pl-8.5">{children}</div>
    </div>
  );
}

export function AiTwinSection() {
  const { profile, updateProfile } = useStore();
  const { state, reload, set } = useTwin();
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "voice" | "video" | "photos" | "consent" | "delete">("");
  const [clip, setClip] = React.useState<{ blob: Blob; name: string; seconds: number; url: string } | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [uploadPct, setUploadPct] = React.useState<string>("");
  const rec = React.useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const audioInput = React.useRef<HTMLInputElement>(null);
  const videoInput = React.useRef<HTMLInputElement>(null);
  const photoInput = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => () => {
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    if (rec.current) clearInterval(rec.current.timer);
  }, []);

  const post = async (body: object) => {
    const r = await fetch("/api/twin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error ?? "That didn’t work. Try again.");
    if (j.twin) set(j.twin);
    return j;
  };
  const run = async (what: typeof busy, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
      setUploadPct("");
    }
  };

  // ── voice ──
  const startRec = async () => {
    const mime = pickMime();
    if (!mime) return toast.error("This browser can’t record audio", { description: "Upload a recording instead." });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch {
      return toast.error("Microphone unavailable", { description: "Allow microphone access when your browser asks, then try again." });
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128_000 });
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const started = Date.now();
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const seconds = Math.round((Date.now() - started) / 1000);
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      setClip({ blob, name: `voice.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`, seconds, url: URL.createObjectURL(blob) });
    };
    mr.start(1000);
    rec.current = { mr, stream, timer: window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 250) };
    setElapsed(0);
    setRecording(true);
  };
  const stopRec = () => {
    if (!rec.current) return;
    clearInterval(rec.current.timer);
    rec.current.mr.stop();
    rec.current = null;
    setRecording(false);
  };
  const pickAudio = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/")) return toast.error("That isn’t an audio file.");
    const url = URL.createObjectURL(f);
    const seconds = await new Promise<number>((res) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration) : 60);
      a.onerror = () => res(60);
      a.src = url;
    });
    setClip({ blob: f, name: f.name, seconds, url });
  };
  const sendVoice = () =>
    run("voice", async () => {
      if (!clip) return;
      const form = new FormData();
      form.append("audio", clip.blob, clip.name);
      form.append("seconds", String(clip.seconds));
      form.append("consent", consent ? "yes" : "no");
      const r = await fetch("/api/twin", { method: "POST", body: form });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Your voice couldn’t be made.");
      set(j.twin);
      URL.revokeObjectURL(clip.url);
      setClip(null);
      toast.success("Your voice is being cloned", { description: "Usually ready in under a minute." });
    });

  // ── talking video ──
  const sendVideo = (f?: File | null) =>
    run("video", async () => {
      if (!f) return;
      const type = videoType(f);
      if (!["video/mp4", "video/quicktime", "video/webm"].includes(type)) throw new Error("Use an MP4, MOV or WebM video.");
      if (f.size > 1024 * 1024 * 1024) throw new Error("That video is over 1 GB. Export a shorter or smaller copy (about 2 minutes at 1080p).");
      const meta = await readVideoMeta(f);
      if (meta?.durationSec && meta.durationSec < 15) throw new Error("The video needs at least 15 seconds of you talking (about 2 minutes is best).");
      setUploadPct("Uploading…");
      const stored = await persistTake("twin", { blob: f, url: "", mimeType: type, durationSec: meta?.durationSec ?? 0, width: meta?.width ?? 1080, height: meta?.height ?? 1920, recordedAt: new Date().toISOString() });
      setUploadPct("Sending it to be learned…");
      const j = await post({ action: "video", uploadId: stored.sourceId, consent });
      toast.success("Your video is being learned", { description: j.twin?.video?.consentUrl ? "Next: record your consent (about a minute)." : "Training usually takes a few minutes." });
    });
  const newLink = () =>
    run("consent", async () => {
      const j = await post({ action: "consent-link" });
      if (j.url) window.open(j.url, "_blank", "noopener");
    });

  // ── photos ──
  const headshots = profile.headshots.filter((h) => mediaIdOf(h.url));
  const chosen = new Set(state?.twin.photos.map((p) => p.mediaId) ?? []);
  const [picked, setPicked] = React.useState<string[] | null>(null);
  const selection = picked ?? [...chosen];
  const addPhotos = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 4)) {
      try {
        const up = await uploadImage(f, "headshot", "headshot");
        updateProfile({ headshots: [...profile.headshots, { id: up.id, label: "Headshot", pose: "center" as never, url: up.url }] });
        setPicked((p) => [...(p ?? [...chosen]), up.id]);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  };
  const sendPhotos = () =>
    run("photos", async () => {
      await post({ action: "photos", mediaIds: selection, consent });
      setPicked(null);
      toast.success("Your photos are being added", { description: "Each becomes a look that moves like you." });
    });

  const removeAll = () => {
    if (!window.confirm("Delete your AI twin? Your voice, video and looks are removed. Videos already made stay.")) return;
    void run("delete", async () => {
      const r = await fetch("/api/twin", { method: "DELETE" });
      if (!r.ok) throw new Error("Couldn’t delete it. Try again.");
      await reload();
      toast.success("Your AI twin was deleted");
    });
  };

  if (!state) return <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Checking…</div>;
  const { twin } = state;
  if (!state.pro)
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-[13px]">
        <div className="flex items-center gap-1.5 text-[14px] font-medium">Your AI twin <ProBadge /></div>
        <p className="mt-1 text-muted-foreground">Clone your voice and the way you move once, then turn any script into a video of you, without filming. <Link href="/billing" className="text-primary underline underline-offset-2">Upgrade to Pro</Link></p>
      </div>
    );
  if (!twin.available) return <p className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">AI videos aren’t switched on for this studio yet. Your administrator can turn them on.</p>;

  const needsConsentTick = !twin.voice && !twin.video && !twin.photos.length;
  const consentOk = !needsConsentTick || consent;

  return (
    <div className="space-y-3">
      {twin.ready ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/40 bg-success-soft/40 px-4 py-3 text-[13px]"><Check className="size-4 text-success" /> <span className="font-medium">Your AI twin is ready.</span> <span className="text-muted-foreground">Choose “AI video” when you record, or let your plan make them.</span></div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Three things, once: your voice, a video of you talking, and a few photos. Then any script becomes a video of you, in your voice.</p>
      )}

      <Step n={1} title="Your voice" hint="Read the passage for about a minute, in a quiet room, the way you’d talk to a client." status={<Status part={twin.voice?.status} label={twin.voice?.status === "ready" ? "Cloned" : undefined} />}>
        {twin.voice?.error && <p className="mb-2 text-[12px] text-destructive">{twin.voice.error}</p>}
        {(!twin.voice || twin.voice.status === "failed" || clip) && (
          <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto rounded-lg bg-muted/50 p-3 font-serif text-[15px] leading-relaxed">{PASSAGE.map((p) => <p key={p.slice(0, 16)}>{p}</p>)}</div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <Button size="sm" variant="destructive" onClick={stopRec}><Square /> Stop · {fmtDuration(elapsed)}</Button>
          ) : (
            <Button size="sm" variant={twin.voice?.status === "ready" ? "outline" : "default"} onClick={startRec} disabled={!!busy}><Mic /> {twin.voice ? "Record again" : "Record my voice"}</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => audioInput.current?.click()} disabled={recording || !!busy}><Upload /> Upload audio</Button>
          <input ref={audioInput} type="file" accept="audio/*" className="hidden" onChange={(e) => { void pickAudio(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {clip && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[12px]">
            <audio src={clip.url} controls className="h-8 min-w-0 flex-1" />
            <span className={cn("tnum", clip.seconds < 30 ? "text-destructive" : "text-muted-foreground")}>{fmtDuration(clip.seconds)}{clip.seconds < 30 ? " · at least 0:30" : ""}</span>
            <Button size="sm" onClick={sendVoice} disabled={!!busy || clip.seconds < 30 || !consentOk}>{busy === "voice" ? <LoaderCircle className="animate-spin" /> : <Check />} Use this recording</Button>
          </div>
        )}
      </Step>

      <Step n={2} title="A video of you talking" hint="About 2 minutes, facing the camera, just you in frame, clear sound. Talk naturally about your work: this is how your twin learns your face, expressions and movements." status={<Status part={twin.video?.status} label={twin.video?.status === "ready" ? "Learned" : twin.video?.status === "working" ? "Learning" : undefined} />}>
        {twin.video?.error && <p className="mb-2 text-[12px] text-destructive">{twin.video.error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={twin.video ? "outline" : "default"} onClick={() => videoInput.current?.click()} disabled={!!busy || !consentOk}>{busy === "video" ? <LoaderCircle className="animate-spin" /> : <VideoIcon />} {twin.video ? "Use a different video" : "Upload my video"}</Button>
          <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" onChange={(e) => { void sendVideo(e.target.files?.[0]); e.target.value = ""; }} />
          {uploadPct && <span className="text-[12px] text-muted-foreground">{uploadPct}</span>}
        </div>
        {twin.video && (
          <div className={cn("mt-3 rounded-lg border px-3 py-2.5 text-[13px]", twin.video.consent === "accepted" ? "border-success/30 bg-success-soft/30" : twin.video.consent === "rejected" ? "border-destructive/30 bg-destructive/5" : "border-primary/40 bg-brass-soft/40")}>
            {twin.video.consent === "accepted" ? (
              <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-success" /> Your consent is recorded.</span>
            ) : (
              <>
                <div className="font-medium">{twin.video.consent === "rejected" ? "Your consent recording wasn’t accepted" : "Last step: record your consent"}</div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">A short clip of you, on camera, saying you agree to your AI twin. It opens in a new tab, takes about a minute, and protects your likeness.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {twin.video.consentUrl && twin.video.consent !== "rejected" && <Button size="sm" asChild><a href={twin.video.consentUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Record my consent</a></Button>}
                  <Button size="sm" variant="outline" onClick={newLink} disabled={!!busy}>{busy === "consent" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} {twin.video.consentUrl ? "Get a new link" : "Get my consent link"}</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Step>

      <Step n={3} title="Photos of you" hint="Two to four clear photos, different outfits or settings if you like. Each becomes a look that moves like you." status={<Status part={twin.photos.length ? (twin.photos.some((p) => p.status === "working") ? "working" : twin.photos.some((p) => p.status === "ready") ? "ready" : "failed") : null} label={twin.photos.some((p) => p.status === "ready") && !twin.photos.some((p) => p.status === "working") ? `${twin.photos.filter((p) => p.status === "ready").length} ready` : undefined} />}>
        <div className="flex flex-wrap gap-2">
          {headshots.map((h) => {
            const id = mediaIdOf(h.url)!;
            const on = selection.includes(id);
            const st = twin.photos.find((p) => p.mediaId === id);
            return (
              <button key={h.id} type="button" onClick={() => setPicked(on ? selection.filter((x) => x !== id) : [...selection, id].slice(0, 6))} aria-pressed={on} className={cn("relative size-20 cursor-pointer overflow-hidden rounded-xl border-2 transition", on ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")} title={st?.error}>
                <img src={h.url} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
                {on && <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                {st?.status === "working" && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] text-white">Adding…</span>}
                {st?.status === "failed" && <span className="absolute inset-x-0 bottom-0 bg-destructive/85 py-0.5 text-center text-[9px] text-white">Didn’t work</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => photoInput.current?.click()} className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/50"><ImagePlus className="size-4" /> Add photo</button>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
        </div>
        {picked && (
          <Button size="sm" className="mt-3" onClick={sendPhotos} disabled={!!busy || !selection.length || !consentOk}>{busy === "photos" ? <LoaderCircle className="animate-spin" /> : <Check />} Use these {selection.length} {selection.length === 1 ? "photo" : "photos"}</Button>
        )}
        {!twin.video && twin.photos.length > 0 && <p className="mt-2 text-[12px] text-muted-foreground">Photos are added once your video is uploaded.</p>}
      </Step>

      {needsConsentTick && (
        <label className="flex items-start gap-2.5 text-[13px]">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
          <span className="text-muted-foreground">{state.consentText} I can delete it at any time.</span>
        </label>
      )}
      {(twin.voice || twin.video) && (
        <button type="button" onClick={removeAll} disabled={!!busy} className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /> Delete my AI twin</button>
      )}
    </div>
  );
}
