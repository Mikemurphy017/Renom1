"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, Clapperboard, Clock, Eye, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageContainer, EmptyState } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { StepDots } from "@/components/shared/step-dots";
import { useShell } from "@/components/layout/shell-context";
import { useStore } from "@/lib/store";
import { getStage } from "@/lib/stages";
import { videoTotals } from "@/lib/selectors";
import type { Video } from "@/lib/types";
import { fmtCompact, fmtDate, fmtDateTime, relativeTime } from "@/lib/utils";

type Filter = "all" | "progress" | "drafts" | "approval" | "scheduled" | "published";

const matches: Record<Filter, (v: Video) => boolean> = {
  all: () => true,
  progress: (v) => v.status === "in_progress",
  drafts: (v) => v.status === "draft",
  approval: (v) => v.status !== "published" && (v.compliance === "submitted" || v.compliance === "changes_requested"),
  scheduled: (v) => v.status === "scheduled",
  published: (v) => v.status === "published",
};

function statusLine(v: Video) {
  if (v.status === "published") return <span className="inline-flex items-center gap-1 tnum"><Eye className="size-3.5" /> {fmtCompact(videoTotals(v).views)} · {fmtDate(v.publishedAt!)}</span>;
  if (v.status === "scheduled" && v.scheduledFor) return <span className="inline-flex items-center gap-1 tnum"><Clock className="size-3.5" /> {fmtDateTime(v.scheduledFor)}</span>;
  if (v.status === "draft") return <span className="inline-flex items-center gap-1"><Bookmark className="size-3.5" /> Draft · {v.posts?.some((p) => p.how === "buffer-draft") ? "in Buffer" : "not posted"}</span>;
  if (v.compliance === "changes_requested") return <span className="text-destructive">Changes requested</span>;
  if (v.compliance === "submitted") return <span>Waiting on approval</span>;
  return <span>{getStage(v.stage).label} · {relativeTime(v.lastEdited)}</span>;
}

export default function VideosPage() {
  const { videos, requireApproval } = useStore();
  const { openNewVideo } = useShell();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  // Deep link from "Save as draft": /videos?filter=drafts
  React.useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f && f in matches) setFilter(f as Filter);
  }, []);
  const list = videos
    .filter(matches[filter])
    .filter((v) => !q || v.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
  const count = (f: Filter) => videos.filter(matches[f]).length;

  return (
    <PageContainer className="max-w-[1200px] space-y-8 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-[40px] leading-tight tracking-tight">Videos</h1>
        <div className="relative w-full max-w-60">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 rounded-full pl-9" />
        </div>
      </div>

      <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} className="h-9 flex-wrap rounded-full">
        {([
          ["all", "All"],
          ["progress", "In progress"],
          ["drafts", "Drafts"],
          ["approval", "Approval"],
          ["scheduled", "Scheduled"],
          ["published", "Published"],
        ] as const).filter(([f]) => f !== "approval" || requireApproval || count("approval") > 0).map(([f, label]) => (
          <ToggleGroupItem key={f} value={f} className="rounded-full px-3.5">
            {label} <span className="text-[11px] text-muted-foreground tnum">{count(f)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {list.length === 0 ? (
        <EmptyState icon={Clapperboard} title="Nothing here yet" description="When you start a video it shows up here." action={<Button className="rounded-full" onClick={openNewVideo}><Plus /> New video</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((v) => (
            <Link key={v.id} href={`/studio/${v.id}/${v.stage}`} className="group rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted/70">
                <VideoThumb spec={v.thumbnail} image={v.covers?.[v.format]?.url} format={v.format} size="sm" className={v.format === "short" ? "h-[86%] w-auto" : "w-[90%]"} />
              </div>
              <div className="px-1 pt-3 pb-1">
                <div className="line-clamp-2 min-h-[2.5em] text-[14px] leading-snug font-medium">{v.title}</div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                  {statusLine(v)}
                  <StepDots stage={v.stage} done={v.status !== "in_progress"} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
