"use client";

import { Bell, CircleHelp, Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { useShell } from "./shell-context";

const NOTIFICATIONS = [
  { title: "Changes requested", body: "Ruth left 2 comments on “RSUs vs. ISOs”.", time: "18h ago", unread: true },
  { title: "Approved", body: "“3 Roth Conversion Mistakes” is cleared to publish.", time: "2d ago", unread: true },
  { title: "Inquiry from content", body: "New booking via “$500K Inheritance” on LinkedIn.", time: "3d ago", unread: false },
];

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { openPalette, openNewVideo } = useShell();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <button
        onClick={openPalette}
        className="flex h-9 w-full max-w-md cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate">Search videos, steps, settings…</span>
        <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="eyebrow">Notifications</span>
              <button className="cursor-pointer text-xs text-primary">Mark all read</button>
            </div>
            <ul>
              {NOTIFICATIONS.map((n, i) => (
                <li key={i} className="flex gap-3 border-b border-border px-4 py-3 last:border-0">
                  <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-transparent"}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.body}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground/80">{n.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Help">
              <CircleHelp className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help & shortcuts</TooltipContent>
        </Tooltip>
        <Button size="sm" className="ml-2" onClick={openNewVideo}>
          <Plus /> <span className="hidden sm:inline">New Video</span>
        </Button>
      </div>
    </header>
  );
}
