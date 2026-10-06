"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { STAGES, stageIndex } from "@/lib/stages";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Five steps. Anything you've reached is one click away. */
export function Stepper({ videoId, current, reached, published }: { videoId: string; current: StageId; reached: StageId; published?: boolean }) {
  const ci = stageIndex(current);
  const ri = stageIndex(reached);
  return (
    <ol className="flex items-center justify-center gap-1 sm:gap-2">
      {STAGES.map((s, i) => {
        const done = i < ri || (published && i <= ri);
        const isCurrent = i === ci;
        const reachable = i <= ri;
        const pill = (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors",
              isCurrent ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : done ? "text-foreground hover:bg-card" : "text-muted-foreground"
            )}
          >
            {done && !isCurrent ? <Check className="size-3.5 text-primary" strokeWidth={2.5} /> : <span className="text-[11px] opacity-60 tnum">{i + 1}</span>}
            <span className={cn(!isCurrent && "hidden sm:inline")}>{s.label}</span>
          </span>
        );
        return (
          <li key={s.id} className="flex items-center gap-1 sm:gap-2">
            {reachable ? (
              <Link href={`/studio/${videoId}/${s.id}`} aria-current={isCurrent ? "step" : undefined}>{pill}</Link>
            ) : (
              <span className="cursor-default opacity-60">{pill}</span>
            )}
            {i < STAGES.length - 1 && <span className={cn("h-px w-3 sm:w-6", i < ri ? "bg-primary/60" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}
