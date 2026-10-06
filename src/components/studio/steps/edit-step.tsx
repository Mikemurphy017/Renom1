"use client";

import * as React from "react";
import { ArrowRight, Bookmark, Heart, MessageCircle, Pause, Play, Send, Upload, Wand2, Scissors, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Headshot } from "@/components/shared/headshot";
import { useDraft } from "@/lib/drafts";
import { getTake, subscribeTakes } from "@/lib/media/takes";
import { generateScript } from "@/lib/ai/content";
import { ADVISOR } from "@/lib/mock/advisor";
import type { Video } from "@/lib/types";
import { cn, fmtDuration, sleep } from "@/lib/utils";
import type { StepProps } from "../studio-view";

interface Segment {
  id: string;
  text: string;
  kind: "speech" | "silence" | "retake" | "filler";
  dur: number;
  removed: boolean;
}

function buildSegments(v: Video): Segment[] {
  const s = v.script ?? generateScript(v.title, v.format);
  const lines = [s.hook, ...s.body, s.cta];
  const out: Segment[] = [];
  let n = 0;
  const push = (text: string, kind: Segment["kind"], dur?: number) =>
    out.push({ id: `s${n++}`, text, kind, dur: dur ?? Math.max(1.2, text.split(/\s+/).length / 2.6), removed: kind !== "speech" });
  push("[silence 1.8s]", "silence", 1.8);
  lines.forEach((line, i) => {
    const sentences = line.match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g) ?? [line];
    if (i === 1) push("So the first— sorry, let me start that again.", "retake");
    if (i === 2) push("um, you know,", "filler", 1.1);
    sentences.forEach((sen, j) => {
      push(sen.trim(), "speech");
      if (i === 0 && j === 0) push("[pause 2.4s]", "silence", 2.4);
    });
    if (i === lines.length - 2) push("[pause 3.1s]", "silence", 3.1);
  });
  push("[silence 2.2s]", "silence", 2.2);
  return out;
}

const KIND_LABEL: Record<Segment["kind"], string> = { speech: "", silence: "Dead air", retake: "Bad take", filler: "Filler" };

export function EditStep({ video, complete }: StepProps) {
  const [segments, setSegments] = useDraft<Segment[]>(video.id, "edit.segments", () => buildSegments(video));
  const [t, setT] = React.useState(0);
  const take = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  const takeRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [zoom, setZoom] = React.useState(1.5);
  const [showCuts, setShowCuts] = React.useState(true);
  const [skipCuts, setSkipCuts] = React.useState(true);
  const [social, setSocial] = React.useState(false);
  const [enhance, setEnhance] = React.useState(true);
  const [exporting, setExporting] = React.useState<null | { phase: string; pct: number }>(null);
  const vertical = video.format === "short";

  const timeline = React.useMemo(() => {
    let acc = 0;
    return segments.map((s) => {
      const start = acc;
      acc += s.dur;
      return { ...s, start, end: acc };
    });
  }, [segments]);
  const total = timeline.at(-1)?.end ?? 1;
  const kept = timeline.filter((s) => !s.removed).reduce((a, s) => a + s.dur, 0);
  const current = timeline.find((s) => t >= s.start && t < s.end) ?? timeline[0];

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = takeRef.current;
      if (el) {
        // Real take drives the playhead.
        setT(Math.min(total - 0.01, el.currentTime));
        raf = requestAnimationFrame(tick);
        return;
      }
      setT((prev) => {
        let next = prev + dt;
        if (skipCuts) {
          const seg = timeline.find((s) => next >= s.start && next < s.end);
          if (seg?.removed) next = seg.end;
        }
        if (next >= total) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, skipCuts, timeline, total]);

  const toggleSeg = (id: string) => setSegments((ss) => ss.map((s) => (s.id === id ? { ...s, removed: !s.removed } : s)));

  // Caption: ~5-word window around progress inside current speech segment
  const caption = React.useMemo(() => {
    if (!current || current.kind === "silence") return "";
    const words = current.text.split(/\s+/);
    const p = (t - current.start) / current.dur;
    const idx = Math.min(words.length - 1, Math.floor(p * words.length));
    const startW = Math.floor(idx / 5) * 5;
    return words.slice(startW, startW + 5).map((w, i) => ({ w, on: startW + i === idx }));
  }, [current, t]);

  const doExport = async () => {
    setExporting({ phase: `Rendering ${vertical ? "1080×1920" : "1920×1080"} · captions burned in`, pct: 0 });
    for (let p = 0; p <= 100; p += 4) {
      await sleep(70);
      setExporting({ phase: p < 60 ? `Rendering ${vertical ? "1080×1920" : "1920×1080"} · captions burned in` : "Uploading to your Library…", pct: p });
    }
    await sleep(250);
    setExporting(null);
    toast.success("Export complete", { description: `${fmtDuration(kept)} · ${vertical ? "9:16" : "16:9"} MP4 saved to Library` });
    complete({ runtimeSec: Math.round(kept) });
  };

  const pxPerSec = 14 * zoom;
  const frames = Math.ceil((total * pxPerSec) / 44);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">Cut the pauses. Keep you.</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Renom marked the dead air and retakes. Click any phrase to cut or restore it.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Preview */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="eyebrow">Preview</div>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              Social overlay <Switch checked={social} onCheckedChange={setSocial} />
            </label>
          </div>
          <div className="flex justify-center rounded-md bg-[#06101F] p-4">
            <div className={cn("relative overflow-hidden rounded-md bg-gradient-to-b from-[#2A3B55] to-[#1A2840]", vertical ? "aspect-[9/16] h-[520px] max-h-[60vh]" : "aspect-video w-full")}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#3A4E6E_0%,transparent_70%)]" />
              {take ? (
                <video
                  ref={takeRef}
                  src={take.url}
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                />
              ) : (
                <Headshot pose={current?.kind === "speech" && Math.floor(t / 4) % 3 === 1 ? "point" : "center"} className={cn("absolute bottom-0 left-1/2 -translate-x-1/2", vertical ? "h-[62%]" : "h-[85%]")} />
              )}
              {caption && (
                <div className={cn("absolute inset-x-[8%] text-center", vertical ? "top-[56%]" : "bottom-[12%]")}>
                  <span className="rounded-md bg-black/35 px-2 py-1 text-[17px] leading-snug font-extrabold tracking-tight text-white uppercase [text-shadow:0_2px_8px_rgba(0,0,0,.5)]">
                    {caption.map((c, i) => (
                      <span key={i} className={c.on ? "text-[#E8CFA4]" : undefined}>{c.w} </span>
                    ))}
                  </span>
                </div>
              )}
              {social && (
                <>
                  <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 text-white">
                    {[Heart, MessageCircle, Send, Bookmark].map((I, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <I className="size-6 drop-shadow" />
                        <span className="text-[10px] tnum">{["2.4K", "186", "92", "310"][i]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-x-3 bottom-4 text-white">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="size-7 rounded-full bg-gradient-to-br from-[#D2B07A] to-[#9C7A47]" /> halewealth
                      <span className="rounded border border-white/60 px-1.5 text-[10px] font-medium">Follow</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12px] opacity-90">{video.title} 👇 #FinancialPlanning</p>
                  </div>
                </>
              )}
              {enhance && <span className="absolute top-2 left-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/90">Studio sound</span>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => {
                const el = takeRef.current;
                if (el) {
                  if (el.paused) void el.play();
                  else el.pause();
                } else setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause /> : <Play />}
            </Button>
            <span className="text-[12px] text-muted-foreground tnum">{fmtDuration(t)} / {fmtDuration(total)}</span>
            <span className="ml-auto text-[12px] text-muted-foreground">
              Final length <span className="font-medium text-foreground tnum">{fmtDuration(kept)}</span>
            </span>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
          <Tabs defaultValue="captions" className="min-h-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="captions">Captions</TabsTrigger>
                <TabsTrigger value="script">Script</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground">
                  <span className="tnum">{segments.filter((s) => s.removed).length}</span> cuts · saves <span className="tnum">{fmtDuration(total - kept)}</span>
                </span>
                <Button size="sm" onClick={doExport}><Upload /> Export</Button>
              </div>
            </div>
            <TabsContent value="captions" className="scrollbar-thin mt-2 max-h-[560px] overflow-y-auto rounded-md border border-border bg-background/50 p-4">
              {take && (
                <p className="mb-3 rounded-md border border-primary/30 bg-brass-soft/60 px-3 py-2 text-[12px]">
                  The preview is your real take ({fmtDuration(take.durationSec)}). The transcript and cuts below are still sample data. Once Captions is connected, it will transcribe this take and suggest the cuts.
                </p>
              )}
              <p className="mb-3 text-[12px] text-muted-foreground">
                Click any phrase to cut or restore it. <span className="text-destructive line-through decoration-destructive/70">Red strikethrough</span> is removed from the final video.
              </p>
              <div className="text-[15px] leading-[2]">
                {timeline.map((s) => (
                  <span key={s.id}>
                    <button
                      onClick={() => toggleSeg(s.id)}
                      onDoubleClick={() => setT(s.start)}
                      title={s.removed ? `Restore · ${KIND_LABEL[s.kind] || "Cut"}` : "Click to cut · double-click to seek"}
                      className={cn(
                        "cursor-pointer rounded px-0.5 text-left transition-colors",
                        s.removed ? "bg-warning-soft text-destructive line-through decoration-destructive/70" : "hover:bg-muted",
                        current?.id === s.id && !s.removed && "bg-brass-soft",
                        s.kind === "silence" && "font-mono text-[12px]"
                      )}
                    >
                      {s.text}
                      {s.removed && s.kind !== "speech" && (
                        <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-[10px] font-medium no-underline opacity-80"><Undo2 className="size-2.5" /></span>
                      )}
                    </button>{" "}
                  </span>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="script" className="scrollbar-thin mt-2 max-h-[560px] overflow-y-auto rounded-md border border-border bg-background/50 p-4 text-[14px] leading-relaxed">
              {(video.script ? [video.script.hook, ...video.script.body, video.script.cta] : []).map((l, i) => (
                <p key={i} className="mb-3">{l}</p>
              ))}
              {!video.script && <p className="text-muted-foreground">No approved script attached — captions are generated from the recording.</p>}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="eyebrow">Timeline</div>
          {[
            ["Show cuts", showCuts, setShowCuts],
            ["Skip cuts", skipCuts, setSkipCuts],
            ["Enhance audio", enhance, setEnhance],
          ].map(([label, val, set]) => (
            <label key={label as string} className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Switch checked={val as boolean} onCheckedChange={set as (v: boolean) => void} /> {label as string}
            </label>
          ))}
          <div className="ml-auto flex w-48 items-center gap-2">
            <Scissors className="size-3.5 text-muted-foreground" />
            <Slider value={[zoom]} min={1} max={4} step={0.1} onValueChange={([v]) => setZoom(v)} aria-label="Zoom" />
            <span className="w-8 text-right text-[11px] text-muted-foreground tnum">{zoom.toFixed(1)}×</span>
          </div>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <div
            className="relative cursor-pointer select-none"
            style={{ width: Math.max(total * pxPerSec, 600) }}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const next = Math.max(0, Math.min(total - 0.01, (e.clientX - r.left) / pxPerSec));
              setT(next);
              if (takeRef.current) takeRef.current.currentTime = Math.min(next, takeRef.current.duration || next);
            }}
          >
            {/* ruler */}
            <div className="relative h-5 border-b border-border text-[10px] text-muted-foreground">
              {Array.from({ length: Math.ceil(total / 5) + 1 }).map((_, i) => (
                <span key={i} className="absolute top-0 border-l border-border pl-1 tnum" style={{ left: i * 5 * pxPerSec }}>{fmtDuration(i * 5)}</span>
              ))}
            </div>
            {/* filmstrip */}
            <div className="mt-1.5 flex h-14 overflow-hidden rounded-[4px]">
              {Array.from({ length: frames }).map((_, i) => (
                <div key={i} className="relative h-full w-11 shrink-0 overflow-hidden border-r border-[#06101F] bg-gradient-to-b from-[#2A3B55] to-[#1A2840]">
                  <Headshot pose={i % 7 === 3 ? "point" : "center"} className="absolute bottom-0 left-1/2 h-[90%] -translate-x-1/2" />
                </div>
              ))}
            </div>
            {/* waveform */}
            <div className="mt-1.5 flex h-8 items-center gap-px">
              {Array.from({ length: Math.floor(total * pxPerSec / 3) }).map((_, i) => {
                const sec = (i * 3) / pxPerSec;
                const seg = timeline.find((s) => sec >= s.start && sec < s.end);
                const h = seg?.kind === "silence" ? 6 : 18 + Math.abs(Math.sin(i * 1.7) * 60) + ((i * 37) % 22);
                return <span key={i} className="w-[2px] shrink-0 rounded-full bg-muted-foreground/40" style={{ height: `${Math.round(Math.min(100, h))}%` }} />;
              })}
            </div>
            {/* cuts */}
            {showCuts &&
              timeline.filter((s) => s.removed).map((s) => (
                <div
                  key={s.id}
                  className="absolute top-5 bottom-0 border-x border-destructive/70"
                  style={{
                    left: s.start * pxPerSec,
                    width: s.dur * pxPerSec,
                    background: "repeating-linear-gradient(135deg, rgba(139,46,46,.35) 0 4px, rgba(139,46,46,.15) 4px 8px)",
                  }}
                  title={`${KIND_LABEL[s.kind] || "Cut"} · ${s.dur.toFixed(1)}s`}
                >
                  <span className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-destructive" />
                </div>
              ))}
            {/* playhead */}
            <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-primary" style={{ left: t * pxPerSec }}>
              <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rounded-sm bg-primary" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => { setSegments(buildSegments(video)); toast("Auto-cuts re-applied"); }}><Wand2 /> Re-run auto-cut</Button>
          <Button onClick={doExport}>Finish edit <ArrowRight /></Button>
        </div>
      </div>

      <Dialog open={!!exporting}>
        <DialogContent showClose={false} className="sm:max-w-md">
          <DialogHeader>
            <div className="eyebrow">Export</div>
            <DialogTitle>{exporting && exporting.pct < 60 ? "Rendering your video" : "Uploading"}</DialogTitle>
            <DialogDescription>{exporting?.phase}</DialogDescription>
          </DialogHeader>
          <Progress value={exporting?.pct ?? 0} className="h-2" />
          <div className="flex justify-between text-[12px] text-muted-foreground tnum">
            <span>{ADVISOR.firm} · {video.title.slice(0, 32)}…</span>
            <span>{exporting?.pct ?? 0}%</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
