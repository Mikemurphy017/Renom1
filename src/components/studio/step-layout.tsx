"use client";

import { cn } from "@/lib/utils";

/** Center workspace + right agent panel. */
export function StepLayout({ children, panel, className }: { children: React.ReactNode; panel?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-6", panel && "xl:grid-cols-[minmax(0,1fr)_380px]", className)}>
      <div className="min-w-0 space-y-6">{children}</div>
      {panel && <div className="h-[560px] xl:sticky xl:top-[200px] xl:h-[calc(100vh-230px)] [&>*]:h-full">{panel}</div>}
    </div>
  );
}

export function StepSection({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5 shadow-soft", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="eyebrow">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-foreground">{children}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
