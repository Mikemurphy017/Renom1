"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, LoaderCircle, PenTool, Video as VideoIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStore, voiceProfileOf } from "@/lib/store";
import { streamWrite } from "@/lib/ai/writer";
import { estimateRuntime } from "@/lib/ai/content";
import { WRITERS } from "@/lib/ai/writers";
import { addDays, parseYmd, startOfDay } from "@/lib/plan";
import type { PlanItem, Video } from "@/lib/types";
import { fmtDuration } from "@/lib/utils";

/**
 * Script ahead: every planned video in the window gets its script written in
 * one go (a different writer for each, so they don't sound alike), and lands
 * in the Record queue. All that's left is to sit down and record.
 */

type Range = "7" | "14" | "month";
type RunState = { state: "waiting" | "writing" | "done" | "error"; note?: string };

const needsScript = (item: PlanItem, videos: Video[]) => {
  if (item.kind !== "video") return false;
  const v = item.videoId ? videos.find((x) => x.id === item.videoId) : undefined;
  return !v || (!v.script && (v.stage === "idea" || v.stage === "script"));
};

export function ScriptAheadDialog({ open, onOpenChange, month }: { open: boolean; onOpenChange: (v: boolean) => void; month: Date }) {
  const router = useRouter();
  const { videos, plan, profile, addVideo, updateVideo, updatePlanItem } = useStore();
  const [range, setRange] = React.useState<Range>("14");
  const [skip, setSkip] = React.useState<Set<string>>(new Set());
  const [runs, setRuns] = React.useState<Record<string, RunState>>({});
  const [running, setRunning] = React.useState(false);
  const [queued, setQueued] = React.useState<string[]>([]);
  const stop = React.useRef(false);

  const today = startOfDay(new Date());
  const until = range === "month" ? new Date(month.getFullYear(), month.getMonth() + 1, 1) : addDays(today, Number(range));
  const candidates = plan
    .filter((p) => p.kind === "video" && parseYmd(p.date) >= today && parseYmd(p.date) < until && (needsScript(p, videos) || runs[p.id]))
    .sort((a, b) => a.date.localeCompare(b.date));
  const chosen = candidates.filter((p) => !skip.has(p.id));

  React.useEffect(() => {
    if (open && !running) {
      setRuns({});
      setSkip(new Set());
      setQueued([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    const items = [...chosen];
    setRuns(Object.fromEntries(items.map((i) => [i.id, { state: "waiting" }])));
    const openings: string[] = videos.filter((v) => v.script?.hook).slice(0, 25).map((v) => v.script!.hook.slice(0, 240));
    const ready: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < items.length && !stop.current) {
        const i = next++;
        const item = items[i];
        setRuns((r) => ({ ...r, [item.id]: { state: "writing" } }));
        try {
          let v = item.videoId ? videos.find((x) => x.id === item.videoId) : undefined;
          if (!v) {
            v = addVideo({ title: item.title, format: item.format ?? "short", stage: "script", outline: item.outline ?? [], subject: item.subject, angle: item.angle, ...(item.category ? { category: item.category } : {}) });
            updatePlanItem(item.id, { videoId: v.id });
          }
          const writer = WRITERS[i % WRITERS.length].id;
          const out = await streamWrite({
            task: "script",
            profile: voiceProfileOf(profile),
            format: v.format,
            writer,
            idea: { title: item.title, outline: item.outline?.length ? item.outline : [item.title], angle: item.angle },
            otherOpenings: openings.slice(-30),
          });
          const script = { hook: out.hook, body: out.body, cta: out.cta };
          openings.push(out.hook.slice(0, 240));
          updateVideo(v.id, { script, runtimeSec: estimateRuntime(script), stage: "record" });
          ready.push(v.id);
          setRuns((r) => ({ ...r, [item.id]: { state: "done", note: fmtDuration(estimateRuntime(script)) } }));
        } catch (e) {
          setRuns((r) => ({ ...r, [item.id]: { state: "error", note: (e as Error).message } }));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setRunning(false);
    setQueued(ready);
    if (ready.length) toast.success(`${ready.length} ${ready.length === 1 ? "script" : "scripts"} written`, { description: "They’re in your Record queue. Record them back to back in one sitting." });
  };

  const done = Object.values(runs).filter((r) => r.state === "done").length;
  const firstReady = queued.length ? videos.filter((v) => queued.includes(v.id)).sort((a, b) => (plan.find((p) => p.videoId === a.id)?.date ?? "").localeCompare(plan.find((p) => p.videoId === b.id)?.date ?? ""))[0] : undefined;

  return (
    <Dialog open={open} onOpenChange={(v) => !running && onOpenChange(v)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Script ahead</DialogTitle>
          <DialogDescription>Write every planned video’s script now, each by a different writer in your voice. They go straight to your Record queue, so all that’s left is to record.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && !running && setRange(v as Range)} className="rounded-full">
            <ToggleGroupItem value="7" className="rounded-full">Next 7 days</ToggleGroupItem>
            <ToggleGroupItem value="14" className="rounded-full">Next 2 weeks</ToggleGroupItem>
            <ToggleGroupItem value="month" className="rounded-full">Rest of {month.toLocaleDateString("en-US", { month: "long" })}</ToggleGroupItem>
          </ToggleGroup>

          {candidates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-[13px] text-muted-foreground">No planned videos without a script in this window. Use Plan my month first, or pick a longer window.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {candidates.map((p) => {
                const r = runs[p.id];
                const d = parseYmd(p.date);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    {r ? (
                      <span className="flex size-4 items-center justify-center">
                        {r.state === "writing" ? <LoaderCircle className="size-4 animate-spin text-primary" /> : r.state === "done" ? <Check className="size-4 text-success" /> : r.state === "error" ? <X className="size-4 text-destructive" /> : <span className="size-2 rounded-full bg-muted-foreground/40" />}
                      </span>
                    ) : (
                      <Checkbox checked={!skip.has(p.id)} onCheckedChange={(v) => setSkip((s) => { const n = new Set(s); if (v === true) n.delete(p.id); else n.add(p.id); return n; })} />
                    )}
                    <div className="w-12 shrink-0 text-[12px] text-muted-foreground tnum">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[13px] font-medium">{p.title}</div>
                      {r?.state === "error" && <div className="line-clamp-1 text-[11px] text-destructive">{r.note}</div>}
                    </div>
                    {r?.state === "done" && <span className="text-[12px] text-muted-foreground tnum">{r.note}</span>}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">{running ? `Writing… ${done} of ${chosen.length} done. Keep this tab open.` : queued.length ? `${queued.length} ready to record.` : chosen.length ? `About ${Math.max(1, Math.round(chosen.length * 0.6))} min to write ${chosen.length}.` : ""}</span>
            <div className="flex gap-2">
              {running ? (
                <Button variant="outline" onClick={() => { stop.current = true; }}>Stop after these</Button>
              ) : queued.length && firstReady ? (
                <Button onClick={() => { onOpenChange(false); router.push(`/studio/${firstReady.id}/record`); }}><VideoIcon /> Start recording session</Button>
              ) : (
                <Button onClick={run} disabled={!chosen.length}><PenTool /> Write {chosen.length} {chosen.length === 1 ? "script" : "scripts"}</Button>
              )}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Clapperboard className="size-3.5" /> In Record, the queue lists every scripted video; after each take, the next one loads on the teleprompter.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

