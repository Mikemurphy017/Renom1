import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Fixed "today" so mock data and relative dates stay consistent. */
export const TODAY = new Date("2026-10-06T09:00:00");

export function daysFromToday(days: number, hour = 9, minute = 0) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-US", opts);
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(iso: string) {
  const diff = (TODAY.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 0) {
    const days = Math.round(-diff / 86400);
    return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  }
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  const days = Math.round(diff / 86400);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
