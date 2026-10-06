import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  delta,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number;
  hint?: string;
  tone?: "default" | "warn";
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className={cn("flex flex-col gap-2 px-5 py-4", className)}>
      <div className="eyebrow">{label}</div>
      <div className={cn("font-serif text-[32px] leading-none tracking-tight tnum", tone === "warn" && "text-destructive")}>{value}</div>
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {delta !== undefined && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tnum", up ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
