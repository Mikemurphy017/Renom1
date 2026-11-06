"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Clapperboard, Flame, LoaderCircle, PenLine, PenTool, Plus, Scissors, Settings2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const STATUS_STYLE: Record<ItemStatus["key"], string> = {
  posted: "border-success/30 bg-success-soft text-success",
  scheduled: "border-success/30 bg-success-soft/60 text-success",
  in_progress: "border-primary/40 bg-brass-soft/70 text-foreground",
  planned: "border-border bg-card text-foreground",
  overdue: "border-destructive/40 bg-destructive/8 text-destructive",
};

type Shipped = { id: string; kind: "video" | "post"; title: string; date: string; href: string; scheduled: boolean };

export function PlanPage() {
  const { videos, posts, plan, profile, updateProfile, addPlanItems, updatePlanItem, deletePlanItem } = useStore();
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

  const planMonth = async () => {
    if (!slots.length) return toast("This month is fully planned", { description: "Every slot your goal calls for has something in it. Add more by clicking a day." });
    const take = slots.slice(0, 16);
    const existing = [
      ...videos.slice(0, 120).map((v) => ({ title: v.title, subject: v.subject, angle: v.angle })),
      ...plan.map((p) => ({ title: p.title, subject: p.subject, angle: p.angle })),
      ...(profile.ideaLog ?? []).slice(-150),
    ];
    try {
      const out = await write({ task: "ideas", profile: voiceProfileOf(profile), mode: "evergreen", format: "short", count: take.length, existing, instruction: `This is the advisor's content plan for ${first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Where the season matters (tax deadlines, open enrollment, year-end), let a few ideas use it.` });
      const ideas = out.ideas;
      const made = addPlanItems(
        take.slice(0, ideas.length).map((s, i) => {
          const idea = ideas[i];
          return { date: s.date, kind: s.kind, title: idea.title.replace(/^[“"]|[”"]$/g, ""), subject: idea.subject, angle: idea.angle, category: idea.category as Category, outline: idea.outline, ...(s.kind === "video" ? { format: "short" as VideoFormat } : { postKind: "text" as const }) };
        })
      );
      const titles = new Set((profile.ideaLog ?? []).map((x) => x.title));
      updateProfile({ ideaLog: [...(profile.ideaLog ?? []), ...ideas.filter((i) => !titles.has(i.title)).map(({ title, subject, angle }) => ({ title, subject, angle }))].slice(-300) });
      const left = slots.length - made.length;
      toast.success(`Planned ${made.length} ${made.length === 1 ? "slot" : "slots"}`, { description: left > 0 ? `${left} still open. Run Plan my month again to fill them.` : "Every slot this month has a topic. Open any one to start it." });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast.error("Couldn’t plan the month", { description: (e as Error).message });
    }
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
          <Button className="rounded-full" onClick={planMonth} disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" /> {status ?? "Planning…"}</> : <><Sparkles /> Plan my month{slots.length ? ` (${Math.min(16, slots.length)})` : ""}</>}</Button>
        </div>
      </div>

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
          {[["planned", "Planned"], ["in_progress", "In progress"], ["scheduled", "Scheduled / posted"], ["overdue", "Missed or late"]].map(([k, l]) => (
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
      <AddDialog date={adding} onClose={() => setAdding(null)} onAdd={(it) => { addPlanItems([it]); setAdding(null); }} />
      <ItemDialog item={editing ? (plan.find((p) => p.id === editing.id) ?? null) : null} onClose={() => setEditing(null)} status={editing ? itemStatus(plan.find((p) => p.id === editing.id) ?? editing, videos, posts) : null}
        onSave={(patch) => editing && updatePlanItem(editing.id, patch)}
        onDelete={() => { if (editing) { deletePlanItem(editing.id); setEditing(null); toast("Removed from the plan"); } }}
        onOpen={() => { if (editing) { const it = plan.find((p) => p.id === editing.id) ?? editing; setEditing(null); open(it); } }} />
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
  React.useEffect(() => {
    if (open) {
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
            <p className="mt-1.5 text-[12px] text-muted-foreground">Batch the week’s videos in one sitting. Renom nudges you on this day if you’re behind.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => { onSave({ videosPerWeek: videoDays.length, postsPerWeek: postDays.length, videoDays, postDays, recordDay }); onOpenChange(false); }}>Save goal</Button>
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

function ItemDialog({ item, status, onClose, onSave, onDelete, onOpen }: { item: PlanItem | null; status: ItemStatus | null; onClose: () => void; onSave: (p: Partial<PlanItem>) => void; onDelete: () => void; onOpen: () => void }) {
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
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted-foreground">Goes out</span>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /> Remove</Button>
            <div className="flex gap-2">
              {dirty && <Button variant="outline" onClick={() => { onSave({ title: title.trim() || item.title, date: day || item.date }); toast.success("Saved"); }}>Save</Button>}
              <Button onClick={() => { if (dirty) onSave({ title: title.trim() || item.title, date: day || item.date }); onOpen(); }}>
                {started ? "Continue" : item.kind === "video" ? (item.outline?.length ? "Write the script" : "Start this video") : "Write this post"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
