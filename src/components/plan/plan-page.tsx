"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clapperboard, Flame, LoaderCircle, PenLine, PenTool, Plus, Scissors, Settings2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageContainer } from "@/components/shared/page";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useWriter } from "@/lib/ai/writer";
import { DAY_NAMES, DAY_SHORT, addDays, daysInMonth, itemStatus, openSlots, parseYmd, postOutAt, spreadDays, startOfMonth, startOfWeek, videoOutAt, ymd, type ItemStatus } from "@/lib/plan";
import type { Category, PlanItem, PostingGoals, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Meter, PaceBadge, paceMessage } from "./this-week";
import { useAccountability, useOpenPlanItem } from "./use-plan";
import { ScriptAheadDialog } from "./script-ahead";
import { ClipLongDialog } from "./clip-long";
import { PrepareDialog, type PrepareChoice } from "./prepare-dialog";
import { autopilotProgress, runAutopilot, subscribeAutopilot, type AutopilotOptions } from "@/lib/autopilot";

const STATUS_STYLE: Record<ItemStatus["key"], string> = {
  posted: "border-success/30 bg-success-soft text-success",
  scheduled: "border-success/30 bg-success-soft/60 text-success",
  ready: "border-primary bg-primary/12 font-medium text-foreground",
  making: "border-primary/40 border-dashed bg-brass-soft/40 text-foreground",
  in_progress: "border-primary/40 bg-brass-soft/70 text-foreground",
  planned: "border-border bg-card text-foreground",
  overdue: "border-destructive/40 bg-destructive/8 text-destructive",
};

type Shipped = { id: string; kind: "video" | "post"; title: string; date: string; href: string; scheduled: boolean };

export function PlanPage() {
  const { videos, posts, plan, profile, updateProfile, addPlanItems, updatePlanItem, deletePlanItem, addVideo, updateVideo, addPost, updatePost } = useStore();
  const prog = React.useSyncExternalStore(subscribeAutopilot, autopilotProgress, autopilotProgress);
  // "month": plan the open slots and get them ready; otherwise these planned items.
  const [preparing, setPreparing] = React.useState<null | "month" | PlanItem[]>(null);
  const params = useSearchParams();
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const acc = useAccountability(month);
  const goals = acc.goals;
  const open = useOpenPlanItem();
  const { write, busy, status } = useWriter();
  const [goalsOpen, setGoalsOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PlanItem | null>(null);
  const [adding, setAdding] = React.useState<string | null>(null);
  const [scripting, setScripting] = React.useState(false);
  const [clipping, setClipping] = React.useState(false);

  React.useEffect(() => {
    if (params.get("goals") === "1") setGoalsOpen(true);
  }, [params]);

  const today = ymd(new Date());
  const first = month;
  const gridStart = startOfWeek(first);
  const lastDay = addDays(first, daysInMonth(first) - 1);
  const gridDays = Math.ceil((lastDay.getTime() - gridStart.getTime()) / 86400_000 / 7 + 1 / 7) * 7;
  const days = Array.from({ length: gridDays }, (_, i) => addDays(gridStart, i));
  const inMonth = (d: Date) => d.getMonth() === first.getMonth();

  // Videos and posts going out that weren't planned here still belong on the calendar.
  const shipped = React.useMemo<Shipped[]>(() => {
    const planned = new Set(plan.flatMap((p) => [p.videoId, p.postId].filter(Boolean) as string[]));
    return [
      ...videos.filter((v) => !planned.has(v.id) && videoOutAt(v)).map((v) => ({ id: v.id, kind: "video" as const, title: v.title, date: ymd(new Date(videoOutAt(v)!)), href: `/studio/${v.id}/post`, scheduled: v.status === "scheduled" })),
      ...posts.filter((p) => !planned.has(p.id) && postOutAt(p)).map((p) => ({ id: p.id, kind: "post" as const, title: p.topic || "Post", date: ymd(new Date(postOutAt(p)!)), href: `/posts/${p.id}`, scheduled: p.status === "scheduled" })),
    ];
  }, [videos, posts, plan]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, { items: PlanItem[]; shipped: Shipped[] }>();
    const at = (d: string) => m.get(d) ?? (m.set(d, { items: [], shipped: [] }), m.get(d)!);
    for (const p of plan) at(p.date).items.push(p);
    for (const s of shipped) at(s.date).shipped.push(s);
    return m;
  }, [plan, shipped]);

  const monthItems = plan.filter((p) => parseYmd(p.date).getMonth() === first.getMonth() && parseYmd(p.date).getFullYear() === first.getFullYear()).sort((a, b) => a.date.localeCompare(b.date));
  const slots = openSlots(month, goals, plan, videos, posts);

  // The latest plan and studio, for work that finishes after this render.
  const live = React.useRef({ videos, posts, plan, profile });
  live.current = { videos, posts, plan, profile };
  const api = () => ({ ...live.current, addVideo, updateVideo, addPost, updatePost, updatePlanItem });

  /** Planned but not started: what "Get it ready" picks up. */
  const unprepared = monthItems.filter((p) => !p.prep && !p.videoId && !p.postId && p.date >= today);

  const optionsFrom = (c: PrepareChoice): AutopilotOptions => {
    if (c.make === "ai" && c.ai) updateProfile({ planAi: { maxWords: c.ai.maxWords } });
    return { make: c.make, ai: c.ai };
  };

  /** Topics for the open slots, then everything written, pictured and queued. */
  const planAndPrepare = async (c: PrepareChoice) => {
    setPreparing(null);
    const take = slots.slice(0, 16);
    let made: PlanItem[] = [];
    if (take.length) {
      const existing = [
        ...videos.slice(0, 120).map((v) => ({ title: v.title, subject: v.subject, angle: v.angle })),
        ...plan.map((p) => ({ title: p.title, subject: p.subject, angle: p.angle })),
        ...(profile.ideaLog ?? []).slice(-150),
      ];
      try {
        const out = await write({ task: "ideas", profile: voiceProfileOf(profile), mode: "evergreen", format: "short", count: take.length, existing, instruction: `This is the advisor's content plan for ${first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Where the season matters (tax deadlines, open enrollment, year-end), let a few ideas use it.` });
        const ideas = out.ideas;
        made = addPlanItems(
          take.slice(0, ideas.length).map((sl, i) => {
            const idea = ideas[i];
            return { date: sl.date, kind: sl.kind, title: idea.title.replace(/^[“"]|[”"]$/g, ""), subject: idea.subject, angle: idea.angle, category: idea.category as Category, outline: idea.outline, ...(sl.kind === "video" ? { format: "short" as VideoFormat, make: c.make } : { postKind: c.postKind }) };
          })
        );
        const titles = new Set((profile.ideaLog ?? []).map((x) => x.title));
        updateProfile({ ideaLog: [...(profile.ideaLog ?? []), ...ideas.filter((i) => !titles.has(i.title)).map(({ title, subject, angle }) => ({ title, subject, angle }))].slice(-300) });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        toast.error("Couldn’t plan the month", { description: (e as Error).message });
        return;
      }
    }
    const items = [...made, ...unprepared.map((p) => ({ ...p, ...(p.kind === "video" ? { make: p.make ?? c.make } : { postKind: p.postKind ?? c.postKind }) }))];
    for (const p of unprepared) updatePlanItem(p.id, p.kind === "video" ? { make: p.make ?? c.make } : { postKind: p.postKind ?? c.postKind });
    if (!items.length) return toast("This month is fully planned and ready", { description: "Every slot your goal calls for has something in it." });
    toast.success(`Getting ${items.length} ${items.length === 1 ? "item" : "items"} ready`, { description: "Writing, pictures and videos. Keep using the app; they land on the calendar as they finish." });
    await prepare(items, optionsFrom(c));
  };

  const prepare = async (items: PlanItem[], opts: AutopilotOptions) => {
    await runAutopilot(items, api(), opts);
    const p = autopilotProgress();
    if (p.failed) toast.error(`${p.failed} ${p.failed === 1 ? "item needs" : "items need"} attention`, { description: "They’re marked on the calendar. Open one to see why and try again." });
    else toast.success("Your plan is ready", { description: opts.make === "ai" ? "Posts are ready to review. AI videos land for approval as they finish." : "Posts are ready to review, videos are scripted for the day you film." });
  };

  /** Try one item again with the choices it was made with. */
  const retry = (it: PlanItem) => {
    const ai = profile.planAi;
    if (it.kind === "video" && it.make === "ai" && !ai) return setPreparing([it]);
    void prepare([{ ...it, prep: undefined }], { make: it.make ?? "film", ai: ai ? { maxWords: ai.maxWords } : undefined });
  };

  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isThisMonth = ymd(first) === ymd(startOfMonth(new Date()));

  return (
    <PageContainer className="max-w-[1180px] space-y-8 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">Content plan</div>
          <h1 className="flex items-center gap-1 font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">
            <button type="button" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))} className="cursor-pointer rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Previous month"><ChevronLeft className="size-5" /></button>
            {monthLabel}
            <button type="button" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))} className="cursor-pointer rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Next month"><ChevronRight className="size-5" /></button>
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Goal: {goals.videosPerWeek} {goals.videosPerWeek === 1 ? "video" : "videos"} and {goals.postsPerWeek} {goals.postsPerWeek === 1 ? "post" : "posts"} a week · record on {DAY_NAMES[goals.recordDay]}s
            {!isThisMonth && <> · <button type="button" className="cursor-pointer text-primary underline-offset-2 hover:underline" onClick={() => setMonth(startOfMonth(new Date()))}>Back to this month</button></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setGoalsOpen(true)}><Settings2 /> Goals</Button>
          <Button variant="outline" className="rounded-full" onClick={() => setClipping(true)}><Scissors /> Clip a long video</Button>
          <Button variant="outline" className="rounded-full" onClick={() => setScripting(true)}><PenTool /> Write ahead</Button>
          <Button className="rounded-full" onClick={() => setPreparing("month")} disabled={busy || prog.running}>{busy ? <><LoaderCircle className="animate-spin" /> {status ?? "Planning…"}</> : <><Sparkles /> Plan my month{slots.length + unprepared.length ? ` (${Math.min(16, slots.length) + unprepared.length})` : ""}</>}</Button>
        </div>
      </div>

      {prog.running && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-brass-soft/50 px-4 py-3 text-[13px]" role="status">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <span className="min-w-0 flex-1">
            Getting your plan ready: <span className="font-medium tnum">{prog.done} of {prog.total}</span> done{prog.current ? <> · now <span className="italic">“{prog.current}”</span></> : null}. It keeps going while you use the app.
          </span>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 0}%` }} /></div>
        </div>
      )}

      {!acc.hasGoals && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-brass-soft/50 px-4 py-3 text-[13px]">
          <span>Start by setting your goal: how many videos and posts go out each week, and the day you record.</span>
          <Button size="sm" className="rounded-full" onClick={() => setGoalsOpen(true)}>Set my goal</Button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">This week <PaceBadge pace={acc.week.pace} short={acc.week.short} /></div>
          <div className="mt-1 font-serif text-[30px] leading-tight tnum">{acc.week.videos}<span className="text-muted-foreground">/{acc.week.videoGoal}</span> <span className="text-[15px] text-muted-foreground">videos</span></div>
          <Meter done={acc.week.videos} goal={acc.week.videoGoal} className="mt-2" />
          <p className="mt-2 text-[12px] text-muted-foreground">{paceMessage(acc.week, goals.recordDay)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">{first.toLocaleDateString("en-US", { month: "long" })} <PaceBadge pace={acc.month.pace} short={acc.month.short} /></div>
          <div className="mt-1 font-serif text-[30px] leading-tight tnum">{acc.month.videos}<span className="text-muted-foreground">/{acc.month.videoTarget}</span> <span className="text-[15px] text-muted-foreground">videos</span></div>
          <Meter done={acc.month.videos} goal={acc.month.videoTarget} className="mt-2" />
          <p className="mt-2 text-[12px] text-muted-foreground tnum">Posts {acc.month.posts}/{acc.month.postTarget} · {monthItems.length} planned · {slots.length} open {slots.length === 1 ? "slot" : "slots"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[13px] text-muted-foreground">Streak</div>
          <div className="mt-1 flex items-center gap-2 font-serif text-[30px] leading-tight tnum"><Flame className={cn("size-6", acc.streak > 0 ? "text-primary" : "text-muted-foreground")} />{acc.streak} <span className="text-[15px] text-muted-foreground">{acc.streak === 1 ? "week" : "weeks"}</span></div>
          <p className="mt-2 text-[12px] text-muted-foreground">{acc.streak > 0 ? `Weeks in a row you hit ${goals.videosPerWeek} ${goals.videosPerWeek === 1 ? "video" : "videos"}. Keep it going this week.` : "Hit your video goal this week to start a streak. Consistency is what the algorithms (and clients) reward."}</p>
        </div>
      </section>

      {/* Calendar (tablet and up) */}
      <section className="hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <div key={wd} className="px-2 py-2 text-center text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              {DAY_SHORT[wd]}
              {wd === goals.recordDay && <span className="ml-1 rounded bg-primary/12 px-1 text-[9px] text-primary normal-case">Record</span>}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const key = ymd(d);
            const cell = byDay.get(key);
            const past = key < today;
            const slotHint = !past && inMonth(d) && ((goals.videoDays.includes(d.getDay()) && !cell?.items.some((i) => i.kind === "video") && !cell?.shipped.some((s) => s.kind === "video")) || (goals.postDays.includes(d.getDay()) && !cell?.items.some((i) => i.kind === "post") && !cell?.shipped.some((s) => s.kind === "post")));
            return (
              <div key={key} className={cn("group relative min-h-[118px] border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth(d) && "bg-muted/30", key === today && "bg-brass-soft/30")}>
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className={cn("text-[12px] tnum", key === today ? "flex size-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" : inMonth(d) ? "text-foreground" : "text-muted-foreground/60")}>{d.getDate()}</span>
                  {inMonth(d) && <button type="button" onClick={() => setAdding(key)} className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100" aria-label={`Add to ${key}`}><Plus className="size-3.5" /></button>}
                </div>
                <div className="space-y-1">
                  {cell?.items.map((it) => {
                    const st = itemStatus(it, videos, posts);
                    return (
                      <button key={it.id} type="button" onClick={() => setEditing(it)} className={cn("flex w-full cursor-pointer items-start gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-snug transition hover:shadow-sm", STATUS_STYLE[st.key])} title={`${it.title} · ${st.label}`}>
                        {it.kind === "video" ? <Clapperboard className="mt-px size-3 shrink-0 opacity-70" /> : <PenLine className="mt-px size-3 shrink-0 opacity-70" />}
                        <span className="line-clamp-2">{it.title}</span>
                      </button>
                    );
                  })}
                  {cell?.shipped.map((s) => (
                    <Link key={s.id} href={s.href} className="flex items-start gap-1 rounded-md border border-success/30 bg-success-soft/60 px-1.5 py-1 text-[11px] leading-snug text-success" title={`${s.title} · ${s.scheduled ? "Scheduled" : "Posted"}`}>
                      {s.kind === "video" ? <Clapperboard className="mt-px size-3 shrink-0 opacity-70" /> : <PenLine className="mt-px size-3 shrink-0 opacity-70" />}
                      <span className="line-clamp-2">{s.title}</span>
                    </Link>
                  ))}
                  {slotHint && !cell?.items.length && (
                    <button type="button" onClick={() => setAdding(key)} className="w-full cursor-pointer rounded-md border border-dashed border-border px-1.5 py-1 text-left text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground">
                      Open slot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          {[["planned", "Planned"], ["making", "Being made"], ["ready", "Ready: review, post or film"], ["in_progress", "In progress"], ["scheduled", "Scheduled / posted"], ["overdue", "Late or needs attention"]].map(([k, l]) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm border", STATUS_STYLE[k as ItemStatus["key"]])} />{l}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-border" />Open slot your goal calls for</span>
        </div>
      </section>

      {/* Agenda (phones) */}
      <section className="space-y-2 sm:hidden">
        {monthItems.length === 0 && <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">Nothing planned for {monthLabel} yet. Tap Plan my month and Renom lines up a topic for every slot.</p>}
        {monthItems.map((it) => {
          const st = itemStatus(it, videos, posts);
          const d = parseYmd(it.date);
          return (
            <button key={it.id} type="button" onClick={() => setEditing(it)} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left", STATUS_STYLE[st.key])}>
              <div className="w-10 shrink-0 text-center">
                <div className="text-[10px] tracking-wider uppercase opacity-70">{DAY_SHORT[d.getDay()]}</div>
                <div className="font-serif text-lg leading-tight tnum">{d.getDate()}</div>
              </div>
              {it.kind === "video" ? <Clapperboard className="size-4 shrink-0 opacity-70" /> : <PenLine className="size-4 shrink-0 opacity-70" />}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[14px] font-medium">{it.title}</div>
                <div className="text-[12px] opacity-80">{st.label}</div>
              </div>
            </button>
          );
        })}
        <Button variant="outline" className="w-full rounded-full" onClick={() => setAdding(ymd(isThisMonth ? new Date() : first))}><Plus /> Add to the plan</Button>
      </section>

      <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} goals={goals} onSave={(g) => { updateProfile({ goals: g }); toast.success("Goal saved", { description: `${g.videosPerWeek} ${g.videosPerWeek === 1 ? "video" : "videos"} and ${g.postsPerWeek} ${g.postsPerWeek === 1 ? "post" : "posts"} a week.` }); }} />
      <ScriptAheadDialog open={scripting} onOpenChange={setScripting} month={month} />
      <ClipLongDialog open={clipping} onOpenChange={setClipping} />
      <PrepareDialog
        open={!!preparing}
        onOpenChange={(v) => !v && setPreparing(null)}
        videos={preparing === "month" ? slots.slice(0, 16).filter((x) => x.kind === "video").length + unprepared.filter((x) => x.kind === "video").length : (preparing ?? []).filter((x) => x.kind === "video").length}
        posts={preparing === "month" ? slots.slice(0, 16).filter((x) => x.kind === "post").length + unprepared.filter((x) => x.kind === "post").length : (preparing ?? []).filter((x) => x.kind === "post").length}
        title={preparing === "month" ? `Plan ${first.toLocaleDateString("en-US", { month: "long" })} for me` : "Get it ready"}
        description={preparing === "month" ? "We pick a topic for every slot your goal calls for, write every post with its picture, and script every video. You just review, post, and film or approve." : "We write it and get it ready for you to review."}
        busy={busy || prog.running}
        onGo={(c) => {
          if (preparing === "month") void planAndPrepare(c);
          else if (preparing) {
            const items = preparing.map((p) => ({ ...p, prep: undefined, ...(p.kind === "video" ? { make: c.make } : {}) }));
            for (const p of items) if (p.kind === "video") updatePlanItem(p.id, { make: c.make });
            setPreparing(null);
            void prepare(items, optionsFrom(c));
          }
        }}
      />
      <AddDialog date={adding} onClose={() => setAdding(null)} onAdd={(it) => { addPlanItems([it]); setAdding(null); }} />
      <ItemDialog item={editing ? (plan.find((p) => p.id === editing.id) ?? null) : null} onClose={() => setEditing(null)} status={editing ? itemStatus(plan.find((p) => p.id === editing.id) ?? editing, videos, posts) : null}
        onSave={(patch) => editing && updatePlanItem(editing.id, patch)}
        onDelete={() => { if (editing) { deletePlanItem(editing.id); setEditing(null); toast("Removed from the plan"); } }}
        onOpen={() => { if (editing) { const it = plan.find((p) => p.id === editing.id) ?? editing; setEditing(null); open(it); } }}
        onRetry={() => { if (editing) { const it = plan.find((p) => p.id === editing.id) ?? editing; setEditing(null); retry(it); } }}
        onMakeAi={() => { if (editing) { const it = plan.find((p) => p.id === editing.id) ?? editing; setEditing(null); setPreparing([it]); } }}
        working={prog.running} />
    </PageContainer>
  );
}

// ── Goals ──

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const on = value.includes(d);
        return (
          <button key={d} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())} className={cn("min-w-11 cursor-pointer rounded-full border px-2.5 py-1 text-[13px] transition", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}>
            {DAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

function GoalsDialog({ open, onOpenChange, goals, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; goals: PostingGoals; onSave: (g: PostingGoals) => void }) {
  const [videoDays, setVideoDays] = React.useState(goals.videoDays);
  const [postDays, setPostDays] = React.useState(goals.postDays);
  const [recordDay, setRecordDay] = React.useState(goals.recordDay);
  const [emailReminder, setEmailReminder] = React.useState(goals.emailReminder !== false);
  const [testing, setTesting] = React.useState(false);
  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await fetch("/api/notifications/test", { method: "POST" });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; emailed?: boolean; emailSetUp?: boolean } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Couldn’t send it.");
      window.dispatchEvent(new Event("renom:notifications"));
      toast.success("Reminder sent", { description: j.emailed ? "Check the bell at the top right, and your inbox." : j.emailSetUp ? "It’s in the bell at the top right (emails are off in your goal)." : "It’s in the bell at the top right. Email isn’t switched on for this studio yet." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };
  React.useEffect(() => {
    if (open) {
      setEmailReminder(goals.emailReminder !== false);
      setVideoDays(goals.videoDays);
      setPostDays(goals.postDays);
      setRecordDay(goals.recordDay);
    }
  }, [open, goals]);
  const presets = [1, 2, 3, 5];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Your posting goal</DialogTitle>
          <DialogDescription>Pick the days things go out. Two videos a week, every week, beats ten in one week and none the next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[13px] font-medium">Videos go out on <span className="font-normal text-muted-foreground">{videoDays.length} a week · {Math.round((videoDays.length * 30) / 7)} a month</span></div>
            <DayPicker value={videoDays} onChange={setVideoDays} />
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-muted-foreground">
              Quick pick:
              {presets.map((n) => <button key={n} type="button" className="cursor-pointer text-primary underline-offset-2 hover:underline" onClick={() => setVideoDays(spreadDays(n))}>{n}/week</button>)}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[13px] font-medium">Text and image posts go out on <span className="font-normal text-muted-foreground">{postDays.length} a week</span></div>
            <DayPicker value={postDays} onChange={setPostDays} />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium">Record day</div>
            <Select value={String(recordDay)} onValueChange={(v) => setRecordDay(Number(v))}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5, 6, 0].map((d) => <SelectItem key={d} value={String(d)}>{DAY_NAMES[d]}</SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1.5 text-[12px] text-muted-foreground">Batch the week’s videos in one sitting. On this day Renom sends you a reminder with where you stand and what’s ready to record.</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
              <Checkbox checked={emailReminder} onCheckedChange={(v) => setEmailReminder(v === true)} className="mt-0.5" />
              <span><span className="font-medium">Email me on my record day</span><span className="block text-[12px] text-muted-foreground">You’ll always get it in the bell at the top right; this also sends it to your inbox.</span></span>
            </label>
            <button type="button" onClick={sendTest} disabled={testing} className="mt-2 ml-6.5 cursor-pointer text-[12px] text-primary underline-offset-2 hover:underline disabled:opacity-60">{testing ? "Sending…" : "Send me this week’s reminder now"}</button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { onSave({ videosPerWeek: videoDays.length, postsPerWeek: postDays.length, videoDays, postDays, recordDay, emailReminder }); onOpenChange(false); }}>Save goal</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Add and edit ──

function AddDialog({ date, onClose, onAdd }: { date: string | null; onClose: () => void; onAdd: (it: Omit<PlanItem, "id" | "createdAt">) => void }) {
  const [kind, setKind] = React.useState<"video" | "post">("video");
  const [title, setTitle] = React.useState("");
  const [day, setDay] = React.useState(date ?? "");
  React.useEffect(() => {
    if (date) {
      setDay(date);
      setTitle("");
    }
  }, [date]);
  const add = () => title.trim() && day && onAdd({ date: day, kind, title: title.trim(), ...(kind === "video" ? { format: "short" as VideoFormat } : { postKind: "text" as const }) });
  return (
    <Dialog open={!!date} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add to the plan</DialogTitle>
          <DialogDescription>A working title is enough. You’ll pick the angle and script when you start it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as "video" | "post")} className="rounded-full">
            <ToggleGroupItem value="video" className="rounded-full"><Clapperboard /> Video</ToggleGroupItem>
            <ToggleGroupItem value="post" className="rounded-full"><PenLine /> Post</ToggleGroupItem>
          </ToggleGroup>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={kind === "video" ? "e.g. The Roth conversion window most people miss" : "e.g. 3 questions to ask before you exercise options"} />
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-48" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={add} disabled={!title.trim() || !day}><Plus /> Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({ item, status, onClose, onSave, onDelete, onOpen, onRetry, onMakeAi, working }: { item: PlanItem | null; status: ItemStatus | null; onClose: () => void; onSave: (p: Partial<PlanItem>) => void; onDelete: () => void; onOpen: () => void; onRetry: () => void; onMakeAi: () => void; working: boolean }) {
  const [title, setTitle] = React.useState("");
  const [day, setDay] = React.useState("");
  React.useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDay(item.date);
    }
  }, [item]);
  if (!item || !status) return null;
  const started = !!(item.videoId || item.postId);
  const dirty = title.trim() !== item.title || day !== item.date;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            {item.kind === "video" ? <Clapperboard className="size-4" /> : <PenLine className="size-4" />} {item.kind === "video" ? "Video" : "Post"} ·{" "}
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", STATUS_STYLE[status.key])}>{status.label}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Planned {item.kind}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 font-serif text-xl leading-snug outline-none focus:border-primary/60" />
          {(item.subject || item.angle) && (
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {item.subject && <span className="rounded-full bg-muted px-2 py-0.5">{item.subject}</span>}
              {item.angle && <span className="rounded-full bg-brass-soft px-2 py-0.5 text-[#7d6238] dark:text-primary">{item.angle}</span>}
            </div>
          )}
          {!!item.outline?.length && (
            <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-[13px] text-muted-foreground">
              {item.outline.map((o) => <li key={o} className="flex gap-2"><span className="text-primary">•</span>{o}</li>)}
            </ul>
          )}
          {item.prep === "error" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 text-destructive">{item.prepError ?? "Something went wrong getting this ready."}</span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={onRetry} disabled={working}>Try again</Button>
            </div>
          )}
          {item.kind === "video" && !item.aiJobId && status.key !== "posted" && status.key !== "scheduled" && item.prep !== "working" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[13px]">
              <span className="text-muted-foreground">{item.make === "film" ? "You’re filming this one." : item.make === "ai" ? "This one is an AI video." : "Film it yourself, or have it made as an AI video."}</span>
              {item.make !== "ai" && <Button size="sm" variant="outline" className="rounded-full" onClick={onMakeAi} disabled={working}><Clapperboard /> Make it an AI video</Button>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Goes out</span>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /> Remove</Button>
            <div className="flex gap-2">
              {dirty && <Button variant="outline" onClick={() => { onSave({ title: title.trim() || item.title, date: day || item.date }); toast.success("Saved"); }}>Save</Button>}
              <Button onClick={() => { if (dirty) onSave({ title: title.trim() || item.title, date: day || item.date }); onOpen(); }}>
                {status.label === "Film today" || status.label === "Script ready · film it" || status.label === "Late · film it" ? "Open the studio and film" : status.key === "ready" || status.label === "Late · ready to post" ? "Review and post" : started ? "Continue" : item.kind === "video" ? (item.outline?.length ? "Write the script" : "Start this video") : "Write this post"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
