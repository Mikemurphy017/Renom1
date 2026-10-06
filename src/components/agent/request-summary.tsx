import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compact card echoing exactly what was sent to the agent. */
export function RequestSummary({ summary, className }: { summary: Record<string, string>; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/60 px-3 py-2.5", className)}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        <Sparkles className="size-3 text-primary" /> Request
      </div>
      <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-[12px] leading-snug">
        {Object.entries(summary).map(([k, v], i, all) => (
          <span key={k} className="inline-flex items-baseline gap-1">
            <span className="text-muted-foreground">{k}:</span>
            <span className="font-medium text-foreground">{v}</span>
            {i < all.length - 1 && <span className="text-muted-foreground/60">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
