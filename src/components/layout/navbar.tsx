"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Command, LogOut, Moon, Plus, Settings, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV } from "./nav";
import { useShell } from "./shell-context";
import { BRAND } from "@/lib/brand";

export function Navbar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { reviews, profile, requireApproval } = useStore();
  const { openNewVideo, openPalette } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const waiting = reviews.filter((r) => r.status === "submitted").length;
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/videos" && pathname.startsWith("/studio")));

  return (
    <header className={cn("sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl", className)}>
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4 pt-[env(safe-area-inset-top)] sm:px-6 md:h-16">
        <Link href="/" aria-label={`${BRAND.name} home`}><Logo /></Link>
        {/* Phones use the tab bar at the bottom instead. */}
        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn("relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-card shadow-soft ring-1 ring-border" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
                <span className="relative">{n.href === "/approve" && !requireApproval ? "Archive" : n.label}</span>
                {n.href === "/approve" && waiting > 0 && (
                  <span className="relative ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tnum">{waiting}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button size="sm" className="hidden rounded-full px-4 md:inline-flex" onClick={openNewVideo}>
            <Plus /> New video
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#D2B07A] to-[#9C7A47] font-serif text-[13px] text-[#0B1F3A] outline-none focus-visible:ring-2 focus-visible:ring-ring/50" aria-label="Account">
              {profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="normal-case tracking-normal">
                <div className="text-[13px] font-medium text-foreground">{profile.name}, {profile.credentials.split(",")[0]}</div>
                <div className="text-[12px] font-normal text-muted-foreground">{profile.firm}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/settings#voice"><UserRound /> Your voice</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings"><Settings /> Settings</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />} {resolvedTheme === "dark" ? "Light mode" : "Navy mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openPalette}><Command /> Quick jump <span className="ml-auto text-[11px] text-muted-foreground">⌘K</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled><LogOut /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
