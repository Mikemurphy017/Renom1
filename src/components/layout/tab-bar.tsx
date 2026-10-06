"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { useShell } from "./shell-context";

/** Phone navigation: four tabs with New video in the middle, like a native app. */
export function TabBar() {
  const pathname = usePathname();
  const { reviews, requireApproval } = useStore();
  const { openNewVideo } = useShell();
  const waiting = reviews.filter((r) => r.status === "submitted").length;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const tab = (n: (typeof NAV)[number]) => {
    const active = isActive(n.href);
    return (
      <Link key={n.href} href={n.href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
        <n.icon className={cn("size-[22px]", active && "text-primary")} strokeWidth={active ? 2.2 : 1.8} />
        {n.href === "/approve" && !requireApproval ? "Archive" : n.label}
        {n.href === "/approve" && waiting > 0 && <span className="absolute top-1 right-[calc(50%-18px)] flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground tnum">{waiting}</span>}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Main">
      <div className="mx-auto flex max-w-md items-stretch px-2">
        {NAV.slice(0, 2).map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <button onClick={openNewVideo} aria-label="New video" className="-mt-5 flex size-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_rgba(176,141,87,.7)] ring-4 ring-background active:scale-95">
            <Plus className="size-6" />
          </button>
        </div>
        {NAV.slice(2).map(tab)}
      </div>
    </nav>
  );
}
