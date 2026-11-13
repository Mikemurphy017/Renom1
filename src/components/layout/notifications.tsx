"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, Check, CheckCheck, Circle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import { cn, relativeTime } from "@/lib/utils";

interface Notice {
  id: string;
  kind: "record_day" | "film_day";
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
}

/** The bell in the top bar: record-day reminders and the like, each marked read or unread. */
export function NotificationsBell() {
  const router = useRouter();
  const { account } = useStore();
  const [items, setItems] = React.useState<Notice[]>([]);
  const [open, setOpen] = React.useState(false);
  const unread = items.filter((n) => !n.read).length;

  const load = React.useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; items?: Notice[] } | null;
    if (j?.ok && j.items) setItems(j.items);
  }, []);

  React.useEffect(() => {
    if (!account) return;
    void load();
    const t = window.setInterval(() => void load(), 120_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("renom:notifications", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("renom:notifications", onFocus);
    };
  }, [account, load]);

  const mark = async (read: boolean, ids?: string[]) => {
    // Show it straight away; the server confirms.
    setItems((xs) => xs.map((n) => (!ids || ids.includes(n.id) ? { ...n, read } : n)));
    const r = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read, ids }) }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { ok?: boolean; items?: Notice[] } | null;
    if (j?.ok && j.items) setItems(j.items);
  };

  if (!account) return null;
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger className="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tnum">{unread > 9 ? "9+" : unread}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-[14px] font-semibold">Notifications</div>
          {unread > 0 && (
            <button type="button" onClick={() => void mark(true)} className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-primary hover:underline">
              <CheckCheck className="size-3.5" /> Mark all as read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            <Bell className="mx-auto mb-2 size-5 opacity-60" />
            Nothing yet. On your record day you’ll get a reminder here with what’s ready to record.
          </div>
        ) : (
          <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={cn("group relative flex gap-3 px-4 py-3", !n.read && "bg-brass-soft/40")}>
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}><CalendarDays className="size-4" /></span>
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => {
                    if (!n.read) void mark(true, [n.id]);
                    setOpen(false);
                    router.push(n.href);
                  }}
                >
                  <div className={cn("text-[13px] leading-snug", n.read ? "text-foreground/80" : "font-semibold")}>{n.title}</div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body.split("\n\n")[0]}</p>
                  <div className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => void mark(!n.read, [n.id])}
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={n.read ? "Mark as unread" : "Mark as read"}
                  aria-label={n.read ? "Mark as unread" : "Mark as read"}
                >
                  {n.read ? <Circle className="size-3" /> : <Check className="size-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
