"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play, RotateCcw, Sparkles, TriangleAlert, Video as VideoIcon, Wand2, Scissors, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/page";
import { peekDraft, useDraft } from "@/lib/drafts";
import { getTake, subscribeTakes } from "@/lib/media/takes";
import { generateScript } from "@/lib/ai/content";
import { useStore } from "@/lib/store";
import { BRAND } from "@/lib/brand";
import type { Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { analyzeTake, renderFinal, restoreAnalysis, usePipeline, type PipelineState } from "@/lib/video/client";
import { cutsFromSegments, defaultOverlays, segmentsFromResult, type Segment } from "@/lib/video/edit-model";
import { DEFAULT_EDIT, type OverlayOptions } from "@/lib/video/types";
import type { StepProps } from "../studio-view";
import { LookPanel, PreviewOverlays, type LookPeek } from "./edit-look";

const scriptLines = (v: Video) => {
  const s = v.script ?? generateScript(v.title, v.format);
  return [s.hook, ...s.body, s.cta];
};

const KIND_LABEL: Record<Segment["kind"], string> = { speech: "", silence: "Dead air", retake: "Bad take", filler: "Filler" };

export function EditStep(props: StepProps) {
  const { video } = props;
  const { updateVideo, profile } = useStore();
  const analysis = usePipeline(video.id, "analyze");
  const memTake = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  const take = memTake ?? video.take;
  // Bring back the last reading of this take, or read it now if there isn't one.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (analysis || !take || started.current) return;
    started.current = true;
    const analyze = () =>
      analyzeTake(video.id, take, {
        aspect: take.height > take.width ? "9:16" : "16:9",
        edit: DEFAULT_EDIT,
        overlays: peekDraft<OverlayOptions>(video.id, "edit.overlays") ?? defaultOverlays(profile, video.format),
        script: scriptLines(video),
      }).catch(() => {});
    const stored = video.take;
    if (video.analysisJobId && stored) restoreAnalysis(video.id, video.analysisJobId, stored.sourceId).then((ok) => {
        if (!ok) void analyze();
      });
    else analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, take]);
  const doneJob = analysis?.phase === "done" ? analysis.result?.jobId : undefined;
  React.useEffect(() => {
    if (doneJob && doneJob !== video.analysisJobId) updateVideo(video.id, { analysisJobId: doneJob });
  }, [doneJob, video.id, video.analysisJobId, updateVideo]);
  if (!take) {
    return (
      <div className="py-16">
        <EmptyState
          icon={VideoIcon}
          title="Record a take first"
          description="Your recording shows up here with the pauses already marked."
          action={<Button asChild className="rounded-full"><Link href={`/studio/${video.id}/record`}><VideoIcon /> Go to Record</Link></Button>}
        />
      </div>
    );
  }
  // Remount when a processed result arrives so the transcript switches over cleanly.
  return <EditStudio key={analysis?.result?.jobId ?? "sample"} {...props} analysis={analysis} />;
}

function EditStudio({ video, complete, analysis }: StepProps & { analysis?: PipelineState }) {
  const { profile } = useStore();
  const result = analysis?.result;
  const [segments, setSegments] = useDraft<Segment[]>(video.id, result ? `edit.segments.${result.jobId}` : "edit.segments.none", () => (result ? segmentsFromResult(result) : []));
  const [look, setLook] = useDraft<OverlayOptions>(video.id, "edit.overlays", () => defaultOverlays(profile, video.format));
  const [peek, setPeek] = React.useState<LookPeek>(null);
  const render = usePipeline(video.id, "render");
  const [rendering, setRendering] = React.useState(false);
  const [t, setT] = React.useState(0);
  const memTake = React.useSyncExternalStore(subscribeTakes, () => getTake(video.id), () => undefined);
  // This tab's take if there is one, otherwise the one saved to platform storage.
  const take = memTake ?? video.take;
  const takeRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [zoom, setZoom] = React.useState(1.5);
  const [showCuts, setShowCuts] = React.useState(true);
  const [skipCuts, setSkipCuts] = React.useState(true);
  const [enhance, setEnhance] = React.useState(true);
  const vertical = video.format === "short";

  const timeline = React.useMemo(() => {
    let acc = 0;
    return segments.map((s) => {
      const start = acc;
      acc += s.dur;
      return { ...s, start, end: acc };
    });
  }, [segments]);
  const total = timeline.at(-1)?.end ?? take?.durationSec ?? 1;
  const kept = timeline.filter((s) => !s.removed).reduce((a, s) => a + s.dur, 0);
  const current = timeline.find((s) => t >= s.start && t < s.end) ?? timeline[0];
  const keptSpan = timeline.filter((s) => !s.removed);
  const firstKept = keptSpan[0]?.start ?? 0;
  const lastKept = keptSpan.at(-1)?.end ?? total;
  const keyPhrases = React.useMemo(
    () => result?.keyPhrases ?? [...new Set(segments.filter((s) => s.kind === "speech").flatMap((s) => s.text.split(/\s+/).filter((w) => /[\d$%]/.test(w))))],
    [result, segments]
  );

  // Show the overlay the advisor just changed for a moment, wherever the playhead is.
  React.useEffect(() => {
    if (!peek) return;
    const id = setTimeout(() => setPeek(null), 2500);
    return () => clearTimeout(id);
  }, [peek, look]);

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = takeRef.current;
      if (el) {
        // Real take drives the playhead. Cuts only line up with it once it has been processed.
        if (skipCuts && result) {
          const seg = timeline.find((s) => el.currentTime >= s.start && el.currentTime < s.end);
          if (seg?.removed) {
            if (seg.end >= total - 0.05) el.pause();
            else el.currentTime = seg.end;
          }
        }
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
  }, [playing, skipCuts, timeline, total, result]);

  const toggleSeg = (id: string) => setSegments((ss) => ss.map((s) => (s.id === id ? { ...s, removed: !s.removed } : s)));

  // Caption: ~5-word window around progress inside current speech segment
  const caption = React.useMemo(() => {
    // While the advisor tweaks captions, preview them even over a pause.
    if (peek === "captions" && (!current || current.kind === "silence" || current.removed)) {
      const first = timeline.find((s) => s.kind === "speech");
      return first ? first.text.split(/\s+/).slice(0, 5).map((w, i) => ({ w, on: i === 1 })) : "";
    }
    if (!current || current.kind === "silence") return "";
    const words = current.text.split(/\s+/);
    const p = (t - current.start) / current.dur;
    const idx = Math.min(words.length - 1, Math.floor(p * words.length));
    const startW = Math.floor(idx / 5) * 5;
    return words.slice(startW, startW + 5).map((w, i) => ({ w, on: startW + i === idx }));
  }, [current, t, peek, timeline]);

  const sourceId = result ? analysis?.sourceId : undefined;
  const changeLook = (next: OverlayOptions, p: LookPeek) => {
    setLook(next);
    setPeek(p);
  };

  const processTake = () => {
    if (!take) return;
    analyzeTake(video.id, take, { aspect: take.height > take.width ? "9:16" : "16:9", edit: DEFAULT_EDIT, overlays: look, script: scriptLines(video) }).catch((e) =>
      toast.error("AI Edit couldn’t process this take", { description: (e as Error).message })
    );
  };

  const doExport = async () => {
    if (!sourceId) {
      toast("Still reading your take", { description: "Give it a moment, then finish the edit." });
      return;
    }
    setRendering(true);
    try {
      const aspect = vertical ? "9:16" : "16:9";
      const out = await renderFinal(video.id, sourceId, {
        aspect,
        edit: { ...DEFAULT_EDIT, enhanceAudio: enhance },
        overlays: look,
        script: scriptLines(video),
        cuts: cutsFromSegments(segments),
      });
      toast.success("Your video is ready", { description: `${fmtDuration(out.durationSec)} · ${aspect} MP4` });
      complete({
        runtimeSec: Math.round(out.durationSec),
        outputUrl: out.outputUrl,
        output: out.outputId && out.outputUrl ? { id: out.outputId, url: out.outputUrl, durationSec: out.durationSec, sizeBytes: out.sizeBytes, aspect, renderedAt: new Date().toISOString() } : undefined,
      });
    } catch (e) {
      toast.error("Render failed", { description: (e as Error).message });
    } finally {
      setRendering(false);
    }
  };

  const dialog = rendering ? { title: "Rendering your video", phase: render?.status ?? "Starting…", pct: Math.round((render?.progress ?? 0) * 100) } : null;
  const busy = !analysis || analysis.phase === "uploading" || analysis.phase === "processing";

  const pxPerSec = 14 * zoom;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">Cut the pauses. Keep you.</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{BRAND.name} found the pauses in your audio. Click any phrase to cut or restore it, pick your look, then finish.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Preview + look */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">Preview</div>
              <span className="text-[12px] text-muted-foreground">Your take, with cuts skipped</span>
            </div>
            <div className="flex justify-center rounded-md bg-[#06101F] p-4">
              <div className={cn("relative overflow-hidden rounded-md bg-gradient-to-b from-[#2A3B55] to-[#1A2840]", vertical ? "aspect-[9/16] h-[520px] max-h-[60vh]" : "aspect-video w-full")}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#3A4E6E_0%,transparent_70%)]" />
                {take && (
                  <video
                    ref={takeRef}
                    src={take.url}
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                  />
                )}
                <PreviewOverlays
                  look={look}
                  caption={caption}
                  keyPhrases={keyPhrases}
                  vertical={vertical}
                  showLowerThird={peek === "lowerThird" || (!peek && t < firstKept + 5)}
                  showEndCard={peek === "endCard" || (!peek && t >= lastKept - 2.5 && t > firstKept + 5)}
                />
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
          <LookPanel value={look} onChange={changeLook} brandColors={profile.brandColors} />
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
                <Button size="sm" onClick={doExport} disabled={!!busy || rendering || !sourceId}>Finish edit <ArrowRight /></Button>
              </div>
            </div>
            <TabsContent value="captions" className="scrollbar-thin mt-2 max-h-[560px] overflow-y-auto rounded-md border border-border bg-background/50 p-4">
              <ProcessingNotice analysis={analysis} hasTake={!!take} takeSec={take?.durationSec} onProcess={processTake} />
              <p className="mb-3 text-[12px] text-muted-foreground">
                Click any phrase to cut or restore it. <span className="text-destructive line-through decoration-destructive/70">Red strikethrough</span> is removed from the final video.
              </p>
              <div className={cn("text-[15px] leading-[2] transition-opacity", busy && "pointer-events-none opacity-40")}>
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
            <Filmstrip src={take?.url} total={total} width={Math.max(total * pxPerSec, 600)} />
            {/* waveform */}
            <div className="mt-1.5 flex h-8 items-center gap-px">
              {Array.from({ length: Math.floor((total * pxPerSec) / 3) }).map((_, i) => {
                const sec = (i * 3) / pxPerSec;
                const lv = result?.levels?.[Math.floor(sec * 10)];
                const h = lv === undefined ? 4 : 6 + lv * 94;
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
          <Button variant="outline" disabled={!result} onClick={() => { if (result) setSegments(segmentsFromResult(result)); toast("Auto-cuts re-applied"); }}><Wand2 /> Re-run auto-cut</Button>
          <Button onClick={doExport} disabled={!!busy || rendering || !sourceId}>Finish edit <ArrowRight /></Button>
        </div>
      </div>

      <Dialog open={!!dialog}>
        <DialogContent showClose={false} className="sm:max-w-md">
          <DialogHeader>
            <div className="eyebrow">Rendering</div>
            <DialogTitle>{dialog ? dialog.title : "Rendering your video"}</DialogTitle>
            <DialogDescription>{dialog ? dialog.phase : ""}</DialogDescription>
          </DialogHeader>
          <Progress value={dialog ? dialog.pct : 0} className="h-2" />
          <div className="flex justify-between text-[12px] text-muted-foreground tnum">
            <span>{profile.firm} · {video.title.slice(0, 32)}…</span>
            <span>{dialog ? dialog.pct : 0}%</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Where the edit stands for this take: reading it, done, or failed. */
function ProcessingNotice({ analysis, hasTake, onProcess }: { analysis?: PipelineState; hasTake: boolean; takeSec?: number; onProcess: () => void }) {
  if (!analysis || analysis.phase === "uploading" || analysis.phase === "processing") {
    return (
      <div className="mb-3 rounded-md border border-primary/30 bg-brass-soft/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <span className="flex items-center gap-1.5 font-medium"><Sparkles className="size-3.5 animate-pulse text-primary" /> {analysis?.status ?? "Getting your take…"}</span>
          <span className="text-muted-foreground tnum">{Math.round((analysis?.progress ?? 0) * 100)}%</span>
        </div>
        <Progress value={(analysis?.progress ?? 0) * 100} className="mt-2 h-1.5" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">Finding the pauses and lining up your script. Takes a few seconds.</p>
      </div>
    );
  }
  if (analysis.phase === "error") {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-warning-soft px-3 py-2 text-[12px]">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <span className="flex-1">Couldn’t read this take. {analysis.error}</span>
        {hasTake && <Button size="xs" variant="outline" onClick={onProcess}><RotateCcw /> Try again</Button>}
      </div>
    );
  }
  return <p className="mb-3 text-[11px] text-muted-foreground">Pauses come from your audio. Caption words follow your script, timed to when you were talking.</p>;
}

/** Real frames from the take along the timeline. */
function Filmstrip({ src, total, width }: { src?: string; total: number; width: number }) {
  const count = Math.max(1, Math.ceil(width / 44));
  const [frames, setFrames] = React.useState<string[]>([]);
  const step = total / count;
  React.useEffect(() => {
    if (!src) return;
    let live = true;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = src;
    const c = document.createElement("canvas");
    const out: string[] = [];
    const seek = (t: number) =>
      new Promise<void>((res) => {
        const done = () => (v.removeEventListener("seeked", done), res());
        v.addEventListener("seeked", done);
        setTimeout(done, 3000);
        v.currentTime = t;
      });
    (async () => {
      await new Promise<void>((res) => (v.readyState >= 2 ? res() : v.addEventListener("loadeddata", () => res(), { once: true })));
      c.height = 112;
      c.width = Math.round((v.videoWidth / Math.max(1, v.videoHeight)) * 112) || 63;
      const ctx = c.getContext("2d")!;
      const n = Math.min(count, 40);
      for (let i = 0; i < n && live; i++) {
        await seek(Math.min(total - 0.1, (i + 0.5) * (total / n)));
        ctx.drawImage(v, 0, 0, c.width, c.height);
        out.push(c.toDataURL("image/jpeg", 0.6));
        if (live) setFrames([...out]);
      }
    })().catch(() => {});
    return () => {
      live = false;
      v.removeAttribute("src");
      v.load();
    };
  }, [src, total, count]);
  return (
    <div className="mt-1.5 flex h-14 overflow-hidden rounded-[4px] bg-[#1A2840]">
      {Array.from({ length: count }).map((_, i) => {
        const f = frames.length ? frames[Math.min(frames.length - 1, Math.floor((i * step) / (total / Math.min(count, 40))))] : undefined;
        return (
          <div key={i} className="relative h-full w-11 shrink-0 overflow-hidden border-r border-[#06101F]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f && <img src={f} alt="" className="h-full w-full object-cover" />}
          </div>
        );
      })}
    </div>
  );
}
