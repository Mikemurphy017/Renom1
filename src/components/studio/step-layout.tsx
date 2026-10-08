"use client";

import { cn } from "@/lib/utils";

/** The title block every step starts with. */
export function StepIntro({ title, subtitle, action, className }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        <h1 className="font-serif text-[34px] leading-tight tracking-tight text-balance sm:text-[40px]">{title}</h1>
        {subtitle && <div className="mt-2 text-[15px] text-muted-foreground">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6", className)}>{children}</section>;
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-foreground">{children}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Kept for older step code: a titled panel. */
export function StepSection({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[13px] font-medium text-muted-foreground">{title}</div>
        {action}
      </div>
      {children}
    </Panel>
  );
}
