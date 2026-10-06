"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { STAGES, stageIndex } from "@/lib/stages";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 7-step horizontal stepper. Steps up to the video's furthest stage are navigable. */
export function Stepper({ videoId, current, reached, published }: { videoId: string; current: StageId; reached: StageId; published?: boolean }) {
  const ci = stageIndex(current);
  const ri = stageIndex(reached);
  return (
    <ol className="flex w-full items-center">
      {STAGES.map((s, i) => {
        const done = i < ri || (published && i <= ri);
        const isCurrent = i === ci;
        const reachable = i <= ri;
        const content = (
          <>
            <span
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium transition-colors tnum",
                isCurrent
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary/50 bg-brass-soft text-primary"
                    : "border-border bg-card text-muted-foreground"
              )}
            >
              {done && !isCurrent ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
              {isCurrent && <motion.span layoutId="step-ring" className="absolute -inset-1 rounded-full border border-primary/40" />}
            </span>
            <span
              className={cn(
                "hidden text-[13px] whitespace-nowrap md:inline",
                isCurrent ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </>
        );
        return (
          <li key={s.id} className={cn("flex items-center", i < STAGES.length - 1 && "flex-1")}>
            {reachable ? (
              <Link href={`/studio/${videoId}/${s.id}`} className="flex items-center gap-2 rounded-md py-1 pr-1 hover:opacity-80" aria-current={isCurrent ? "step" : undefined}>
                {content}
              </Link>
            ) : (
              <span className="flex cursor-not-allowed items-center gap-2 py-1 pr-1 opacity-70">{content}</span>
            )}
            {i < STAGES.length - 1 && (
              <span className={cn("mx-2 h-px min-w-3 flex-1", i < ri ? "bg-primary/50" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
