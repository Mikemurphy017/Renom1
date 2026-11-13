"use client";

import * as React from "react";
import Link from "next/link";
import { Check, LoaderCircle, Mic, Play, Square, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ProBadge } from "@/components/shared/pro";
import { usePro } from "@/lib/store";
import { cn, fmtDuration } from "@/lib/utils";

/**
 * The advisor's AI voice: record (or upload) a minute or two of them talking,
 * once, and Renom has a copy of their voice to read their scripts. Part of
 * onboarding and Settings. Nothing here names the provider.
 */

export interface VoiceStatus {
  configured: boolean;
  voice: { createdAt: string; sampleSeconds: number | null } | null;
}

export function useVoiceStatus() {
  const [status, setStatus] = React.useState<VoiceStatus | null>(null);
  const load = React.useCallback(async () => {
    const r = await fetch("/api/voice", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as (VoiceStatus & { ok: boolean }) | null;
    setStatus(j?.ok ? { configured: j.configured, voice: j.voice } : { configured: false, voice: null });
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  return { status, reload: load };
}

const PASSAGE = [
  "Hi, I’m a financial advisor, and I spend most of my days helping families make sense of their money.",
  "People usually come to me with one question, and leave with a plan. When should I retire? How much is enough? What do I do with the stock options from work?",
  "The honest answer is that it depends, and that’s exactly why it’s worth sitting down together. Taxes, timing and the way you actually want to live all matter more than any single fund.",
  "I like to start simple. Where are you today, where do you want to be, and what keeps you up at night? From there, we build something you can follow, and we adjust it as life changes.",
  "If any of that sounds familiar, I’d love to talk. No pressure, no jargon, just a clear next step.",
];

const MIN_SEC = 45;
const GOOD_SEC = 90;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

export function AiVoiceSection() {
  const { isPro } = usePro();
  const { status, reload } = useVoiceStatus();
  const [clips, setClips] = React.useState<{ blob: Blob; name: string; seconds: number; url: string }[]>([]);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "create" | "preview" | "delete">("");
  const [remaking, setRemaking] = React.useState(false);
  const rec = React.useRef<{ mr: MediaRecorder; stream: MediaStream; started: number; timer: number } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(
    () => () => {
      rec.current?.stream.getTracks().forEach((t) => t.stop());
      if (rec.current) clearInterval(rec.current.timer);
    },
    []
  );

  const total = clips.reduce((a, c) => a + c.seconds, 0);

  const start = async () => {
    const mime = pickMime();
    if (!mime) return toast.error("This browser can’t record audio", { description: "Use a current Chrome, Edge, Safari or Firefox, or upload a recording instead." });
    let stream: MediaStream;
    try {
      // Raw voice: no processing, so the clone hears how you really sound.
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
      if (seconds < 5) return toast("That was very short", { description: "Read the whole passage at your normal pace." });
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      setClips((c) => [...c, { blob, name: `recording-${c.length + 1}.${ext}`, seconds, url: URL.createObjectURL(blob) }].slice(-4));
    };
    mr.start(1000);
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 250);
    rec.current = { mr, stream, started, timer };
    setElapsed(0);
    setRecording(true);
  };

  const stop = () => {
    const r = rec.current;
    if (!r) return;
    clearInterval(r.timer);
    r.mr.stop();
    rec.current = null;
    setRecording(false);
  };

  const addFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 4)) {
      if (!f.type.startsWith("audio/")) {
        toast.error(`${f.name} isn’t an audio file`);
        continue;
      }
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} is over 20 MB`);
        continue;
      }
      const url = URL.createObjectURL(f);
      const seconds = await new Promise<number>((res) => {
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? Math.round(a.duration) : 60);
        a.onerror = () => res(60);
        a.src = url;
      });
      setClips((c) => [...c, { blob: f, name: f.name, seconds, url }].slice(-4));
    }
  };

  const create = async () => {
    setBusy("create");
    try {
      const form = new FormData();
      for (const c of clips) form.append("files", c.blob, c.name);
      form.append("consent", consent ? "yes" : "no");
      form.append("seconds", String(total));
      const r = await fetch("/api/voice", { method: "POST", body: form });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Couldn’t make your AI voice.");
      clips.forEach((c) => URL.revokeObjectURL(c.url));
      setClips([]);
      setRemaking(false);
      await reload();
      toast.success("Your AI voice is ready", { description: "Tap “Hear it” to hear it read a sample." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const preview = async () => {
    setBusy("preview");
    try {
      const r = await fetch("/api/voice/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn’t play a sample.");
      const url = URL.createObjectURL(await r.blob());
      audio.current?.pause();
      audio.current = new Audio(url);
      audio.current.onended = () => URL.revokeObjectURL(url);
      await audio.current.play();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    if (!confirm("Delete your AI voice? You can make it again anytime.")) return;
    setBusy("delete");
    try {
      const r = await fetch("/api/voice", { method: "DELETE" });
      if (!r.ok) throw new Error("Couldn’t delete it. Try again.");
      await reload();
      toast.success("Your AI voice was deleted");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!isPro)
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-[13px]">
        <div className="flex items-center gap-1.5 text-[14px] font-medium">Your AI voice <ProBadge /></div>
        <p className="mt-1 text-muted-foreground">Clone your voice once, from a minute or two of you talking, so your scripts can be read in your own voice. <Link href="/billing" className="text-primary underline underline-offset-2">Upgrade to Pro</Link></p>
      </div>
    );
  if (!status) return <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Checking…</div>;
  if (!status.configured) return <p className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">AI voice isn’t switched on for this studio yet. Your administrator can turn it on.</p>;

  if (status.voice && !remaking)
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[14px] font-medium"><Check className="size-4 text-success" /> Your AI voice is ready</div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Made {new Date(status.voice.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}{status.voice.sampleSeconds ? ` from ${fmtDuration(status.voice.sampleSeconds)} of you talking` : ""}. Tap “Hear it” to hear it read a sample.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={preview} disabled={!!busy}>{busy === "preview" ? <LoaderCircle className="animate-spin" /> : <Play />} Hear it</Button>
            <Button size="sm" variant="outline" onClick={() => setRemaking(true)} disabled={!!busy}><Mic /> Remake</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={!!busy}>{busy === "delete" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Delete</Button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-[13px] font-medium">Read this out loud, the way you’d talk to a client</div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">A quiet room, your usual mic, about a foot away. Aim for {fmtDuration(GOOD_SEC)} or more in total: read it twice, or keep talking about your work.</p>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg bg-muted/50 p-3 font-serif text-[16px] leading-relaxed">
          {PASSAGE.map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {recording ? (
            <Button size="sm" variant="destructive" onClick={stop}><Square /> Stop · {fmtDuration(elapsed)}</Button>
          ) : (
            <Button size="sm" onClick={start} disabled={!!busy || clips.length >= 4}><Mic /> {clips.length ? "Record more" : "Start recording"}</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} disabled={recording || !!busy || clips.length >= 4}><Upload /> Upload audio</Button>
          <input ref={fileInput} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
          {recording && <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-destructive" /> Recording</span>}
        </div>
        {clips.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {clips.map((c, i) => (
              <li key={c.url} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[12px]">
                <audio src={c.url} controls className="h-8 min-w-0 flex-1" />
                <span className="text-muted-foreground tnum">{fmtDuration(c.seconds)}</span>
                <button type="button" aria-label="Remove recording" className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { URL.revokeObjectURL(c.url); setClips((cs) => cs.filter((_, j) => j !== i)); }}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-[width]", total >= GOOD_SEC ? "bg-success" : total >= MIN_SEC ? "bg-primary" : "bg-muted-foreground/40")} style={{ width: `${Math.min(100, (total / GOOD_SEC) * 100)}%` }} /></div>
          <p className="mt-1 text-[11px] text-muted-foreground tnum">{fmtDuration(total)} recorded · {total >= GOOD_SEC ? "plenty" : total >= MIN_SEC ? "enough; a little more sounds even better" : `at least ${fmtDuration(MIN_SEC)} needed`}</p>
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[13px]">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span className="text-muted-foreground">This is my own voice, and I agree to it being used to create an AI voice that reads my scripts. I can delete it at any time.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={create} disabled={!consent || total < MIN_SEC || recording || !!busy}>{busy === "create" ? <><LoaderCircle className="animate-spin" /> Making your voice…</> : <><Check /> Create my AI voice</>}</Button>
        {remaking && <Button variant="ghost" onClick={() => setRemaking(false)} disabled={!!busy}>Cancel</Button>}
      </div>
    </div>
  );
}
