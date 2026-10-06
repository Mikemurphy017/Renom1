"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageContainer, SectionLabel } from "@/components/shared/page";
import { Kpi } from "@/components/shared/kpi";
import { VideoThumb } from "@/components/shared/video-thumb";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ViewsChart } from "@/components/charts/views-chart";
import { PipelineBar } from "@/components/home/pipeline-bar";
import { CalendarMini, type CalendarExtra } from "@/components/home/calendar-mini";
import { useBuffer } from "@/lib/buffer/use-buffer";
import { platformForService } from "@/lib/buffer/types";
import { useStore } from "@/lib/store";
import { ADVISOR } from "@/lib/mock/advisor";
import { DAILY_VIEWS } from "@/lib/mock/analytics";
import { STAGES, stageIndex, getStage } from "@/lib/stages";
import { inPipeline, isPublished, videoTotals, withinDays } from "@/lib/selectors";
import { TODAY, fmtCompact, fmtDuration, fmtNumber, relativeTime } from "@/lib/utils";

export default function HomePage() {
  const { videos, reviews } = useStore();
  const published = videos.filter(isPublished);
  const pipeline = videos.filter(inPipeline);
  const totals = published.map(videoTotals);
  const views = totals.reduce((a, t) => a + t.views, 0);
  const watch = totals.reduce((a, t) => a + t.watchTimeSec * t.views, 0) / Math.max(1, views);
  const inquiries = totals.reduce((a, t) => a + t.inquiries, 0);
  const awaiting = reviews.filter((r) => r.status === "submitted" || r.status === "changes_requested").length;
  const upNext = [...pipeline].sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || a.lastEdited.localeCompare(b.lastEdited)).slice(0, 3);
  const top = [...published].sort((a, b) => videoTotals(b).views - videoTotals(a).views).slice(0, 4);
  const last30 = DAILY_VIEWS.slice(-30);
  const buffer = useBuffer();
  const bufferStatus = buffer.status && "channels" in buffer.status ? buffer.status : null;
  const bufferPosts: CalendarExtra[] = (bufferStatus?.upcoming ?? []).flatMap((p) => {
    const platform = platformForService(p.channelService, "long");
    if (!p.dueAt || !platform) return [];
    const ch = bufferStatus!.channels.find((c) => c.id === p.channelId);
    return [{ id: p.id, at: p.dueAt, platform, label: p.text.split("\n")[0].slice(0, 120), source: `Buffer · ${ch?.displayName ?? ch?.name ?? p.channelService}` }];
  });

  return (
    <PageContainer className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="font-serif text-[34px] leading-tight tracking-tight">Good morning, {ADVISOR.name.split(" ")[0]}.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pipeline.length} videos in progress · {upNext.filter((v) => v.stage === "post").length} ready to publish · {awaiting} awaiting compliance
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/board">
            Open Video Board <ArrowRight />
          </Link>
        </Button>
      </div>

      {/* KPI strip */}
      <Card className="grid grid-cols-2 divide-border md:grid-cols-3 xl:grid-cols-5 xl:divide-x [&>*]:border-border max-xl:[&>*]:border-b">
        <Kpi label="Published · 30 days" value={published.filter((v) => withinDays(v.publishedAt, 30)).length} delta={25} hint="vs. prior 30d" />
        <Kpi label="Total views" value={fmtCompact(views)} delta={18.4} hint="vs. prior 30d" />
        <Kpi label="Avg. watch time" value={fmtDuration(watch)} delta={-3.2} hint="per view" />
        <Kpi label="Leads from content" value={inquiries} delta={41.0} hint="inquiries" />
        <Kpi label="Awaiting compliance" value={awaiting} hint={awaiting ? "1 needs changes" : "All clear"} tone={awaiting ? "warn" : "default"} />
      </Card>

      {/* Pipeline + Up next */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <div className="eyebrow">Pipeline</div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                <span className="tnum">{pipeline.length}</span> videos across seven stages
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/board">View board <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PipelineBar videos={pipeline} />
            <div className="mt-6 border-t border-border pt-5">
              <div className="eyebrow mb-3">This week</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Scheduled to post", value: pipeline.filter((v) => v.scheduledFor && new Date(v.scheduledFor).getTime() - TODAY.getTime() < 7 * 86400000).length, href: "/library", sub: "next 7 days" },
                  { label: "Ready to record", value: pipeline.filter((v) => v.stage === "record").length, href: `/studio/${pipeline.find((v) => v.stage === "record")?.id ?? ""}/record`, sub: `${fmtDuration(pipeline.filter((v) => v.stage === "record").reduce((a, v) => a + v.runtimeSec, 0))} batch session` },
                  { label: "Needs your input", value: reviews.filter((r) => r.status === "changes_requested").length, href: "/compliance", sub: "compliance changes" },
                ].map((x) => (
                  <Link key={x.label} href={x.href} className="rounded-md border border-border px-3.5 py-3 transition-colors hover:border-primary/40">
                    <div className="text-[12px] text-muted-foreground">{x.label}</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-serif text-2xl leading-none tnum">{x.value}</span>
                      <span className="text-[11px] text-muted-foreground tnum">{x.sub}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="eyebrow">Up next</div>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-2">
            {upNext.map((v) => {
              const s = getStage(v.stage);
              const pct = ((stageIndex(v.stage) + 0.5) / STAGES.length) * 100;
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/60">
                  <VideoThumb spec={v.thumbnail} format={v.format} size="xs" className={v.format === "short" ? "w-9 shrink-0" : "w-16 shrink-0"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{v.title}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {s.label} · {relativeTime(v.lastEdited)}
                      </span>
                    </div>
                  </div>
                  <Button size="xs" variant="outline" asChild>
                    <Link href={`/studio/${v.id}/${v.stage}`}>
                      <Play className="size-3" /> Resume
                    </Link>
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Views + Top performing */}
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <div className="eyebrow">Views · last 30 days</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-serif text-3xl tnum">{fmtNumber(last30.reduce((a, d) => a + d.views, 0))}</span>
                <span className="text-xs text-muted-foreground">all platforms</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/performance">Performance <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ViewsChart data={last30} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="eyebrow">Top performing</div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <ol>
              {top.map((v, i) => {
                const t = videoTotals(v);
                return (
                  <li key={v.id} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/60">
                    <span className="w-3 font-serif text-sm text-muted-foreground tnum">{i + 1}</span>
                    <VideoThumb spec={v.thumbnail} format={v.format} size="xs" className={v.format === "short" ? "w-8" : "w-14"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{v.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                        {v.platforms.map((p) => (
                          <PlatformIcon key={p} id={p} className="size-3" />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-medium tnum">{fmtCompact(t.views)}</div>
                      <div className="text-[11px] text-muted-foreground tnum">{t.inquiries} leads</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <div>
        <SectionLabel
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> Next 14 days{bufferStatus ? ` · includes ${bufferPosts.length} Buffer posts` : ""}
            </span>
          }
        >
          This fortnight
        </SectionLabel>
        <CalendarMini videos={videos} extra={bufferPosts} />
      </div>

    </PageContainer>
  );
}
