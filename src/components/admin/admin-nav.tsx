"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { ChartLine, Layers, Send, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Accounts", icon: UsersRound },
  { href: "/admin/posting", label: "Posting queue", icon: Send },
  { href: "/admin/buffer", label: "Buffer", icon: Layers },
  { href: "/admin/analytics", label: "Analytics", icon: ChartLine },
];

export function AdminNav() {
  const pathname = usePathname();
  // Requests waiting on the team, shown on the Posting queue tab.
  const [waiting, setWaiting] = React.useState(0);
  React.useEffect(() => {
    fetch("/api/admin/posting", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setWaiting(j.requests.filter((r: { status: string }) => r.status === "submitted").length))
      .catch(() => {});
  }, [pathname]);
  return (
    <div className="mb-8">
      <div className="eyebrow mb-3">Admin</div>
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[14px] transition-colors", active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="size-4" /> {t.label}
              {t.href === "/admin/posting" && waiting > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tnum">{waiting}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
