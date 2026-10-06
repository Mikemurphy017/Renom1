"use client";

import Link from "next/link";
import type { Video } from "@/lib/types";
import { TODAY, cn } from "@/lib/utils";
import { PlatformTile } from "@/components/shared/platform-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CalendarMini({ videos, days = 14 }: { videos: Video[]; days?: number }) {
  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + i);
    const key = d.toDateString();
    return { d, items: videos.filter((v) => v.scheduledFor && new Date(v.scheduledFor).toDateString() === key) };
  });
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border">
      {cells.map(({ d, items }, i) => (
        <div key={i} className={cn("min-h-[92px] bg-card p-2", i === 0 && "bg-brass-soft/40")}>
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <span className={cn("text-[13px] tnum", i === 0 ? "font-semibold text-primary" : "text-foreground")}>{d.getDate()}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {items.map((v) => (
              <Tooltip key={v.id}>
                <TooltipTrigger asChild>
                  <Link href={`/studio/${v.id}/${v.stage}`} className="block rounded-[5px] border border-border bg-background/70 p-1 hover:border-primary/50">
                    <div className="flex flex-wrap gap-0.5">
                      {v.platforms.slice(0, 4).map((p) => (
                        <PlatformTile key={p} id={p} className="size-5 border-0 bg-transparent" />
                      ))}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground tnum">
                      {new Date(v.scheduledFor!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">{v.title}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
