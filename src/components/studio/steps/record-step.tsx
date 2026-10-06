"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronsDown, ChevronsUp, Clapperboard, ListVideo, Pause, Play, RotateCcw, Sparkles, UserRound, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Headshot } from "@/components/shared/headshot";
import { useStore } from "@/lib/store";
import { generateScript } from "@/lib/ai/content";
import type { Script, Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { StepSection, FieldLabel } from "../step-layout";
import type { StepProps } from "../studio-view";

const scriptText = (v: Video) => {
  const s: Script = v.script ?? generateScript(v.title, v.format);
  return [s.hook, ...s.body, s.cta];
};

function MicMeter({ active }: { active: boolean }) {
  const [lvl, setLvl] = React.useState(0.2);
  React.useEffect(() => {
    const t = setInterval(() => setLvl(active ? 0.35 + Math.random() * 0.6 : 0.08 + Math.random() * 0.15), 120);
    return () => clearInterval(t);
  }, [active]);
  return (
    <div className="flex h-2 gap-[2px]" aria-label="Microphone level">
      {Array.from({ length: 20 }).map((_, i) => (
        <span key={i} className={cn("flex-1 rounded-[1px] transition-colors", i / 20 < lvl ? (i > 16 ? "bg-destructive" : i > 12 ? "bg-primary" : "bg-success") : "bg-muted")} />
      ))}
    </div>
  );
}

export function RecordStep({ video, complete }: StepProps) {
  const router = useRouter();
  const { videos, updateVideo } = useStore();
  const queueCandidates = React.useMemo(() => {
    const others = videos.filter((v) => v.id !== video.id && v.status !== "published" && (["record", "descriptions"].includes(v.stage) || v.compliance === "changes_requested"));
    return [video, ...others];
  }, [videos, video]);
  const [queued, setQueued] = React.useState<string[]>(queueCandidates.map((v) => v.id));
  const [activeId, setActiveId] = React.useState(video.id);
  const active = queueCandidates.find((v) => v.id === activeId) ?? video;
  const lines = scriptText(active);

  // prompter settings
  const [fontSize, setFontSize] = React.useState(30);
  const [speed, setSpeed] = React.useState(32); // px/s
  const [opacity, setOpacity] = React.useState(55);
  const [align, setAlign] = React.useState<"left" | "center">("center");
  // camera settings
  const [aspect, setAspect] = React.useState<"9:16" | "16:9">(active.format === "short" ? "9:16" : "16:9");
  const [position, setPosition] = React.useState("center");
  const [mirror, setMirror] = React.useState(true);
  const [cam, setCam] = React.useState("FaceTime HD Camera");
  const [mic, setMic] = React.useState("Shure MV7+");
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // runtime
  const [playing, setPlaying] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const [takes, setTakes] = React.useState(0);
  const [doneOpen, setDoneOpen] = React.useState(false);

  React.useEffect(() => setAspect(active.format === "short" ? "9:16" : "16:9"), [active.format]);

  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      setOffset((o) => o + ((t - last) / 1000) * speed);
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  React.useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  const enableCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(s);
      toast.success("Camera connected");
    } catch {
      toast("Camera unavailable", { description: "Using the preview stand-in instead." });
    }
  };

  const toggleRecord = () => {
    if (recording) {
      setRecording(false);
      setPlaying(false);
      setTakes((t) => t + 1);
      setDoneOpen(true);
    } else {
      setElapsed(0);
      setOffset(0);
      setRecording(true);
      setPlaying(true);
    }
  };

  const queuedVideos = queueCandidates.filter((v) => queued.includes(v.id));
  const totalRuntime = queuedVideos.reduce((a, v) => a + v.runtimeSec, 0);
  const vertical = aspect === "9:16";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        {/* Stage */}
        <div className="overflow-hidden rounded-lg border border-border bg-[#06101F] shadow-soft">
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
              <div className="absolute inset-x-0 top-0 h-[46%] overflow-hidden" style={{ background: `rgba(6,16,31,${opacity / 100})` }}>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#06101F]/80 to-transparent" />
                <div className="absolute inset-x-0 top-[38%] z-10 h-px bg-[#D2B07A]/50" />
                <div
                  className={cn("px-[7%] pt-[18%] font-medium text-white", align === "center" ? "text-center" : "text-left")}
                  style={{ fontSize: vertical ? fontSize * 0.62 : fontSize * 0.8, lineHeight: 1.35, transform: `translateY(${-offset}px)` }}
                >
                  {lines.map((l, i) => (
                    <p key={i} className="mb-[0.8em]">{l}</p>
                  ))}
                  <p className="text-[#D2B07A]">■ End of script</p>
                </div>
              </div>
              {recording && (
                <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded bg-black/55 px-2 py-1 text-[11px] font-semibold text-white tnum">
                  <span className="size-2 animate-pulse rounded-full bg-[#E5484D]" /> REC {fmtDuration(elapsed)}
                </div>
              )}
              <div className="absolute right-3 bottom-3 z-20 rounded bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80 tnum">{aspect}</div>
            </div>
            {!stream && (
              <Button variant="outline" size="sm" className="absolute top-4 right-4 border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={enableCamera}>
                <Camera /> Enable camera
              </Button>
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
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSpeed((s) => Math.max(8, s - 6))} aria-label="Slower">
              <ChevronsDown />
            </Button>
            <span className="w-16 text-center text-[12px] text-white/70 tnum">{speed} px/s</span>
            <Button size="icon-sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSpeed((s) => Math.min(120, s + 6))} aria-label="Faster">
              <ChevronsUp />
            </Button>
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
          title="Batch recording queue"
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

      {/* Settings */}
      <aside className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <Tabs defaultValue="prompter">
            <TabsList className="w-full">
              <TabsTrigger value="prompter" className="flex-1">Teleprompter</TabsTrigger>
              <TabsTrigger value="camera" className="flex-1">Camera</TabsTrigger>
            </TabsList>
            <TabsContent value="prompter" className="space-y-5 pt-2">
              <div>
                <FieldLabel hint={<span className="tnum">{fontSize}px</span>}>Font size</FieldLabel>
                <Slider value={[fontSize]} min={18} max={56} onValueChange={([v]) => setFontSize(v)} />
              </div>
              <div>
                <FieldLabel hint={<span className="tnum">{speed} px/s</span>}>Scroll speed</FieldLabel>
                <Slider value={[speed]} min={8} max={120} onValueChange={([v]) => setSpeed(v)} />
              </div>
              <div>
                <FieldLabel hint={<span className="tnum">{opacity}%</span>}>Background opacity</FieldLabel>
                <Slider value={[opacity]} min={0} max={100} onValueChange={([v]) => setOpacity(v)} />
              </div>
              <div>
                <FieldLabel>Alignment</FieldLabel>
                <ToggleGroup type="single" value={align} onValueChange={(v) => v && setAlign(v as "left" | "center")} className="w-full">
                  <ToggleGroupItem value="left" className="flex-1">Left</ToggleGroupItem>
                  <ToggleGroupItem value="center" className="flex-1">Center</ToggleGroupItem>
                </ToggleGroup>
              </div>
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
                <Select value={cam} onValueChange={setCam}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["FaceTime HD Camera", "Sony ZV-E10 (USB)", "Elgato Facecam Pro"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FieldLabel>Microphone</FieldLabel>
                <Select value={mic} onValueChange={setMic}>
                  <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Shure MV7+", "MacBook Pro Microphone", "Rode Wireless GO II"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="mt-2.5"><MicMeter active={recording} /></div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-[12px] text-muted-foreground shadow-soft">
          <div className="eyebrow mb-2">Tips</div>
          <ul className="space-y-1.5">
            <li>Look at the brass line — it sits just under your lens.</li>
            <li>Pause a beat between sections; AI Edit will trim the gaps.</li>
            <li>Flubbed a line? Just repeat it. We keep the last take.</li>
          </ul>
        </div>
      </aside>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <div className="eyebrow">Take {takes} saved · <span className="tnum">{fmtDuration(Math.max(elapsed, 1))}</span></div>
            <DialogTitle>Nice work. Who should edit this one?</DialogTitle>
            <DialogDescription>You can always re-record — every take is kept in the Library.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                setDoneOpen(false);
                if (active.id === video.id) complete();
                else { updateVideo(active.id, { stage: "edit" }); toast.success("Sent to AI Edit", { description: active.title }); }
              }}
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
