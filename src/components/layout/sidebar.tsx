"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ADVISOR } from "@/lib/mock/advisor";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { reviews } = useStore();
  const pending = reviews.filter((r) => r.status === "submitted" || r.status === "changes_requested").length;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-6 pb-8">
        <Logo />
        <div className="mt-1.5 pl-[38px] text-[10px] tracking-[0.18em] text-sidebar-foreground/70 uppercase">Advisor Studio</div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors",
                active ? "bg-sidebar-active text-[#F2EEE6]" : "hover:bg-sidebar-active/60 hover:text-[#F2EEE6]"
              )}
            >
              {active && (
                <motion.span layoutId="nav-active" className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-[#B08D57]" />
              )}
              <Icon className={cn("size-[17px]", active ? "text-[#D2B07A]" : "opacity-80")} strokeWidth={1.6} />
              {item.label}
              {item.href === "/compliance" && pending > 0 && (
                <span className="ml-auto rounded-full bg-[#B08D57]/20 px-1.5 text-[11px] font-medium text-[#D2B07A] tnum">{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg border border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B07A] to-[#9C7A47] font-serif text-sm text-[#0B1F3A]">
            CH
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[#F2EEE6]">
              {ADVISOR.name}, <span className="font-normal text-sidebar-foreground">CFP®</span>
            </div>
            <div className="truncate text-[11px]">{ADVISOR.firm}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
