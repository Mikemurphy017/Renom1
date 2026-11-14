"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own photos */
import * as React from "react";
import Link from "next/link";
import { Check, Clapperboard, LoaderCircle, RefreshCw, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProUpsell } from "@/components/shared/pro";
import type { Script, Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";

/**
 * The Record step's other way to make the video: the advisor's AI twin says
 * this video's script, in their voice. When it's done, "Use this video" makes
 * it the take, and it goes on to Edit and Post like a recording.
 */

export interface AiVideoJob {
  id: string;
  createdAt: string;
  videoId?: string;
  script: string;
  aspect: "9:16" | "16:9";
  status: "working" | "ready" | "failed";
  error?: string;
  uploadId?: string;
  videoUrl?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  elapsedSec: number;
}
interface Config {
  available: boolean;
  pro: boolean;
  twinReady: boolean;
  missing: string[];
  limits: { maxWords: number };
}
interface Look {
  id: string;
  label: string;
  mediaId?: string;
  aspect?: "9:16" | "16:9";
}

const words = (s: string) => (s.trim().match(/\S+/g) ?? []).length;
const WPS = 2.6;

export function AiVideoOption({ video, script, onUse, using }: { video: Video; script: Script; onUse: (job: AiVideoJob) => void; using?: boolean }) {
  const full = [script.hook, ...script.body, script.cta].map((l) => l.trim()).filter(Boolean).join(" ");
  const [cfg, setCfg] = React.useState<Config | null>(null);
  const [jobs, setJobs] = React.useState<AiVideoJob[]>([]);
  const [looks, setLooks] = React.useState<Look[]>([]);
  const [look, setLook] = React.useState<string>("");
  const [text, setText] = React.useState(full);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [a, t] = await Promise.all([fetch("/api/aivideo", { cache: "no-store" }).then((r) => r.json()).catch(() => null), fetch("/api/twin", { cache: "no-store" }).then((r) => r.json()).catch(() => null)]);
    if (a?.ok) {
      setCfg({ available: a.available, pro: a.pro, twinReady: a.twinReady, missing: a.missing ?? [], limits: a.limits });
      setJobs((a.jobs as AiVideoJob[]).filter((j) => j.videoId === video.id));
    }
    if (t?.ok) {
      setLooks(t.twin.looks ?? []);
      setLook((l) => l || t.twin.defaultLook || t.twin.looks?.[0]?.id || "");
    }
  }, [video.id]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const working = jobs.filter((j) => j.status === "working").map((j) => j.id).join(",");
  React.useEffect(() => {
    if (!working) return;
    const t = window.setInterval(async () => {
      for (const id of working.split(",")) {
        const j = await fetch(`/api/aivideo/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (!j?.ok) continue;
        const next = j.job as AiVideoJob;
        setJobs((js) => {
          const prev = js.find((x) => x.id === id);
          if (prev?.status === "working" && next.status === "ready") toast.success("Your AI video is ready");
          if (prev?.status === "working" && next.status === "failed") toast.error(next.error ?? "That one didn’t work.");
          return js.map((x) => (x.id === id ? next : x));
        });
      }
    }, 8000);
    return () => window.clearInterval(t);
  }, [working]);

  const make = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/aivideo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: text, videoId: video.id, aspect: video.format === "long" ? "16:9" : "9:16", lookId: look || undefined, title: video.title }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Couldn’t start the video.");
      setJobs((js) => [j.job, ...js]);
      toast.success("Making your AI video", { description: "Usually a few minutes. You can leave this page; it carries on." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <div className="flex justify-center rounded-2xl border border-border bg-card p-10"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>;
  if (!cfg.pro) return <ProUpsell title="AI video" body="Skip the camera. Your AI twin says this script, in your own voice, looking and moving like you." />;
  if (!cfg.available) return <p className="rounded-2xl border border-border bg-card p-6 text-[14px] text-muted-foreground">AI videos aren’t switched on for this studio yet. Your administrator can turn them on.</p>;
  if (!cfg.twinReady)
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <UserRound className="mx-auto size-6 text-primary" />
        <h2 className="mt-2 font-serif text-2xl">{cfg.missing.length && cfg.missing.length < 3 ? "Your AI twin is almost ready" : "Set up your AI twin first"}</h2>
        {cfg.missing.length ? (
          <ul className="mx-auto mt-2 max-w-md space-y-1 text-left text-[14px] text-muted-foreground">
            <li className="text-[13px] font-medium text-foreground">Still needed:</li>
            {cfg.missing.map((m) => <li key={m} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{m}</li>)}
          </ul>
        ) : (
          <p className="mx-auto mt-1 max-w-md text-[14px] text-muted-foreground">Once: your voice, a video of you talking and a few photos. Then any script becomes a video of you, without filming.</p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild className="rounded-full"><Link href="/settings#ai-twin">{cfg.missing.length && cfg.missing.length < 3 ? "Finish my AI twin" : "Set up my AI twin"}</Link></Button>
          <Button variant="outline" className="rounded-full" onClick={() => void load()}>Check again</Button>
        </div>
      </div>
    );

  const n = words(text);
  const over = n > cfg.limits.maxWords;
  return (
    <div className="space-y-5">
      {jobs.map((j) => (
        <div key={j.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className={cn("relative shrink-0 overflow-hidden rounded-xl bg-[#06101F]", j.aspect === "9:16" ? "aspect-[9/16] w-40" : "aspect-video w-72")}>
            {j.status === "ready" && j.videoUrl ? <video src={j.videoUrl} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white/60">{j.status === "failed" ? <TriangleAlert className="size-6" /> : <LoaderCircle className="size-6 animate-spin" />}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-muted-foreground">{j.status === "ready" ? `Ready · ${fmtDuration(j.durationSec ?? 0)}` : j.status === "working" ? `Making it · ${fmtDuration(j.elapsedSec)} so far, usually a few minutes` : "Didn’t work"}</div>
            <p className="mt-1 line-clamp-3 font-serif text-[15px] leading-snug">“{j.script}”</p>
            {j.status === "failed" && <p className="mt-2 text-[13px] text-destructive">{j.error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {j.status === "ready" && <Button className="rounded-full" onClick={() => onUse(j)} disabled={using}>{using ? <LoaderCircle className="animate-spin" /> : <Check />} Use this video</Button>}
              {j.status === "failed" && <Button variant="outline" className="rounded-full" onClick={make} disabled={busy}><RefreshCw /> Try again</Button>}
            </div>
            {j.status === "ready" && <p className="mt-2 text-[12px] text-muted-foreground">It goes on to Edit for captions, then Post.</p>}
          </div>
        </div>
      ))}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><Clapperboard className="size-4 text-primary" /> {jobs.length ? "Make another version" : "Make it with your AI twin"}</div>
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-2 text-[12px]">
            <span className="font-medium text-muted-foreground">Look{look && looks.length > 1 ? `: ${looks.find((l) => l.id === look)?.label ?? ""}` : ""}</span>
            <Link href="/settings#ai-twin-looks" className="text-primary underline-offset-2 hover:underline">New look</Link>
          </div>
          {looks.length > 1 && (
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {looks.map((l) => (
                <button key={l.id} type="button" onClick={() => setLook(l.id)} aria-pressed={look === l.id} className={cn("relative h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 bg-muted text-[11px] text-muted-foreground", look === l.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")} title={l.label}>
                  {l.mediaId ? <img src={`/api/media/${l.mediaId}`} alt={l.label} className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center px-1 text-center">{l.label}</span>}
                  {l.aspect && l.aspect !== (video.format === "long" ? "16:9" : "9:16") && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[9px] text-white">{l.aspect === "16:9" ? "Wide" : "Vertical"}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">What you’ll say</div>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} className="font-serif text-[15px]" />
          <div className="mt-1.5 flex justify-between text-[12px]">
            <span className={cn("tnum", over ? "font-medium text-destructive" : "text-muted-foreground")}>{n} / {cfg.limits.maxWords} words</span>
            <span className="text-muted-foreground tnum">about {fmtDuration(Math.round(n / WPS))}</span>
          </div>
          {text.trim() !== full && <button type="button" onClick={() => setText(full)} className="mt-1 cursor-pointer text-[12px] text-primary underline-offset-2 hover:underline">Use the full script again</button>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-muted-foreground">In your voice, moving like you. It carries on if you leave this page.</span>
          <Button className="rounded-full px-5" onClick={make} disabled={busy || n < 5 || over}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Make my AI video</Button>
        </div>
      </section>
    </div>
  );
}
