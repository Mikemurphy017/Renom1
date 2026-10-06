"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Settings2, Camera, CameraOff, Check, Clapperboard, Download, Keyboard, ListVideo, Minus, Pause, Play, Plus, RotateCcw, Sparkles, UserRound, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Headshot } from "@/components/shared/headshot";
import { useStore } from "@/lib/store";
import { generateScript } from "@/lib/ai/content";
import type { Script, Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { useCapture } from "@/lib/media/use-capture";
import { getTake, saveTake, takeExtension } from "@/lib/media/takes";
import { peekDraft } from "@/lib/drafts";
import { analyzeTake, persistTake, resetPipeline } from "@/lib/video/client";
import { defaultOverlays } from "@/lib/video/edit-model";
import { DEFAULT_EDIT, type OverlayOptions } from "@/lib/video/types";
import { StepSection, FieldLabel } from "../step-layout";
import { PrompterSettingsPanel, PrompterShortcuts, Teleprompter, usePrompterSettings, WPM_STEP, type TeleprompterHandle } from "../teleprompter";
import type { StepProps } from "../studio-view";

const scriptText = (v: Video) => {
  const s: Script = v.script ?? generateScript(v.title, v.format);
  return [s.hook, ...s.body, s.cta];
};

function MicMeter({ level, live }: { level: number; live: boolean }) {
  return (
    <div className="flex h-2 gap-[2px]" aria-label="Microphone level">
      {Array.from({ length: 20 }).map((_, i) => (
        <span key={i} className={cn("flex-1 rounded-[1px] transition-colors duration-75", live && i / 20 < level ? (i > 16 ? "bg-destructive" : i > 12 ? "bg-primary" : "bg-success") : "bg-muted")} />
      ))}
    </div>
  );
}
export function RecordStep({ video, complete }: StepProps) {
  const router = useRouter();
  const { videos, updateVideo, profile } = useStore();
  const queueCandidates = React.useMemo(() => {
    const others = videos.filter((v) => v.id !== video.id && v.status !== "published" && (["record", "descriptions"].includes(v.stage) || v.compliance === "changes_requested"));
    return [video, ...others];
  }, [videos, video]);
  const [queued, setQueued] = React.useState<string[]>(queueCandidates.map((v) => v.id));
  const [activeId, setActiveId] = React.useState(video.id);
  const active = queueCandidates.find((v) => v.id === activeId) ?? video;
  const lines = scriptText(active);

  // prompter settings (remembered on this device)
  const [prompterSettings, updatePrompter] = usePrompterSettings();
  const prompter = React.useRef<TeleprompterHandle>(null);
  // camera settings
  const [aspect, setAspect] = React.useState<"9:16" | "16:9">(active.format === "short" ? "9:16" : "16:9");
  const [position, setPosition] = React.useState("center");
  const [mirror, setMirror] = React.useState(true);
  const capture = useCapture();
  const { stream } = capture;
  const [cam, setCam] = React.useState<string>("");
  const [mic, setMic] = React.useState<string>("");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = React.useState<number | null>(null);
  const [lastTake, setLastTake] = React.useState(() => getTake(video.id));

  // runtime
  const [playing, setPlaying] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  // Prompter position, in words from the top; the prompter owns the scroll.
  const setOffset = React.useCallback((words: number) => prompter.current?.seek(words), []);
  const [takes, setTakes] = React.useState(0);
  const [doneOpen, setDoneOpen] = React.useState(false);

  React.useEffect(() => setAspect(active.format === "short" ? "9:16" : "16:9"), [active.format]);

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Attach the live stream whenever the <video> element or stream changes.
  React.useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  // Keep the dropdowns in sync with the devices the browser actually picked.
  React.useEffect(() => {
    if (!stream) return;
    const v = stream.getVideoTracks()[0]?.getSettings().deviceId;
    const a = stream.getAudioTracks()[0]?.getSettings().deviceId;
    if (v) setCam(v);
    if (a) setMic(a);
  }, [stream]);

  const enableCamera = async (opts?: { cameraId?: string; micId?: string }) => {
    const ok = await capture.start(opts ?? { cameraId: cam || undefined, micId: mic || undefined });
    if (ok && !opts) toast.success("Camera and microphone connected");
  };

  const beginRecording = () => {
    try {
      capture.startRecording(aspect);
    } catch (e) {
      toast.error("Couldn't start recording", { description: (e as Error).message });
      return;
    }
    setElapsed(0);
    setOffset(0);
    setRecording(true);
    setPlaying(true);
  };

  // Upload the take and start the AI edit; Edit shows the progress, so move on right away.
  const sendToAiEdit = () => {
    const take = getTake(active.id) ?? active.take;
    setDoneOpen(false);
    if (take) {
      const target = active;
      analyzeTake(target.id, take, {
        aspect: take.height > take.width ? "9:16" : "16:9",
        edit: DEFAULT_EDIT,
        overlays: peekDraft<OverlayOptions>(target.id, "edit.overlays") ?? defaultOverlays(profile, target.format),
        script: scriptText(target),
      })
        .then((r) => updateVideo(target.id, { analysisJobId: r.jobId }))
        .catch((e) => toast.error("AI Edit couldn’t process this take", { description: (e as Error).message }));
    }
    if (active.id === video.id) complete();
    else { updateVideo(active.id, { stage: "edit" }); toast.success("Sent to AI Edit", { description: active.title }); }
  };

  const toggleRecord = async () => {
    if (recording) {
      setRecording(false);
      setPlaying(false);
      try {
        const r = await capture.stopRecording();
        const target = active.id;
        saveTake(target, { ...r, recordedAt: new Date().toISOString() });
        resetPipeline(target);
        const fresh = getTake(target);
        setLastTake(fresh);
        // Save to platform storage right away so the take survives a reload or a redeploy.
        if (fresh)
          persistTake(target, fresh)
            .then((take) => updateVideo(target, { take, analysisJobId: undefined }))
            .catch((e) => toast.error("Your take didn’t save", { description: `${(e as Error).message} Keep this tab open and try recording again.` }));
        setTakes((t) => t + 1);
        setDoneOpen(true);
      } catch (e) {
        toast.error("Recording failed", { description: (e as Error).message });
      }
      return;
    }
    if (countdown !== null) return;
    if (!stream) {
      toast("Turn on your camera first", { description: "Click “Enable camera” and allow access when your browser asks." });
      return;
    }
    if (!capture.supported) {
      toast.error("This browser can't record video", { description: "Use a current version of Chrome, Edge, Safari or Firefox." });
      return;
    }
    for (let n = 3; n > 0; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);
    beginRecording();
  };

  const queuedVideos = queueCandidates.filter((v) => queued.includes(v.id));
  const totalRuntime = queuedVideos.reduce((a, v) => a + v.runtimeSec, 0);
  const vertical = aspect === "9:16";

  const settingsPanel = (
        <div>
          <Tabs defaultValue="prompter">
            <TabsList className="w-full">
              <TabsTrigger value="prompter" className="flex-1">Teleprompter</TabsTrigger>
              <TabsTrigger value="camera" className="flex-1">Camera</TabsTrigger>
            </TabsList>
            <TabsContent value="prompter" className="pt-2">
              <PrompterSettingsPanel settings={prompterSettings} update={updatePrompter} />
            </TabsContent>
            <TabsContent value="camera" className="space-y-5 pt-2">
              <div>
                <FieldLabel hint="Auto-set from script format">Aspect ratio</FieldLabel>
                <ToggleGroup type="single" value={aspect} onValueChange={(v) => v && setAspect(v as "9:16" | "16:9")} className="w-full">
                  <ToggleGroupItem value="9:16" className="flex-1 tnum">9:16</ToggleGroupItem>
                  <ToggleGroupItem value="16:9" className="flex-1 tnum">16:9</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div>
                <FieldLabel>Preview position</FieldLabel>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium">Mirror preview</span>
                <Switch checked={mirror} onCheckedChange={setMirror} />
              </div>
              <div>
                <FieldLabel>Camera</FieldLabel>
                <Select value={cam} onValueChange={(v) => { setCam(v); if (stream) enableCamera({ cameraId: v, micId: mic || undefined }); }} disabled={recording || !capture.cameras.length}>
                  <SelectTrigger size="sm"><SelectValue placeholder="Enable camera to choose" /></SelectTrigger>
                  <SelectContent>
                    {capture.cameras.map((c) => <SelectItem key={c.deviceId} value={c.deviceId}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Microphone</FieldLabel>
                <Select value={mic} onValueChange={(v) => { setMic(v); if (stream) enableCamera({ cameraId: cam || undefined, micId: v }); }} disabled={recording || !capture.mics.length}>
                  <SelectTrigger size="sm"><SelectValue placeholder="Enable camera to choose" /></SelectTrigger>
                  <SelectContent>
                    {capture.mics.map((c) => <SelectItem key={c.deviceId} value={c.deviceId}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="mt-2.5"><MicMeter level={capture.level} live={!!stream} /></div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="mx-auto max-w-[1000px] text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">Read it like you mean it.</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Look at the brass line, just under your lens. Pause between sections; the edit trims the gaps.</p>
      </div>
      <div className="mx-auto min-w-0 max-w-[1000px] space-y-6">
        {/* Stage */}
        <div data-prompter-scope className="overflow-hidden rounded-2xl border border-border bg-[#06101F] shadow-soft">
          <div className={cn("relative flex h-[min(62vh,600px)] items-center px-6 py-6", position === "left" ? "justify-start" : position === "right" ? "justify-end" : "justify-center")}>
            <div className={cn("relative h-full overflow-hidden rounded-md bg-gradient-to-b from-[#2A3B55] to-[#1A2840] shadow-2xl", vertical ? "aspect-[9/16]" : "aspect-video max-w-full")}>
              {stream ? (
                <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
              ) : (
                <div className="absolute inset-0" style={{ transform: mirror ? "scaleX(-1)" : undefined }}>
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#3A4E6E_0%,transparent_70%)]" />
                  <Headshot pose="center" className={cn("absolute bottom-0 left-1/2 -translate-x-1/2", vertical ? "h-[58%]" : "h-[80%]")} />
                </div>
              )}
              {/* Teleprompter */}
              <Teleprompter
                ref={prompter}
                lines={lines}
                settings={prompterSettings}
                update={updatePrompter}
                vertical={vertical}
                playing={playing}
                onPlayingChange={setPlaying}
                recording={recording}
                keyboard={!doneOpen}
              />
              {recording && (
                <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-[11px] font-semibold text-white tnum">
                  <span className="size-2 animate-pulse rounded-full bg-[#E5484D]" /> REC {fmtDuration(elapsed)}
                </div>
              )}
              <div className="absolute right-3 bottom-3 z-20 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80 tnum">{aspect}</div>
            </div>
            {!stream && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#06101F]/70 p-6 backdrop-blur-[2px]">
                <div className="max-w-sm text-center text-white">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                    {capture.error ? <CameraOff className="size-5 text-[#E8CFA4]" /> : <Camera className="size-5 text-[#E8CFA4]" />}
                  </div>
                  <p className="font-serif text-xl">{capture.error ? "Camera unavailable" : "Ready when you are"}</p>
                  <p className="mt-1.5 text-[13px] text-white/70">
                    {capture.error ?? "Turn on your camera and microphone. Nothing is uploaded until you choose to send a take for editing."}
                  </p>
                  <Button className="mt-5" onClick={() => enableCamera()} disabled={capture.starting}>
                    <Camera /> {capture.starting ? "Waiting for permission…" : capture.error ? "Try again" : "Enable camera"}
                  </Button>
                </div>
              </div>
            )}
            {countdown !== null && (
              <div className="absolute inset-0 z-30 flex items-center justify-center">
                <span key={countdown} className="font-serif text-[120px] leading-none text-white drop-shadow-lg animate-in zoom-in-50 fade-in-0">{countdown}</span>
              </div>
            )}
          </div>
          {/* Control bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-[#0A1729] px-4 py-3 text-white">
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause prompter" : "Play prompter"}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setOffset(0)} aria-label="Restart prompter">
              <RotateCcw />
            </Button>
            <div className="mx-1 h-5 w-px bg-white/15" />
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => updatePrompter((s) => ({ wpm: s.wpm - WPM_STEP }))} aria-label="Slower">
              <Minus />
            </Button>
            <span className="w-[4.5rem] text-center text-[12px] text-white/70 tnum" aria-live="polite">{prompterSettings.wpm} wpm</span>
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => updatePrompter((s) => ({ wpm: s.wpm + WPM_STEP }))} aria-label="Faster">
              <Plus />
            </Button>
            <div className="mx-1 h-5 w-px bg-white/15" />
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" aria-label="Recording settings"><Settings2 /></Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-80">{settingsPanel}</PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" className="hidden text-white hover:bg-white/10 sm:inline-flex" aria-label="Keyboard shortcuts"><Keyboard /></Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-72"><PrompterShortcuts /></PopoverContent>
            </Popover>
            <div className="ml-auto flex items-center gap-4">
              <span className="hidden text-[12px] text-white/60 sm:inline">
                Take <span className="tnum">{takes + (recording ? 1 : 0) || 1}</span> · est. <span className="tnum">{fmtDuration(active.runtimeSec)}</span>
              </span>
              <button
                onClick={toggleRecord}
                className="group flex cursor-pointer items-center gap-2.5 rounded-full border border-white/20 py-1 pr-4 pl-1 transition-colors hover:bg-white/5"
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-[#B3261E] ring-2 ring-[#B3261E]/30">
                  {recording ? <span className="size-3 rounded-[2px] bg-white" /> : <span className="size-3.5 rounded-full bg-white/90" />}
                </span>
                <span className="text-[13px] font-medium tnum">{recording ? `Stop · ${fmtDuration(elapsed)}` : "Record"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Batch queue */}
        <StepSection
          title="Recording session"
          action={
            <span className="text-[12px] text-muted-foreground">
              <span className="tnum">{queuedVideos.length}</span> scripts · total est. <span className="font-medium text-foreground tnum">{fmtDuration(totalRuntime)}</span>
            </span>
          }
        >
          <ul className="divide-y divide-border">
            {queueCandidates.map((v, i) => (
              <li key={v.id} className={cn("flex items-center gap-3 py-2.5", v.id === activeId && "")}>
                <Checkbox checked={queued.includes(v.id)} onCheckedChange={(c) => setQueued((q) => (c ? [...q, v.id] : q.filter((x) => x !== v.id)))} aria-label={`Queue ${v.title}`} />
                <span className="w-4 text-[12px] text-muted-foreground tnum">{i + 1}</span>
                <ListVideo className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{v.title}</span>
                <span className="text-[12px] text-muted-foreground">{v.format === "short" ? "9:16" : "16:9"}</span>
                <span className="w-12 text-right text-[12px] tnum">{fmtDuration(v.runtimeSec)}</span>
                {v.id === activeId ? (
                  <span className="inline-flex w-20 items-center justify-end gap-1 text-[12px] font-medium text-primary"><VideoIcon className="size-3.5" /> On deck</span>
                ) : (
                  <Button size="xs" variant="ghost" className="w-20" onClick={() => { setActiveId(v.id); setOffset(0); }}>Load</Button>
                )}
              </li>
            ))}
          </ul>
        </StepSection>
      </div>


      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="eyebrow">Take {takes} {active.take && active.take.recordedAt === lastTake?.recordedAt ? "saved to your library" : "saving…"} · <span className="tnum">{fmtDuration(Math.max(lastTake?.durationSec ?? elapsed, 1))}</span></div>
            <DialogTitle>Nice work. Who should edit this one?</DialogTitle>
            <DialogDescription>Watch it back, download it, or send it on for editing.</DialogDescription>
          </DialogHeader>
          {lastTake && (
            <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/40 p-3">
              <video src={lastTake.url} controls playsInline className={cn("rounded-md bg-black", lastTake.height > lastTake.width ? "h-48" : "w-56")} />
              <div className="min-w-0 flex-1 space-y-1 text-[12px] text-muted-foreground">
                <div className="text-[13px] font-medium text-foreground">Take {takes}</div>
                <div className="tnum">{lastTake.width}×{lastTake.height} · {fmtDuration(lastTake.durationSec)} · {(lastTake.blob.size / 1_000_000).toFixed(1)} MB</div>
                <div>{lastTake.mimeType}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="xs" variant="outline" asChild>
                    <a href={lastTake.url} download={`${active.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-take-${takes}.${takeExtension(lastTake.mimeType)}`}>
                      <Download /> Download
                    </a>
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => { setDoneOpen(false); setOffset(0); }}>
                    <RotateCcw /> Re-record
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={sendToAiEdit}
              className="cursor-pointer rounded-lg border border-primary bg-brass-soft/50 p-4 text-left transition-colors hover:bg-brass-soft"
            >
              <Sparkles className="size-5 text-primary" />
              <div className="mt-3 text-[14px] font-semibold">Send to AI Edit</div>
              <div className="mt-1 text-[12px] text-muted-foreground">Ready in ~2 minutes. Dead air and retakes removed, captions burned in.</div>
              <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary"><Check className="size-3" /> Recommended for short-form</div>
            </button>
            <button
              onClick={() => {
                setDoneOpen(false);
                updateVideo(active.id, { stage: "edit" });
                toast.success("Sent to your professional editor", { description: "Typical turnaround is 48 hours. We'll notify you." });
                router.push("/board");
              }}
              className="cursor-pointer rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40"
            >
              <UserRound className="size-5 text-muted-foreground" />
              <div className="mt-3 text-[14px] font-semibold">Send to Professional Editor</div>
              <div className="mt-1 text-[12px] text-muted-foreground">B-roll, motion graphics and a polish pass by a human editor. 48-hour turnaround.</div>
              <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clapperboard className="size-3" /> 3 of 4 edits left this month</div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
