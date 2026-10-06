import { STAGES, stageIndex } from "@/lib/stages";
import type { StageId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Five small dots showing where a video is. */
export function StepDots({ stage, done, className }: { stage: StageId; done?: boolean; className?: string }) {
  const i = stageIndex(stage);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={done ? "Published" : `Step ${i + 1} of ${STAGES.length}: ${STAGES[i].label}`}>
      {STAGES.map((s, j) => (
        <span key={s.id} className={cn("h-1.5 rounded-full transition-all", done || j < i ? "w-1.5 bg-primary" : j === i ? "w-4 bg-primary" : "w-1.5 bg-border")} />
      ))}
    </span>
  );
}
