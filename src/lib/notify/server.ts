import { randomBytes } from "node:crypto";
import { getJSON, putJSON } from "@/lib/storage/objects";
import { listUsers, loadState } from "@/lib/auth/server";
import { BRAND } from "@/lib/brand";
import { baseUrl, buttonEmail, emailConfigured, sendEmail } from "@/lib/email";
import { DAY_NAMES, goalsOf, itemStatus, parseYmd, startOfWeek, addDays, weekSummary } from "@/lib/plan";
import type { AdvisorProfile, PlanItem, PostDraft, Video } from "@/lib/types";

/**
 * In-app notifications (the bell) and the record-day reminder: once a week, on
 * the advisor's record day in their own time zone, a notice and an email with
 * where they stand this week and what's ready to record.
 */

export interface Notice {
  id: string;
  kind: "record_day";
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

interface Inbox {
  items: Notice[];
  /** Local date (YYYY-MM-DD) of the last record-day reminder, so it goes once. */
  lastRecordDay?: string;
}

const key = (userId: string) => `notify/${userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40)}.json`;
const read = async (userId: string): Promise<Inbox> => (await getJSON<Inbox>(key(userId)).catch(() => null)) ?? { items: [] };
const write = (userId: string, inbox: Inbox) => putJSON(key(userId), { ...inbox, items: inbox.items.slice(0, 100) });

export async function listNotices(userId: string) {
  const { items } = await read(userId);
  return { items, unread: items.filter((n) => !n.read).length };
}

/** Mark some (or all) notices read or unread. */
export async function markNotices(userId: string, read_: boolean, ids?: string[]) {
  const inbox = await read(userId);
  const pick = ids ? new Set(ids) : null;
  inbox.items = inbox.items.map((n) => (!pick || pick.has(n.id) ? { ...n, read: read_ } : n));
  await write(userId, inbox);
  return { items: inbox.items, unread: inbox.items.filter((n) => !n.read).length };
}

/** The date, weekday and hour where the advisor is. */
function localNow(tz: string | undefined, now = new Date()) {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]));
  } catch {
    return localNow("America/New_York", now);
  }
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const d = parseYmd(date);
  // A Date whose local fields are the advisor's: what lib/plan expects.
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(parts.hour));
  return { date, weekday: d.getDay(), hour: Number(parts.hour), at };
}

interface StudioState {
  profile?: AdvisorProfile;
  videos?: Video[];
  posts?: PostDraft[];
  plan?: PlanItem[];
}

/** What the reminder says: this week against the goal, what's scripted and ready, what's planned and not started. */
export function recordDayMessage(s: StudioState, at: Date) {
  const goals = goalsOf(s.profile?.goals);
  const videos = s.videos ?? [];
  const plan = s.plan ?? [];
  const week = weekSummary(videos, s.posts ?? [], goals, at);
  const ready = videos.filter((v) => v.stage === "record" && v.status !== "published" && v.script);
  const weekEnd = addDays(startOfWeek(at), 7);
  const notStarted = plan.filter((p) => p.kind === "video" && parseYmd(p.date) < weekEnd && itemStatus(p, videos, s.posts ?? [], at).key !== "posted" && !p.videoId);
  const left = Math.max(0, goals.videosPerWeek - week.videos);
  const first = s.profile?.name?.split(" ")[0] || "there";
  const lines = [
    left > 0 ? `It’s ${DAY_NAMES[goals.recordDay]}, your record day. ${week.videos} of ${goals.videosPerWeek} videos are out this week, so ${left} more to go.` : `It’s ${DAY_NAMES[goals.recordDay]}, your record day, and this week’s ${goals.videosPerWeek} videos are already out. Record a head start on next week.`,
    ready.length ? `Scripted and ready to record (${ready.length}):\n${ready.slice(0, 6).map((v) => `• ${v.title}`).join("\n")}` : "",
    notStarted.length ? `Planned this week, not started yet:\n${notStarted.slice(0, 6).map((p) => `• ${p.title}`).join("\n")}` : "",
    !ready.length && !notStarted.length ? "Nothing is scripted yet. Open your plan and use Write ahead to script the week in one go." : "",
  ].filter(Boolean);
  const href = ready[0] ? `/studio/${ready[0].id}/record` : "/plan";
  return {
    title: left > 0 ? `Record day: ${left} ${left === 1 ? "video" : "videos"} to go this week` : "Record day: you’re ahead this week",
    text: lines.join("\n\n"),
    greeting: `Hi ${first},`,
    href,
    button: ready.length ? `Record ${ready.length === 1 ? "it" : `all ${ready.length}`} now` : "Open your plan",
  };
}

/** Sends one advisor's record-day reminder now: notice always, email when it's on and set up. */
export async function sendRecordDayReminder(user: { id: string; email: string }, s: StudioState, at: Date, localDate: string) {
  const goals = goalsOf(s.profile?.goals);
  const msg = recordDayMessage(s, at);
  const inbox = await read(user.id);
  inbox.lastRecordDay = localDate;
  inbox.items = [{ id: `n${randomBytes(6).toString("hex")}`, kind: "record_day", title: msg.title, body: msg.text, href: msg.href, createdAt: new Date().toISOString(), read: false }, ...inbox.items];
  await write(user.id, inbox);
  let emailed = false;
  if (goals.emailReminder !== false && user.email && emailConfigured()) {
    emailed = await sendEmail({
      to: user.email,
      subject: msg.title,
      ...buttonEmail({ heading: msg.title.replace(/^Record day: /, "It’s record day: "), body: `${msg.greeting}\n\n${msg.text}`, button: msg.button, url: `${baseUrl()}${msg.href}`, footer: `You get this on your record day. Change the day, or turn these emails off, under Goals on your ${BRAND.name} plan.` }),
    }).catch((e) => (console.warn(`[notify] reminder email to ${user.id} failed:`, (e as Error).message), false));
  }
  return { emailed };
}

/** The hourly check: everyone whose record day it is (from 8am their time) gets their reminder once. */
export async function runRecordDayReminders(now = new Date()) {
  let sent = 0;
  for (const u of await listUsers().catch(() => [])) {
    if (u.disabled || !u.email) continue;
    try {
      const saved = await loadState(u.id).catch(() => null);
      const s = (saved?.state ?? null) as StudioState | null;
      if (!s?.profile?.goals) continue; // no goal set: nothing to hold them to
      const local = localNow(s.profile.timezone, now);
      if (local.weekday !== goalsOf(s.profile.goals).recordDay || local.hour < 8) continue;
      if ((await read(u.id)).lastRecordDay === local.date) continue;
      await sendRecordDayReminder(u, s, local.at, local.date);
      sent++;
    } catch (e) {
      console.warn(`[notify] record-day check for ${u.id} failed:`, (e as Error).message);
    }
  }
  if (sent) console.info(`[notify] record-day reminders sent: ${sent}`);
  return sent;
}

/** For the admin's "send me one now" test. */
export async function sendTestReminder(user: { id: string; email: string }) {
  const saved = await loadState(user.id).catch(() => null);
  const s = (saved?.state ?? {}) as StudioState;
  const local = localNow(s.profile?.timezone);
  const inbox = await read(user.id);
  const r = await sendRecordDayReminder(user, s, local.at, inbox.lastRecordDay ?? "");
  return r;
}

