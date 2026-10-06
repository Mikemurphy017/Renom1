"use client";

import * as React from "react";
import Link from "next/link";
import { Library, Search, Clock, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageContainer, PageHeader, EmptyState } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { CategoryTag, FormatBadge } from "@/components/shared/badges";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import { videoTotals } from "@/lib/selectors";
import { fmtCompact, fmtDate, fmtDateTime, fmtDuration } from "@/lib/utils";

export default function LibraryPage() {
  const { videos } = useStore();
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<"published" | "scheduled" | "all">("published");
  const list = videos
    .filter((v) => (tab === "all" ? true : tab === "published" ? v.status === "published" : v.status === "scheduled"))
    .filter((v) => !q || v.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.publishedAt ?? b.scheduledFor ?? b.lastEdited).localeCompare(a.publishedAt ?? a.scheduledFor ?? a.lastEdited));

  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Library" title="Your video library" description="Every finished and scheduled video, with its final cut, thumbnail and captions." />
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={tab} onValueChange={(v) => v && setTab(v as typeof tab)}>
          <ToggleGroupItem value="published">Published</ToggleGroupItem>
          <ToggleGroupItem value="scheduled">Scheduled</ToggleGroupItem>
          <ToggleGroupItem value="all">All videos</ToggleGroupItem>
        </ToggleGroup>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library" className="h-8 pl-9 text-[13px]" />
        </div>
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon={Library} title="Nothing here yet" description="Finished videos land here after you publish or schedule them." action={<Button asChild><Link href="/board">Open Video Board</Link></Button>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((v) => {
            const t = videoTotals(v);
            return (
              <Link key={v.id} href={`/studio/${v.id}/${v.stage}`} className="group overflow-hidden rounded-lg border border-border bg-card shadow-soft transition-all hover:-translate-y-px hover:border-primary/40">
                <div className="flex aspect-video items-center justify-center bg-muted/60">
                  <VideoThumb spec={v.thumbnail} format={v.format} size="sm" className={v.format === "short" ? "h-[88%] w-auto" : "h-full w-full rounded-none"} />
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-2 text-[14px] font-medium leading-snug">{v.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><FormatBadge format={v.format} /><CategoryTag category={v.category} /></div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
                    <span className="flex items-center gap-1.5" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                      {v.platforms.map((p) => <PlatformIcon key={p} id={p} className="size-3.5" />)}
                    </span>
                    {v.status === "published" ? (
                      <span className="flex items-center gap-3 tnum">
                        <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{fmtCompact(t.views)}</span>
                        <span>{fmtDate(v.publishedAt!)}</span>
                      </span>
                    ) : v.scheduledFor ? (
                      <span className="inline-flex items-center gap-1 tnum"><Clock className="size-3.5" />{fmtDateTime(v.scheduledFor)}</span>
                    ) : (
                      <span className="tnum">{fmtDuration(v.runtimeSec)}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
