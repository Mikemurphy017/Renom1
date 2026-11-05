"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Clapperboard, Flame, PenLine, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAY_NAMES, parseYmd, type Pace } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { useAccountability, useOpenPlanItem } from "./use-plan";

export function PaceBadge({ pace, short, className }: { pace: Pace; short: number; className?: string }) {
  const text = pace === "hit" ? "Goal hit" : pace === "on_track" ? "On track" : `Behind by ${short}`;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", pace === "behind" ? "bg-destructive/10 text-destructive" : pace === "hit" ? "bg-success-soft text-success" : "bg-brass-soft text-[#7d6238] dark:text-primary", className)}>{text}</span>;
}

export function Meter({ done, goal, className }: { done: number; goal: number; className?: string }) {
  return (
    <div className={cn("flex gap-1", className)} aria-label={`${done} of ${goal}`}>
      {Array.from({ length: Math.max(goal, done, 1) }).map((_, i) => (
        <span key={i} className={cn("h-2 flex-1 rounded-full", i < done ? "bg-primary" : "bg-muted", i >= goal && "bg-success")} />
      ))}
    </div>
  );
}

/** What "behind" or "on track" means for this week, in plain words. */
export function paceMessage(week: ReturnType<typeof useAccountability>["week"], recordDay: number) {
  const left = Math.max(0, week.videoGoal - week.videos);
  if (week.videoGoal <= 0) return "No weekly video goal set.";
  if (left === 0) return week.videos > week.videoGoal ? "Goal beaten this week. Anything more is a head start on next week." : "This week’s videos are out. Nice work.";
  const days = week.daysLeft;
  if (week.pace === "behind") return `${left} more ${left === 1 ? "video" : "videos"} to go out in ${days} ${days === 1 ? "day" : "days"}. Block 30 minutes${new Date().getDay() === recordDay ? " today, your record day" : ""} and record ${left === 1 ? "it" : "them"} back to back.`;
  return `${left} more ${left === 1 ? "video" : "videos"} to go out this week. ${DAY_NAMES[recordDay]} is your record day.`;
}

/** Home: this week against the goal, the streak, and what to do next. */
export function ThisWeekCard() {
  const { goals, hasGoals, week, streak, next } = useAccountability();
  const open = useOpenPlanItem();

  if (!hasGoals)
    return (
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/30 bg-brass-soft/40 p-5 sm:p-6">
        <span className="flex size-11 items-center justify-center rounded-xl bg-card text-primary"><Target className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[22px] leading-tight">Set your posting goal</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Decide how many videos and posts go out each week. Renom plans the month and keeps you on pace.</p>
        </div>
        <Button asChild className="rounded-full"><Link href="/plan?goals=1">Set my goal <ArrowRight /></Link></Button>
      </section>
    );

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">This week</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-serif text-[24px] leading-tight">
            {week.videos} of {week.videoGoal} {week.videoGoal === 1 ? "video" : "videos"} out <PaceBadge pace={week.pace} short={week.short} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-[13px]" title="Weeks in a row you hit your video goal">
          <Flame className={cn("size-4", streak > 0 ? "text-primary" : "text-muted-foreground")} />
          <span className="font-medium tnum">{streak}</span> <span className="text-muted-foreground">week streak</span>
        </div>
      </div>
      <Meter done={week.videos} goal={week.videoGoal} className="mt-4" />
      <p className="mt-3 text-[13px] text-muted-foreground">{paceMessage(week, goals.recordDay)}{goals.postsPerWeek > 0 && <> Posts: {week.posts} of {week.postGoal}.</>}</p>

      {next.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {next.slice(0, 3).map(({ item, status }) => {
            const d = parseYmd(item.date);
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-11 shrink-0 text-center">
                  <div className="text-[10px] tracking-wider text-muted-foreground uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="font-serif text-lg leading-tight tnum">{d.getDate()}</div>
                </div>
                {item.kind === "video" ? <Clapperboard className="size-4 shrink-0 text-muted-foreground" /> : <PenLine className="size-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{item.title}</div>
                  <div className={cn("text-[12px]", status.key === "overdue" ? "text-destructive" : "text-muted-foreground")}>{status.label}</div>
                </div>
                <Button size="sm" variant={status.key === "overdue" ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => open(item)}>{item.videoId || item.postId ? "Continue" : "Start"}</Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground">Nothing planned for the rest of this week. Plan your month and Renom lines up a topic for every slot.</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button asChild variant="ghost" className="rounded-full text-primary hover:text-primary"><Link href="/plan"><CalendarDays /> Open your plan</Link></Button>
      </div>
    </section>
  );
}
