"use client";

import * as React from "react";
import { ArrowRight, Check, Clapperboard, Film, LoaderCircle, Music2, Palette, RotateCcw, Sparkles, Subtitles, TriangleAlert, Type, Undo2, Volume2, X, ZoomIn, ChartColumnBig, UserRound, Flag, ImagePlay } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { planStoryboard } from "@/lib/video/client";
import { DEFAULT_EDIT, type Aspect, type JobResult, type OverlayOptions, type TimeRange } from "@/lib/video/types";
import { buildStoryboard, fmtStamp, lookKey, planKey, storyboardState, type ApprovedPlan, type ElementKind, type Scene, type StoryboardState } from "@/lib/video/storyboard";
import { coverIntroOn } from "@/lib/video/cover-intro";

/**
 * The storyboard step of the edit: before anything is rendered, the advisor
 * sees what the video will be, scene by scene, and approves it. The render is
 * given exactly that plan.
 */

export interface StoryboardApi {
  state: StoryboardState;
  planning: boolean;
  /** The approved plan to send with the render (only when approved for the current cuts and look). */
  approved?: ApprovedPlan;
  plan: (instruction?: string) => Promise<void>;
  approve: () => ApprovedPlan | undefined;
  toggle: (id: string) => void;
}

export function useStoryboard(o: { video: Video; sourceId?: string; analysisJobId?: string; aspect: Aspect; cuts: TimeRange[]; look: OverlayOptions; script?: string[] }): StoryboardApi {
  const { updateVideo } = useStore();
  const { video, sourceId, analysisJobId, aspect, cuts, look } = o;
  const inputKey = React.useMemo(() => (sourceId ? planKey({ sourceId, aspect, cuts, overlays: look }) : ""), [sourceId, aspect, cuts, look]);
  const sb = video.storyboard;
  const state: StoryboardState = sourceId ? storyboardState(sb, inputKey, look) : "none";
  const [planning, setPlanning] = React.useState(false);

  const plan = async (instruction?: string) => {
    if (!sourceId || !analysisJobId) {
      toast("Still reading your take", { description: "Give it a moment, then plan the storyboard." });
      return;
    }
    setPlanning(true);
    // Remember what this plan is for: the cuts and look as they are now.
    const key = inputKey;
    try {
      const next = await planStoryboard({ sourceId, analysisJobId, aspect, edit: DEFAULT_EDIT, overlays: look, cuts, script: o.script, instruction, previous: instruction ? sb?.plan : undefined });
      updateVideo(video.id, { storyboard: { plan: next, inputKey: key, disabled: [] } });
      if (instruction) toast.success("Storyboard re-planned", { description: "Check the scenes, then approve it." });
    } catch (e) {
      toast.error("Couldn’t plan the storyboard", { description: (e as Error).message });
    } finally {
      setPlanning(false);
    }
  };

  const approve = () => {
    if (!sb || state === "stale" || state === "none") return undefined;
    const at = new Date().toISOString();
    updateVideo(video.id, { storyboard: { ...sb, approval: { at, lookKey: lookKey(look, sb.disabled), by: "advisor" } } });
    return { plan: sb.plan, disabled: sb.disabled, approvedAt: at };
  };

  const toggle = (id: string) => {
    if (!sb) return;
    const disabled = sb.disabled.includes(id) ? sb.disabled.filter((d) => d !== id) : [...sb.disabled, id];
    // Any change to what's on screen needs a fresh approval.
    updateVideo(video.id, { storyboard: { ...sb, disabled, approval: undefined } });
  };

  const approved = state === "approved" && sb?.approval ? { plan: sb.plan, disabled: sb.disabled, approvedAt: sb.approval.at } : undefined;
  return { state, planning, approved, plan, approve, toggle };
}

const KIND_ICON: Record<ElementKind, React.ComponentType<{ className?: string }>> = {
  caption: Subtitles,
  card: Type,
  zoom: ZoomIn,
  broll: Film,
  graphic: ChartColumnBig,
  lowerThird: UserRound,
  endCard: Flag,
  sfx: Volume2,
};

const STATE_BADGE: Record<StoryboardState, { label: string; variant: "success" | "brass" | "danger" | "outline" }> = {
  approved: { label: "Approved", variant: "success" },
  unapproved: { label: "Needs your approval", variant: "brass" },
  stale: { label: "Out of date", variant: "danger" },
  none: { label: "Not planned yet", variant: "outline" },
};

export const StoryboardPanel = React.forwardRef<
  HTMLElement,
  {
    video: Video;
    api: StoryboardApi;
    look: OverlayOptions;
    cuts: TimeRange[];
    result?: JobResult;
    takeUrl?: string;
    vertical: boolean;
    enhanceAudio: boolean;
    rendering: boolean;
    onRender: (approved: ApprovedPlan) => void;
  }
>(function StoryboardPanel({ video, api, look, cuts, result, takeUrl, vertical, enhanceAudio, rendering, onRender }, ref) {
  const sb = video.storyboard;
  const [ask, setAsk] = React.useState("");
  const board = React.useMemo(
    () =>
      sb && result
        ? buildStoryboard({ plan: sb.plan, disabled: sb.disabled, overlays: look, transcript: result.transcript, keyPhrases: result.keyPhrases, cuts, sourceDur: result.durationSec, enhanceAudio, coverIntro: coverIntroOn(video) })
        : null,
    [sb, result, look, cuts, enhanceAudio, video]
  );
  const stills = useStills(takeUrl, board?.scenes.map((s) => s.stillAt) ?? []);
  const { state, planning } = api;
  const badge = STATE_BADGE[state];
  const reapprove = state === "unapproved" && !!sb?.approval;

  const approveAndRender = () => {
    const ok = api.approved ?? api.approve();
    if (!ok) return;
    onRender(ok);
  };

  return (
    <section ref={ref} id="storyboard" className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">Storyboard</div>
          <h2 className="mt-1 flex items-center gap-2 font-serif text-[24px] leading-tight"><Clapperboard className="size-5 shrink-0 text-primary" /> What your video will look like</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">Every scene, before anything is rendered: captions, cards, graphics, b-roll, zooms and transitions. Nothing renders until you approve it.</p>
        </div>
        <Badge variant={planning ? "outline" : badge.variant} className="mt-1">{planning ? <><LoaderCircle className="animate-spin" /> Planning…</> : <>{state === "approved" && <Check />}{badge.label}</>}</Badge>
      </div>

      {state === "stale" && !planning && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-warning-soft px-3 py-2.5 text-[13px]">
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">Your cuts or style changed since this storyboard was planned. Plan it again to see what the render will do now.</span>
          <Button size="sm" variant="outline" onClick={() => void api.plan()}><RotateCcw /> Plan again</Button>
        </div>
      )}
      {reapprove && !planning && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-primary/30 bg-brass-soft/60 px-3 py-2.5 text-[13px]">
          <TriangleAlert className="size-4 shrink-0 text-primary" />
          <span>You changed the look after approving. Check the scenes below and approve again.</span>
        </div>
      )}

      {!sb && (
        <div className="mt-5 rounded-xl border border-dashed border-border bg-background/50 px-4 py-8 text-center">
          {planning ? (
            <p className="flex items-center justify-center gap-2 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Planning your scenes: the key moments, graphics and cutaways…</p>
          ) : (
            <>
              <p className="text-[14px] text-muted-foreground">{result ? "Plan the storyboard to see every scene before rendering." : "The storyboard is planned once your take has been read."}</p>
              <Button className="mt-3 rounded-full" disabled={!result} onClick={() => void api.plan()}><Sparkles /> Plan the storyboard</Button>
            </>
          )}
        </div>
      )}

      {board && (
        <div className={cn("transition-opacity", (state === "stale" || planning) && "opacity-50")}>
          <dl className="mt-5 grid gap-x-6 gap-y-3 rounded-xl border border-border bg-background/50 p-4 text-[13px] sm:grid-cols-2">
            <Summary icon={Clapperboard} label="Length" value={`${fmtStamp(board.summary.totalSec)} · ${board.scenes.length} scenes`} />
            <Summary icon={Sparkles} label="Style" value={`${board.summary.style}: ${board.summary.styleNote}`} />
            <Summary icon={Subtitles} label="Captions" value={board.summary.captions} />
            <Summary icon={ChartColumnBig} label="On screen" value={`${board.summary.counts.moments} key moments · ${board.summary.counts.graphics} graphics · ${board.summary.counts.broll} b-roll · ${board.summary.counts.zooms} zooms`} />
            <Summary icon={Music2} label="Music" value={board.summary.music} />
            <Summary icon={Volume2} label="Sound" value={board.summary.sound} />
            <Summary icon={Palette} label="Color" value={board.summary.grade} />
            <Summary icon={ImagePlay} label="Cover" value={board.summary.intro} />
          </dl>

          <ol className="mt-4 space-y-3">
            {board.scenes.map((s, i) => (
              <SceneCard key={`${s.n}-${s.start}`} scene={s} still={stills[i]} vertical={vertical} onToggle={api.toggle} disabled={planning || rendering} />
            ))}
          </ol>
        </div>
      )}

      {sb && (
        <div className="mt-5 grid gap-4 border-t border-border pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="storyboard-ask" className="text-[13px] font-medium">Ask for changes</label>
            <Textarea
              id="storyboard-ask"
              value={ask}
              onChange={(e) => setAsk(e.target.value.slice(0, 600))}
              placeholder="e.g. No b-roll. Put a chart where I compare the two accounts. Fewer zooms."
              className="mt-1.5 min-h-16"
              disabled={planning || rendering}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!ask.trim() || planning || rendering}
                onClick={() => {
                  void api.plan(ask.trim()).then(() => setAsk(""));
                }}
              >
                {planning ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Re-plan with this
              </Button>
              {!sb.plan.ai && <span className="text-[12px] text-muted-foreground">The AI planner isn’t available right now, so changes in words may not be followed. Remove elements above instead.</span>}
              {sb.plan.instruction && <span className="text-[12px] text-muted-foreground">Last change asked: “{sb.plan.instruction}”</span>}
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            {state === "approved" && sb.approval && <span className="text-[12px] text-success">Approved {new Date(sb.approval.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
            {state === "stale" ? (
              <Button className="rounded-full" onClick={() => void api.plan()} disabled={planning || rendering}><RotateCcw /> Plan again to approve</Button>
            ) : (
              <Button className="rounded-full" onClick={approveAndRender} disabled={planning || rendering || !board}>
                {state === "approved" ? <>Render video <ArrowRight /></> : <><Check /> Approve storyboard &amp; render</>}
              </Button>
            )}
            {state === "unapproved" && (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => api.approve() && toast.success("Storyboard approved", { description: "Render whenever you’re ready." })} disabled={planning || rendering}>
                Approve only
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
});

function Summary({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className="mt-0.5">{value}</dd>
      </div>
    </div>
  );
}

function SceneCard({ scene, still, vertical, onToggle, disabled }: { scene: Scene; still?: string; vertical: boolean; onToggle: (id: string) => void; disabled: boolean }) {
  return (
    <li className="rounded-xl border border-border bg-background/40 p-3" data-scene={scene.n}>
      <div className="flex gap-3">
        <div className={cn("relative shrink-0 overflow-hidden rounded-md bg-[#1A2840]", vertical ? "aspect-[9/16] w-16 sm:w-20" : "aspect-video w-28 sm:w-36")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {still && <img src={still} alt={`Scene ${scene.n}`} className="h-full w-full object-cover" />}
          <span className="absolute top-1 left-1 rounded bg-black/55 px-1 text-[10px] font-medium text-white">{scene.n}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-medium">Scene {scene.n}</span>
            <span className="font-mono text-[12px] text-muted-foreground">{fmtStamp(scene.start)} – {fmtStamp(scene.end)}</span>
          </div>
          {scene.spoken && <p className="mt-1 line-clamp-3 text-[13px] italic text-foreground/85">“{scene.spoken}”</p>}
          {scene.highlighted.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {scene.highlighted.slice(0, 8).map((w) => <Badge key={w} variant="brass">{w}</Badge>)}
            </div>
          )}
          {scene.covered && <p className="mt-1 text-[12px] text-muted-foreground">Covers you: {scene.covered}</p>}
        </div>
      </div>
      <ul className="mt-2.5 space-y-1.5">
        {scene.elements.map((e, i) => {
          const Icon = KIND_ICON[e.kind];
          return (
            <li key={`${e.kind}-${e.id ?? i}-${e.at}`} className={cn("flex items-start gap-2 text-[12.5px]", e.off && "opacity-55")}>
              <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <div className={cn("min-w-0 flex-1", e.off && "line-through decoration-muted-foreground/60")}>
                <span className="font-medium">{e.label}</span> <span className="font-mono text-[11px] text-muted-foreground">{fmtStamp(e.at)}–{fmtStamp(e.until)}</span>
                {e.detail && <span className="block break-words text-muted-foreground">{e.detail}</span>}
              </div>
              {e.id && (
                <Button size="xs" variant="ghost" className="shrink-0" disabled={disabled} onClick={() => onToggle(e.id!)} aria-label={e.off ? `Restore ${e.label}` : `Remove ${e.label}`} title={e.off ? "Put it back" : "Leave it out"}>
                  {e.off ? <><Undo2 /> Restore</> : <><X /> Remove</>}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-dashed border-border pt-2 text-[12px] text-muted-foreground">
        <ArrowRight className="size-3" /> {scene.transition}
      </div>
    </li>
  );
}

/** Stills from the take at the given times, for the scene cards. */
function useStills(src: string | undefined, times: number[]) {
  const key = times.map((t) => t.toFixed(2)).join(",");
  const [stills, setStills] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!src || !key) return;
    const at = key.split(",").map(Number);
    let live = true;
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = src;
    const c = document.createElement("canvas");
    const seek = (t: number) =>
      new Promise<void>((res) => {
        const done = () => (v.removeEventListener("seeked", done), res());
        v.addEventListener("seeked", done);
        setTimeout(done, 3000);
        v.currentTime = t;
      });
    (async () => {
      await new Promise<void>((res) => (v.readyState >= 2 ? res() : v.addEventListener("loadeddata", () => res(), { once: true })));
      c.height = 240;
      c.width = Math.round((v.videoWidth / Math.max(1, v.videoHeight)) * 240) || 135;
      const ctx = c.getContext("2d")!;
      const out: string[] = [];
      for (const t of at) {
        if (!live) return;
        await seek(Math.max(0.05, t));
        ctx.drawImage(v, 0, 0, c.width, c.height);
        out.push(c.toDataURL("image/jpeg", 0.7));
        if (live) setStills([...out]);
      }
    })().catch(() => {});
    return () => {
      live = false;
      v.removeAttribute("src");
      v.load();
    };
  }, [src, key]);
  return stills;
}
