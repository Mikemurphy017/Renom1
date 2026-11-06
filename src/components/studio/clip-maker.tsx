"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Check, LoaderCircle, Scissors, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useWriter } from "@/lib/ai/writer";
import { peekDraft, seedDraft, useDraft } from "@/lib/drafts";
import { addDays, goalsOf, openSlots, parseYmd, startOfMonth } from "@/lib/plan";
import { clipSegments, keptSeconds, rangesFrom, sentencesOf, type Sentence } from "@/lib/video/clips";
import { cutsFromSegments, defaultOverlays, type Segment } from "@/lib/video/edit-model";
import { renderFinal } from "@/lib/video/client";
import { DEFAULT_EDIT, type JobResult, type OverlayOptions } from "@/lib/video/types";
import type { Category, PlanItem, Script, StoredTake, Video } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";

/**
 * One long recording → a month of short clips. Claude finds the moments that
 * stand on their own; each becomes its own short video (same recording, the
 * rest cut away), lands on an open day in the content plan, and can be
 * finished (rendered) in one go.
 */

interface Proposal {
  key: string;
  title: string;
  start: number;
  end: number;
  first: number;
  last: number;
  subject: string;
  angle: string;
  category: Category;
  why: string;
  segments: Segment[];
  on: boolean;
}

/** The clip's own words as a script, so captions, covers and posts are written from what was said. */
function scriptFrom(sentences: Sentence[], first: number, last: number): Script {
  const run = sentences.filter((s) => s.n >= first && s.n <= last).map((s) => s.text);
  if (run.length < 3) return { hook: run[0] ?? "", body: run.slice(1, -1), cta: run.length > 1 ? run.at(-1)! : "" };
  const mid = run.slice(1, -1);
  const body: string[] = [];
  for (let i = 0; i < mid.length; i += 3) body.push(mid.slice(i, i + 3).join(" "));
  return { hook: run[0], body, cta: run.at(-1)! };
}

export function ClipMaker({ video, result, take }: { video: Video; result: JobResult; take: StoredTake }) {
  const { videos, posts, plan, profile, addVideo, updateVideo, addPlanItems } = useStore();
  const { write, busy, status } = useWriter();
  const [autoOpen, setAutoOpen] = useDraft<boolean>(video.id, "edit.clips.open", false);
  const [count, setCount] = React.useState(() => Math.min(8, Math.max(3, goalsOf(profile.goals).videosPerWeek * 4)));
  const [proposals, setProposals] = React.useState<Proposal[] | null>(null);
  const [made, setMade] = React.useState<string[]>(() => videos.filter((v) => v.clipOf?.videoId === video.id).map((v) => v.id));
  const [rendering, setRendering] = React.useState<{ done: number; total: number; current?: string } | null>(null);
  const sentences = React.useMemo(() => sentencesOf(result), [result]);

  const find = React.useCallback(async () => {
    try {
      const out = await write({ task: "clips", profile: voiceProfileOf(profile), sentences, count });
      const ranges = rangesFrom(out.clips, sentences);
      if (!ranges.length) throw new Error("No moments in this recording stand on their own as clips. Try a recording where you make several separate points.");
      setProposals(
        ranges.map((r) => {
          const c = out.clips[r.index];
          return { key: `${r.start}`, title: c.title.replace(/^[“"]|[”"]$/g, ""), start: r.start, end: r.end, first: Math.min(c.first, c.last), last: Math.max(c.first, c.last), subject: c.subject, angle: c.angle, category: c.category as Category, why: c.why, segments: clipSegments(result, r), on: true };
        })
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast.error("Couldn’t find clips", { description: (e as Error).message });
    }
  }, [write, profile, sentences, count, result]);

  // Arrived from "Clip a long video": start as soon as the recording has been read.
  React.useEffect(() => {
    if (autoOpen && !proposals && !busy) {
      setAutoOpen(false);
      void find();
    }
  }, [autoOpen, proposals, busy, setAutoOpen, find]);

  const create = () => {
    const chosen = (proposals ?? []).filter((p) => p.on);
    if (!chosen.length) return;
    const clipVideos = chosen.map((p) => {
      const v = addVideo({
        title: p.title,
        format: "short",
        stage: "edit",
        source: "clip",
        clipOf: { videoId: video.id, start: p.start, end: p.end },
        take,
        analysisJobId: result.jobId,
        subject: p.subject,
        angle: p.angle,
        category: p.category,
        outline: [p.why],
        script: scriptFrom(sentences, p.first, p.last),
        runtimeSec: Math.round(keptSeconds(p.segments)),
        mode: "evergreen",
      });
      seedDraft(v.id, `edit.segments.${result.jobId}`, p.segments);
      // The long video's look carries over, in the short shape.
      const look = peekDraft<OverlayOptions>(video.id, "edit.overlays");
      seedDraft(v.id, "edit.overlays", look ? { ...defaultOverlays(profile, "short"), lowerThird: look.lowerThird, endCard: look.endCard } : defaultOverlays(profile, "short"));
      return v;
    });
    // Spread them over the open video days, from tomorrow, into the next months if needed.
    const goals = goalsOf(profile.goals);
    const pending: Omit<PlanItem, "id" | "createdAt">[] = [];
    const from = addDays(new Date(), 1);
    let month = startOfMonth(from);
    for (let guard = 0; guard < 6 && pending.length < clipVideos.length; guard++, month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
      const slots = openSlots(month, goals, [...plan, ...pending], videos, posts, from).filter((s) => s.kind === "video");
      for (const s of slots) {
        if (pending.length >= clipVideos.length) break;
        const v = clipVideos[pending.length];
        pending.push({ date: s.date, kind: "video", title: v.title, subject: v.subject, angle: v.angle, category: v.category, format: "short", videoId: v.id });
      }
    }
    addPlanItems(pending);
    setMade((m) => [...m, ...clipVideos.map((v) => v.id)]);
    setProposals(null);
    const lastDay = pending.at(-1)?.date;
    toast.success(`${clipVideos.length} clips made`, { description: pending.length ? `On your plan through ${lastDay ? parseYmd(lastDay).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "the month"}. Finish them all now, or open any one to adjust it.` : "Open any one to adjust it." });
  };

  const renderAll = async () => {
    const todo = made.map((id) => videos.find((v) => v.id === id)).filter((v): v is Video => !!v && !v.output);
    if (!todo.length) return toast("Every clip is already finished");
    setRendering({ done: 0, total: todo.length });
    let ok = 0;
    for (const [i, v] of todo.entries()) {
      setRendering({ done: i, total: todo.length, current: v.title });
      try {
        const segments = peekDraft<Segment[]>(v.id, `edit.segments.${result.jobId}`) ?? [];
        const out = await renderFinal(v.id, take.sourceId, {
          aspect: "9:16",
          edit: DEFAULT_EDIT,
          overlays: peekDraft<OverlayOptions>(v.id, "edit.overlays") ?? defaultOverlays(profile, "short"),
          cuts: cutsFromSegments(segments),
          resolution: "1080p",
        });
        updateVideo(v.id, {
          stage: "review",
          runtimeSec: Math.round(out.durationSec),
          outputUrl: out.outputUrl,
          output: out.outputId && out.outputUrl ? { id: out.outputId, url: out.outputUrl, durationSec: out.durationSec, sizeBytes: out.sizeBytes, aspect: "9:16", renderedAt: new Date().toISOString() } : undefined,
        });
        ok++;
      } catch (e) {
        toast.error(`Couldn’t finish “${v.title}”`, { description: (e as Error).message });
        if (/plan|trial|billing/i.test((e as Error).message)) break;
      }
    }
    setRendering(null);
    if (ok) toast.success(`${ok} ${ok === 1 ? "clip" : "clips"} finished`, { description: "Each one is ready for its post. Captions are written from what you said." });
  };

  const clipVideos = made.map((id) => videos.find((v) => v.id === id)).filter((v): v is Video => !!v);
  const unfinished = clipVideos.filter((v) => !v.output).length;

  return (
    <section className="rounded-2xl border border-primary/30 bg-brass-soft/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-serif text-[22px] leading-tight"><Scissors className="size-5 text-primary" /> Turn this into a month of clips</div>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">This recording runs {fmtDuration(result.durationSec)}. {`Renom`} finds the moments that stand on their own, makes each a vertical short with your captions and look, and puts them on open days in your plan.</p>
        </div>
        {!proposals && (
          <div className="flex items-center gap-2">
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={busy} className="h-9 rounded-full border border-border bg-card px-3 text-[13px]" aria-label="How many clips">
              {[3, 4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} clips</option>)}
            </select>
            <Button className="rounded-full" onClick={find} disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" /> {status ?? "Reading…"}</> : <><Sparkles /> Find clips</>}</Button>
          </div>
        )}
      </div>

      {proposals && (
        <div className="mt-4 space-y-2">
          {proposals.map((p) => (
            <label key={p.key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border bg-card px-3 py-2.5", p.on ? "border-primary/40" : "border-border opacity-70")}>
              <Checkbox checked={p.on} onCheckedChange={(v) => setProposals((ps) => ps!.map((x) => (x.key === p.key ? { ...x, on: v === true } : x)))} className="mt-1" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">{p.title}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground tnum">{fmtDuration(p.start)}–{fmtDuration(p.end)} · about {fmtDuration(keptSeconds(p.segments))} after cuts · {p.angle}</div>
                <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{p.why}</p>
              </div>
            </label>
          ))}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setProposals(null)}>Cancel</Button>
            <Button variant="outline" onClick={find} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Find others</Button>
            <Button onClick={create} disabled={!proposals.some((p) => p.on)}><Check /> Make {proposals.filter((p) => p.on).length} clips and add to my plan</Button>
          </div>
        </div>
      )}

      {clipVideos.length > 0 && !proposals && (
        <div className="mt-4 space-y-2">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {clipVideos.map((v) => {
              const day = plan.find((p) => p.videoId === v.id)?.date;
              return (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/studio/${v.id}/${v.stage}`} className="line-clamp-1 text-[13px] font-medium hover:underline">{v.title}</Link>
                    <div className="text-[12px] text-muted-foreground tnum">{fmtDuration(v.runtimeSec)} · {v.output ? "Finished" : "Ready to finish"}{day ? ` · goes out ${parseYmd(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}</div>
                  </div>
                  {v.output ? <Check className="size-4 text-success" /> : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {rendering && <span className="text-[12px] text-muted-foreground">Finishing {rendering.done + 1} of {rendering.total}{rendering.current ? `: ${rendering.current}` : ""}… keep this tab open</span>}
            <Button asChild variant="ghost" className="rounded-full"><Link href="/plan"><CalendarDays /> See them on your plan</Link></Button>
            {unfinished > 0 && <Button className="rounded-full" onClick={renderAll} disabled={!!rendering}>{rendering ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Finish all {unfinished} clips</Button>}
          </div>
        </div>
      )}
    </section>
  );
}
