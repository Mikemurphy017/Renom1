import { CircleCheck, Smartphone, Monitor, CircleDot, TriangleAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Category, ComplianceStatus, VideoFormat } from "@/lib/types";
import { COMPLIANCE_STATUS_META } from "@/lib/mock/compliance";
import { cn } from "@/lib/utils";

export function FormatBadge({ format, className }: { format: VideoFormat; className?: string }) {
  return (
    <Badge variant="outline" className={cn("tnum", className)}>
      {format === "short" ? <Smartphone /> : <Monitor />}
      {format === "short" ? "Short-form 9:16" : "Long-form 16:9"}
    </Badge>
  );
}

const CAT_DOT: Record<Category, string> = {
  "Tax Planning": "#B08D57",
  Retirement: "#2E7D5B",
  "Equity Comp": "#3D5A80",
  "Estate Planning": "#7A5C7E",
  "Market Commentary": "#8B2E2E",
  "Charitable Giving": "#6B8E7F",
  "Wealth Strategy": "#0B1F3A",
};

export function CategoryTag({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground", className)}>
      <span className="size-1.5 rounded-full dark:brightness-150" style={{ background: CAT_DOT[category] }} />
      {category}
    </span>
  );
}

const C_ICON: Record<ComplianceStatus, React.ElementType> = {
  draft: CircleDot,
  submitted: Clock,
  changes_requested: TriangleAlert,
  approved: CircleCheck,
};

export function ComplianceBadge({ status, className }: { status: ComplianceStatus; className?: string }) {
  const m = COMPLIANCE_STATUS_META[status];
  const Icon = C_ICON[status];
  return (
    <Badge variant={m.variant} className={className}>
      <Icon />
      {m.label}
    </Badge>
  );
}

export function ReadyPill({ ok = true, label }: { ok?: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        ok ? "bg-success-soft text-success" : "bg-warning-soft text-destructive"
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-success" : "bg-destructive")} />
      {label ?? (ok ? "Ready" : "Needs attention")}
    </span>
  );
}
