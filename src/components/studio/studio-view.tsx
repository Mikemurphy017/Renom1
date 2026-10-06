"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, FileX, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";
import { CategoryTag, ComplianceBadge, FormatBadge } from "@/components/shared/badges";
import { useStore } from "@/lib/store";
import { STAGES, stageIndex } from "@/lib/stages";
import type { StageId, Video } from "@/lib/types";
import { relativeTime } from "@/lib/utils";
import { Stepper } from "./stepper";
import { IdeaStep } from "./steps/idea-step";
import { ThumbnailStep } from "./steps/thumbnail-step";
import { ScriptStep } from "./steps/script-step";
import { DescriptionsStep } from "./steps/descriptions-step";
import { RecordStep } from "./steps/record-step";
import { EditStep } from "./steps/edit-step";
import { PostStep } from "./steps/post-step";

export interface StepProps {
  video: Video;
  /** Mark this step complete and move to the next one (or jump ahead to `target`). */
  complete: (patch?: Partial<Video>, target?: StageId) => void;
}

const STEP_COMPONENTS: Record<StageId, React.ComponentType<StepProps>> = {
  idea: IdeaStep,
  thumbnail: ThumbnailStep,
  script: ScriptStep,
  descriptions: DescriptionsStep,
  record: RecordStep,
  edit: EditStep,
  post: PostStep,
};

export function StudioView({ id, step }: { id: string; step: StageId }) {
  const router = useRouter();
  const { getVideo, updateVideo } = useStore();
  const video = getVideo(id);

  if (!video) {
    return (
      <div className="px-8 py-16">
        <EmptyState
          icon={FileX}
          title="We couldn't find that video"
          description="It may have been removed or the link is out of date."
          action={<Button asChild><Link href="/board">Back to Video Board</Link></Button>}
        />
      </div>
    );
  }

  const Step = STEP_COMPONENTS[step];
  const reached = video.stage;
  const locked = stageIndex(step) > stageIndex(reached);

  const complete = (patch?: Partial<Video>, target?: StageId) => {
    const i = stageIndex(step);
    const next = target ? STAGES[stageIndex(target)] : STAGES[i + 1];
    const newStage = next && stageIndex(next.id) > stageIndex(video.stage) ? next.id : video.stage;
    updateVideo(video.id, { ...patch, stage: newStage });
    if (next) router.push(`/studio/${video.id}/${next.id}`);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1500px] px-4 pt-4 pb-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Back to board">
              <Link href="/board"><ChevronLeft /></Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-xl leading-tight">{video.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <FormatBadge format={video.format} />
                <CategoryTag category={video.category} />
                <ComplianceBadge status={video.compliance} />
                <span className="text-[11px] text-muted-foreground">Saved {relativeTime(video.lastEdited)}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success("Progress saved", { description: `“${video.title}” is on your board.` });
                router.push("/board");
              }}
            >
              <LogOut /> Save and exit
            </Button>
          </div>
          <div className="mt-4">
            <Stepper videoId={video.id} current={step} reached={reached} published={video.status === "published"} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            {locked ? (
              <EmptyState
                title="Finish the earlier steps first"
                description={`This video is currently at the ${STAGES[stageIndex(reached)].label} step.`}
                action={<Button asChild><Link href={`/studio/${video.id}/${reached}`}>Go to {STAGES[stageIndex(reached)].label}</Link></Button>}
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
