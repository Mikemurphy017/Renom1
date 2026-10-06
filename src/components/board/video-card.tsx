"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import type { Video } from "@/lib/types";
import { VideoThumb } from "@/components/shared/video-thumb";
import { CategoryTag, FormatBadge } from "@/components/shared/badges";
import { relativeTime, cn } from "@/lib/utils";

export function VideoCard({ video, highlight }: { video: Video; highlight?: boolean }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Link
        href={`/studio/${video.id}/${video.stage}`}
        className={cn(
          "group block rounded-lg border border-border bg-card p-2.5 shadow-soft transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md",
          highlight && "ring-2 ring-primary/40"
        )}
      >
        <div className={cn("overflow-hidden rounded-md bg-muted", video.format === "short" ? "flex justify-center bg-muted/70 py-2" : "")}>
          <VideoThumb spec={video.thumbnail} format={video.format} size="sm" className={video.format === "short" ? "w-[42%]" : "w-full"} />
        </div>
        <div className="px-0.5 pt-2.5">
          <h4 className="line-clamp-2 text-[13px] leading-snug font-medium">{video.title}</h4>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FormatBadge format={video.format} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <CategoryTag category={video.category} />
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] whitespace-nowrap text-muted-foreground">
              <Clock className="size-3" />
              {relativeTime(video.lastEdited)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
