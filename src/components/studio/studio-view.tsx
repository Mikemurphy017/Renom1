"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, FileX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";
import { useStore } from "@/lib/store";
import { STAGES, stageIndex } from "@/lib/stages";
import type { StageId, Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Stepper } from "./stepper";
import { IdeaStep } from "./steps/idea-step";
import { ScriptStep } from "./steps/script-step";
import { RecordStep } from "./steps/record-step";
import { EditStep } from "./steps/edit-step";
import { PostStep } from "./steps/post-step";
import { ReviewStep } from "./steps/review-step";

export interface StepProps {
  video: Video;
  /** Mark this step complete and move to the next one (or jump ahead to `target`). */
  complete: (patch?: Partial<Video>, target?: StageId) => void;
}

const STEP_COMPONENTS: Record<StageId, React.ComponentType<StepProps>> = {
  idea: IdeaStep,
  script: ScriptStep,
  record: RecordStep,
  edit: EditStep,
  review: ReviewStep,
  post: PostStep,
};

const WIDE: StageId[] = ["record", "edit", "review", "post"];

export function StudioView({ id, step }: { id: string; step: StageId }) {
  const router = useRouter();
  const { getVideo, updateVideo } = useStore();
  const video = getVideo(id);

  if (!video) {
    return (
      <div className="px-8 py-16">
        <EmptyState icon={FileX} title="We couldn’t find that video" description="It may have been removed or the link is out of date." action={<Button asChild><Link href="/videos">Back to videos</Link></Button>} />
      </div>
    );
  }

  const Step = STEP_COMPONENTS[step];
  const locked = stageIndex(step) > stageIndex(video.stage);

  const complete = (patch?: Partial<Video>, target?: StageId) => {
    const next = target ? STAGES[stageIndex(target)] : STAGES[stageIndex(step) + 1];
    const newStage = next && stageIndex(next.id) > stageIndex(video.stage) ? next.id : video.stage;
    updateVideo(video.id, { ...patch, stage: newStage });
    if (next) router.push(`/studio/${video.id}/${next.id}`);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:top-16 md:pt-0">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-8 md:grid-cols-[1fr_auto_1fr] md:py-2.5">
          <Link href="/videos" className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-5 shrink-0 md:size-4" />
            <span className="truncate">{video.title}</span>
          </Link>
          <div className="order-last col-span-2 -mx-3 overflow-x-auto px-3 [scrollbar-width:none] md:order-none md:col-span-1 md:mx-0 md:overflow-visible md:px-0">
            <Stepper videoId={video.id} current={step} reached={video.stage} published={video.status === "published"} />
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => {
                toast.success("Saved", { description: "Pick up anytime from Home." });
                router.push("/");
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("mx-auto px-4 py-6 sm:px-8 md:py-10", WIDE.includes(step) ? "max-w-[1200px]" : "max-w-[760px]")}>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {locked ? (
              <EmptyState
                title="Finish the earlier steps first"
                description={`This video is at the ${STAGES[stageIndex(video.stage)].label} step.`}
                action={<Button className="rounded-full" asChild><Link href={`/studio/${video.id}/${video.stage}`}>Go to {STAGES[stageIndex(video.stage)].label}</Link></Button>}
              />
            ) : (
              <Step video={video} complete={complete} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
