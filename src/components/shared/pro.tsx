"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A small "Pro" tag beside a Pro feature. */
export function ProBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase", className)}>Pro</span>;
}

/** Shown in place of a Pro feature on a Starter account. */
export function ProUpsell({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-xl rounded-2xl border border-primary/30 bg-card p-7 text-center shadow-soft", className)}>
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brass-soft text-primary"><Sparkles className="size-5" /></span>
      <div className="mt-4 flex items-center justify-center gap-2 font-serif text-[24px] leading-tight">{title} <ProBadge /></div>
      <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      <Button asChild className="mt-5 rounded-full px-6"><Link href="/billing">See plans</Link></Button>
      <p className="mt-2 text-[12px] text-muted-foreground">Upgrade from your billing page anytime; your work carries over.</p>
    </div>
  );
}
