import type { PlanItem, PostDraft, PostingGoals, Video } from "./types";
import { getStage } from "./stages";

/**
 * The content calendar and the accountability built on it: posting goals,
 * what's shipped each week and month, the streak of weeks on goal, and what
 * still needs planning. Weeks run Monday to Sunday, in the advisor's local time.
 */

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekdays to spread n things across, Monday-first, as evenly as a week allows. */
export function spreadDays(n: number): number[] {
  const table: Record<number, number[]> = { 0: [], 1: [2], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] };
  return table[Math.max(0, Math.min(7, Math.round(n)))];
}

export const DEFAULT_GOALS: PostingGoals = { videosPerWeek: 2, postsPerWeek: 2, recordDay: 1, videoDays: spreadDays(2), postDays: [1, 3] };

export function goalsOf(g?: PostingGoals): PostingGoals {
  return { ...DEFAULT_GOALS, ...(g ?? {}) };
}

// ── Dates (local) ──

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Monday of the week d falls in. */
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const within = (iso: string | undefined, from: Date, to: Date) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
};

// ── What's shipped ──

/** When a video goes (or went) out: published, or scheduled. */
export const videoOutAt = (v: Video) => (v.status === "published" ? (v.publishedAt ?? v.scheduledFor ?? v.lastEdited) : v.status === "scheduled" ? v.scheduledFor : undefined);
export const postOutAt = (p: PostDraft) => (p.status === "published" ? (p.publishedAt ?? p.scheduledFor ?? p.updatedAt) : p.status === "scheduled" ? p.scheduledFor : undefined);

export function shippedBetween(videos: Video[], posts: PostDraft[], from: Date, to: Date) {
  return {
    videos: videos.filter((v) => within(videoOutAt(v), from, to)).length,
    posts: posts.filter((p) => within(postOutAt(p), from, to)).length,
  };
}

/** Consecutive weeks the video goal was met, counting back from last week (this week counts once it's met). */
export function streakWeeks(videos: Video[], goals: PostingGoals, today = new Date()) {
  if (goals.videosPerWeek <= 0) return 0;
  const thisWeek = startOfWeek(today);
  const met = (from: Date) => shippedBetween(videos, [], from, addDays(from, 7)).videos >= goals.videosPerWeek;
  let n = met(thisWeek) ? 1 : 0;
  for (let w = addDays(thisWeek, -7), i = 0; i < 104 && met(w); w = addDays(w, -7), i++) n++;
  return n;
}

export type Pace = "hit" | "on_track" | "behind";

/** Against the goal: done vs. what should be out by now (the goal's video days already past). */
export function pace(done: number, target: number, expected: number): { pace: Pace; short: number } {
  if (target <= 0 || done >= target) return { pace: "hit", short: 0 };
  return done >= expected ? { pace: "on_track", short: target - done } : { pace: "behind", short: expected - done };
}

/** How many of the goal's video days fall in [from, until): what should be out by now. */
function dueDays(goals: PostingGoals, from: Date, until: Date) {
  let n = 0;
  for (let d = startOfDay(from); d < until; d = addDays(d, 1)) if (goals.videoDays.includes(d.getDay())) n++;
  return n;
}

export function weekSummary(videos: Video[], posts: PostDraft[], goals: PostingGoals, today = new Date()) {
  const from = startOfWeek(today);
  const to = addDays(from, 7);
  const done = shippedBetween(videos, posts, from, to);
  const expected = Math.min(goals.videosPerWeek, dueDays(goals, from, startOfDay(today)));
  return { from, to, ...done, videoGoal: goals.videosPerWeek, postGoal: goals.postsPerWeek, ...pace(done.videos, goals.videosPerWeek, expected), daysLeft: Math.max(0, Math.ceil((to.getTime() - today.getTime()) / 86400_000)) };
}

/** A month's goal is the weekly goal across its days. */
export const monthTarget = (perWeek: number, month: Date) => Math.round((perWeek * daysInMonth(month)) / 7);

export function monthSummary(videos: Video[], posts: PostDraft[], goals: PostingGoals, month: Date, today = new Date()) {
  const from = startOfMonth(month);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const done = shippedBetween(videos, posts, from, to);
  const videoTarget = monthTarget(goals.videosPerWeek, from);
  const postTarget = monthTarget(goals.postsPerWeek, from);
  const until = today < from ? from : today >= to ? to : startOfDay(today);
  const expected = Math.min(videoTarget, dueDays(goals, from, until));
  return { from, to, ...done, videoTarget, postTarget, ...pace(done.videos, videoTarget, expected) };
}

// ── Plan items ──

export type ItemStatus = { key: "posted" | "scheduled" | "in_progress" | "planned" | "overdue"; label: string };

export function itemStatus(item: PlanItem, videos: Video[], posts: PostDraft[], today = new Date()): ItemStatus {
  const overdue = parseYmd(item.date) < startOfDay(today);
  if (item.kind === "video") {
    const v = item.videoId ? videos.find((x) => x.id === item.videoId) : undefined;
    if (v?.status === "published") return { key: "posted", label: "Posted" };
    if (v?.status === "scheduled") return { key: "scheduled", label: "Scheduled" };
    if (v) return { key: overdue ? "overdue" : "in_progress", label: overdue ? `Late · ${getStage(v.stage).label}` : getStage(v.stage).label };
  } else {
    const p = item.postId ? posts.find((x) => x.id === item.postId) : undefined;
    if (p?.status === "published") return { key: "posted", label: "Posted" };
    if (p?.status === "scheduled") return { key: "scheduled", label: "Scheduled" };
    if (p) return { key: overdue ? "overdue" : "in_progress", label: overdue ? "Late · Draft" : "Draft" };
  }
  return overdue ? { key: "overdue", label: "Missed" } : { key: "planned", label: "Planned" };
}

/**
 * The open days in a month, from today on, that the goals call for but nothing
 * is planned or going out: what "Plan my month" fills.
 */
export function openSlots(month: Date, goals: PostingGoals, plan: PlanItem[], videos: Video[], posts: PostDraft[], today = new Date()) {
  const first = startOfMonth(month);
  const days = daysInMonth(first);
  const start = startOfDay(today) > first ? startOfDay(today) : first;
  const taken = (kind: "video" | "post", day: string) =>
    plan.some((p) => p.kind === kind && p.date === day) ||
    (kind === "video" ? videos.some((v) => { const at = videoOutAt(v); return !!at && ymd(new Date(at)) === day; }) : posts.some((p) => { const at = postOutAt(p); return !!at && ymd(new Date(at)) === day; }));
  const slots: { date: string; kind: "video" | "post" }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(first, i);
    if (d < start) continue;
    const day = ymd(d);
    if (goals.videosPerWeek > 0 && goals.videoDays.includes(d.getDay()) && !taken("video", day)) slots.push({ date: day, kind: "video" });
    if (goals.postsPerWeek > 0 && goals.postDays.includes(d.getDay()) && !taken("post", day)) slots.push({ date: day, kind: "post" });
  }
  return slots;
}

/** What needs doing next, most urgent first: late items, then this week's, then what's left to plan. */
export function nextUp(plan: PlanItem[], videos: Video[], posts: PostDraft[], today = new Date()) {
  const weekEnd = addDays(startOfWeek(today), 7);
  return plan
    .map((p) => ({ item: p, status: itemStatus(p, videos, posts, today) }))
    .filter((x) => (x.status.key === "overdue" || x.status.key === "planned" || x.status.key === "in_progress") && parseYmd(x.item.date) < weekEnd)
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
}
