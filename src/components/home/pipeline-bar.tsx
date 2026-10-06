"use client";

import Link from "next/link";
import { STAGES } from "@/lib/stages";
import type { Video } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Horizontal segmented bar: one segment per stage, ordinal navy ramp. */
export function PipelineBar({ videos }: { videos: Video[] }) {
  const counts = STAGES.map((s) => ({ ...s, count: videos.filter((v) => v.stage === s.id).length }));
  const total = counts.reduce((a, c) => a + c.count, 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]">
        {counts.map((c, i) =>
          c.count ? (
            <Tooltip key={c.id}>
              <TooltipTrigger asChild>
                <Link
                  href={`/board?stage=${c.id}`}
                  className="h-full transition-opacity hover:opacity-80"
                  style={{ width: `${(c.count / total) * 100}%`, background: `var(--stage-${i + 1})` }}
                  aria-label={`${c.label}: ${c.count}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {c.label} · <span className="tnum">{c.count}</span> {c.count === 1 ? "video" : "videos"}
              </TooltipContent>
            </Tooltip>
          ) : null
        )}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-y-3 sm:grid-cols-7">
        {counts.map((c, i) => (
          <Link key={c.id} href={`/board?stage=${c.id}`} className="group flex flex-col gap-1 pr-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-foreground">
              <span className="size-2 rounded-[2px]" style={{ background: `var(--stage-${i + 1})` }} />
              {c.label}
            </span>
            <span className="font-serif text-2xl leading-none tnum">{c.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
