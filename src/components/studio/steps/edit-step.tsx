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
import { usePro, useStore, voiceProfileOf } from "@/lib/store";
import { scriptFromTranscript } from "@/lib/video/from-transcript";
import { BRAND } from "@/lib/brand";
import type { Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { analyzeTake, renderFinal, restoreAnalysis, usePipeline, type PipelineState } from "@/lib/video/client";
import { clippable } from "@/lib/video/clips";
import { ClipMaker } from "../clip-maker";
import { cutsFromSegments, defaultOverlays, segmentsFromResult, type Segment } from "@/lib/video/edit-model";
import { DEFAULT_EDIT, type OverlayOptions } from "@/lib/video/types";
import type { StepProps } from "../studio-view";
import { LookPanel, PreviewOverlays, captionAt, type LookPeek } from "./edit-look";
import { DEFAULT_CTA, bookingCta, bookingOn, isBookingCta } from "@/lib/booking";
import { getStyle, normalizeOverlays } from "@/lib/video/styles";

const scriptLines = (v: Video) => {
  // A video brought in finished has no script: its words come from the voice alone.
  if (!v.script && v.source === "upload") return undefined;
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
  // A finished video brought in without a script: its transcript becomes the title, outline and script.
  const reading = React.useRef<string | null>(null);
  React.useEffect(() => {
    const r = analysis?.phase === "done" ? analysis.result : undefined;
    if (!r || video.source !== "upload" || video.script || reading.current === r.jobId || r.transcript.length < 3) return;
    reading.current = r.jobId;
    void scriptFromTranscript(r, voiceProfileOf(profile), video.format).then((patch) => {
      updateVideo(video.id, patch);
      toast.success("Got the words from your video", { description: `“${patch.title}”. Captions and posts will be written from what you said.` });
    });
  }, [analysis, video.source, video.script, video.id, video.format, profile, updateVideo]);
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
  const { profile, updateVideo } = useStore();
  const { isPro } = usePro();
  const result = analysis?.result;
  const [segments, setSegments] = useDraft<Segment[]>(video.id, result ? `edit.segments.${result.jobId}` : "edit.segments.none", () => (result ? segmentsFromResult(result) : []));
  const [rawLook, setLook] = useDraft<OverlayOptions>(video.id, "edit.overlays", () => defaultOverlays(profile, video.format));
  // Looks saved before styles existed get upgraded in place.
  const look = React.useMemo(() => normalizeOverlays(rawLook), [rawLook]);
  const [stockFootage, setStockFootage] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/media").then((r) => r.json()).then((j) => setStockFootage(!!j.stock)).catch(() => {});
  }, []);
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
  // 4K export only when the take fills a 4K frame of this shape (a 4K camera, same orientation).
  const can4k = !!take?.width && !!take?.height && Math.max((vertical ? 2160 : 3840) / take.width, (vertical ? 3840 : 2160) / take.height) <= 1.05;
  const [export4k, setExport4k] = React.useState(false);

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
  // Captions follow the real word timings (the preview plays the original take).
  const caption = React.useMemo(() => {
    const words = result?.transcript ?? [];
    const st = getStyle(look.captions.style);
    const live = captionAt(words, t, st, vertical);
    if (live || peek !== "captions") return live;
    // While the advisor tweaks the look, show the first line even over a pause.
    return captionAt(words, words[Math.min(1, words.length - 1)]?.start ?? 0, st, vertical);
  }, [result, t, peek, look.captions.style, vertical]);

  const sourceId = result ? analysis?.sourceId : undefined;
  const aspect = vertical ? "9:16" : "16:9";
  const cuts = React.useMemo(() => cutsFromSegments(segments), [segments]);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [tab, setTab] = React.useState<"trim" | "look">("trim");
  const [showTimeline, setShowTimeline] = React.useState(false);
  const changeLook = (next: OverlayOptions, p: LookPeek) => {
    setLook(next);
    setPeek(p);
  };

  // ── calendar link: in the caption and as the end card's call to action, unless switched off ──
  const calendarUrl = profile.calendarUrl;
  const booking = bookingOn(video, profile);
  const setBooking = (on: boolean) => {
    updateVideo(video.id, { bookingLink: on });
    const ec = look.endCard;
    changeLook({ ...look, endCard: on && calendarUrl ? { ...ec, enabled: true, cta: bookingCta(calendarUrl) } : { ...ec, cta: isBookingCta(ec.cta) ? DEFAULT_CTA : ec.cta } }, "endCard");
  };
  // Keep the end card in step with the link (added later in Settings, or changed there).
  React.useEffect(() => {
    if (!calendarUrl) return;
    const ec = look.endCard;
    const want = bookingCta(calendarUrl);
    if (booking && ec.cta !== want && (ec.cta === DEFAULT_CTA || isBookingCta(ec.cta))) setLook({ ...look, endCard: { ...ec, cta: want } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, calendarUrl]);

  const processTake = () => {
    if (!take) return;
    analyzeTake(video.id, take, { aspect: take.height > take.width ? "9:16" : "16:9", edit: DEFAULT_EDIT, overlays: look, script: scriptLines(video) }).catch((e) =>
      toast.error("AI Edit couldn’t process this take", { description: (e as Error).message })
    );
  };

  // The scenes are planned as part of the render; there's nothing to approve first.
  const doExport = async () => {
    if (!sourceId) {
      toast("Still reading your take", { description: "Give it a moment, then finish the edit." });
      return;
    }
    setRendering(true);
    try {
      const out = await renderFinal(video.id, sourceId, {
        aspect,
        edit: { ...DEFAULT_EDIT, enhanceAudio: enhance },
        overlays: look,
        script: scriptLines(video),
        cuts,
        resolution: can4k && export4k && isPro ? "2160p" : "1080p",
        autoPlan: true,
      });
      const fourK = Math.min(out.width ?? 0, out.height ?? 0) >= 2160;
      toast.success("Your video is ready", { description: `${fmtDuration(out.durationSec)} · ${aspect}${fourK ? " 4K" : ""} MP4` });
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

  const finish = { label: "Render video", run: () => void doExport(), why: "" };
  const finishOff = !!busy || rendering || !sourceId;

  const cutCount = segments.filter((s) => s.removed).length;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* One header, one way forward. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[28px] leading-tight tracking-tight sm:text-[34px]">Edit</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Trim it, pick the look, then render. {BRAND.name} does the rest.</p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-right text-[12px] leading-tight text-muted-foreground">
            <span className="tnum">{cutCount}</span> cuts · final <span className="font-medium text-foreground tnum">{fmtDuration(kept)}</span>
            {finish.why && <span className="block">{finish.why}</span>}
          </span>
          <Button className="rounded-full px-5" onClick={finish.run} disabled={finishOff}>{finish.label} <ArrowRight /></Button>
        </div>
      </div>
      {result && video.take && video.source !== "clip" && clippable(result.durationSec) && <ClipMaker video={video} result={result} take={video.take} />}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* Preview: stays in view while you work. */}
        <div className="rounded-2xl border border-border bg-card p-3 shadow-soft lg:sticky lg:top-36">
            <div className="flex justify-center rounded-md bg-[#06101F] p-2 sm:p-4">
              <div className={cn("relative overflow-hidden rounded-md bg-gradient-to-b from-[#2A3B55] to-[#1A2840]", vertical ? "aspect-[9/16] h-[520px] max-h-[40vh] lg:max-h-[60vh]" : "aspect-video w-full")} style={{ containerType: "size" }}>
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

        {/* Trim · Look */}
        <div ref={panelRef} className="min-w-0 scroll-mt-36 rounded-2xl border border-border bg-card shadow-soft">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <div className="border-b border-border px-3 pt-3">
              <TabsList className="w-full">
                {([
                  ["trim", "1", "Trim"],
                  ["look", "2", "Look"],
                ] as const).map(([id, n, label]) => (
                  <TabsTrigger key={id} value={id} className="flex-1 gap-1.5">
                    <span className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/15 text-[10px] font-semibold">{n}</span>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="trim" className="mt-0 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] text-muted-foreground">
                  Click a phrase to cut or restore it. <span className="text-destructive line-through decoration-destructive/70">Struck through</span> is left out.
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" disabled={!result} onClick={() => { if (result) setSegments(segmentsFromResult(result)); toast("Auto-cuts re-applied"); }}><Wand2 /> Reset cuts</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowTimeline((v) => !v)} aria-pressed={showTimeline}><Scissors /> {showTimeline ? "Hide timeline" : "Show timeline"}</Button>
                </div>
              </div>
              <div className="scrollbar-thin max-h-[560px] overflow-y-auto rounded-md border border-border bg-background/50 p-4">
              <ProcessingNotice analysis={analysis} hasTake={!!take} takeSec={take?.durationSec} onProcess={processTake} />
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
              </div>
              {showTimeline && (
                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                    {[
                      ["Show cuts", showCuts, setShowCuts],
                      ["Play without cuts", skipCuts, setSkipCuts],
                    ].map(([label, val, set]) => (
                      <label key={label as string} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <Switch checked={val as boolean} onCheckedChange={set as (v: boolean) => void} /> {label as string}
                      </label>
                    ))}
                    <div className="ml-auto flex w-44 items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Zoom</span>
                      <Slider value={[zoom]} min={1} max={4} step={0.1} onValueChange={([v]) => setZoom(v)} aria-label="Zoom" />
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
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button variant="outline" className="rounded-full" onClick={() => setTab("look")}>Next: pick the look <ArrowRight /></Button>
              </div>
            </TabsContent>

            <TabsContent value="look" className="mt-0 space-y-4 p-4">
              <LookPanel value={look} onChange={changeLook} brandColors={profile.brandColors} stockFootage={stockFootage} booking={{ url: calendarUrl, on: booking, onToggle: setBooking }} vertical={vertical} />
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-[13px] font-medium">Export</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground"><Switch checked={enhance} onCheckedChange={setEnhance} /> Studio sound</label>
                  {can4k && isPro && <label className="flex items-center gap-2 text-[13px] text-muted-foreground"><Switch checked={export4k} onCheckedChange={setExport4k} /> 4K export</label>}
                </div>
              </div>
              <div className="flex justify-end">
                <Button className="rounded-full px-5" onClick={finish.run} disabled={finishOff}>{finish.label} <ArrowRight /></Button>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Phones: finishing is always one tap away. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-[12px] text-muted-foreground">
            <span className="tnum">{segments.filter((x) => x.removed).length}</span> cuts · final <span className="font-medium text-foreground tnum">{fmtDuration(kept)}</span>
          </div>
          <Button className="rounded-full px-5" onClick={finish.run} disabled={finishOff}>{finish.label} <ArrowRight /></Button>
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
  return (
    <p className="mb-3 text-[11px] text-muted-foreground">
      {analysis.result?.timedBy === "voice"
        ? "Every caption word is timed to your voice. Restarts are marked as bad takes."
        : "Pauses come from your audio. Caption words follow your script, timed to when you were talking."}
    </p>
  );
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

