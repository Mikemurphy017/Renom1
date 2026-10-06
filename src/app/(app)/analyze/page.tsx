"use client";

import * as React from "react";
import Link from "next/link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageContainer } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ViewsChart } from "@/components/charts/views-chart";
import { PlatformBars } from "@/components/charts/platform-bars";
import { useStore } from "@/lib/store";
import { DAILY_VIEWS } from "@/lib/mock/analytics";
import { getPlatform } from "@/lib/mock/platforms";
import { isPublished, platformTotals, videoTotals } from "@/lib/selectors";
import { fmtCompact, fmtDate, fmtDateTime, fmtDuration, fmtNumber, fmtPct } from "@/lib/utils";
import { useBuffer, useBufferMetrics } from "@/lib/buffer/use-buffer";
import type { BufferMetric } from "@/lib/buffer/types";
import { Skeleton } from "@/components/ui/skeleton";

/** The Buffer numbers worth a tile, in order; the rest go in one quiet line. */
const HEADLINE = ["impressions", "views", "reach", "engagementRate", "postCount"];
const fmtMetric = (m: BufferMetric) => (m.unit === "percentage" ? fmtPct(m.value, 2) : fmtCompact(m.value));

export default function AnalyzePage() {
  const { videos } = useStore();
  const [range, setRange] = React.useState<"30" | "60">("30");
  const buffer = useBuffer();
  const live = useBufferMetrics(Number(range), buffer.connected);
  const liveTiles = live.data ? HEADLINE.map((t) => live.data!.metrics.find((m) => m.type === t)).filter((m): m is BufferMetric => !!m).slice(0, 4) : [];
  const liveRest = live.data ? live.data.metrics.filter((m) => !liveTiles.includes(m) && m.unit === "count") : [];
  const showLive = liveTiles.length > 0;
  const published = videos.filter(isPublished);
  const totals = published.map(videoTotals);
  const views = totals.reduce((a, t) => a + t.views, 0);
  const weighted = (k: "watchTimeSec" | "engagementRate") => totals.reduce((a, t) => a + t[k] * t.views, 0) / Math.max(1, views);
  const leads = totals.reduce((a, t) => a + t.inquiries, 0);
  const series = DAILY_VIEWS.slice(-Number(range));
  const byPlatform = platformTotals(published).sort((a, b) => b.views - a.views);
  const best = byPlatform.reduce((a, b) => (b.inquiries / Math.max(1, b.views) > a.inquiries / Math.max(1, a.views) ? b : a), byPlatform[0]);
  const ranked = published
    .map((v) => {
      const t = videoTotals(v);
      const top = [...(v.metrics ?? [])].sort((a, b) => b.inquiries - a.inquiries)[0];
      return { v, t, top };
    })
    .sort((a, b) => b.t.inquiries - a.t.inquiries || b.t.views - a.t.views);

  return (
    <PageContainer className="max-w-[1080px] space-y-12 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[40px] leading-tight tracking-tight">Analyze</h1>
          {best && (
            <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
              {getPlatform(best.platform).label} turns viewers into conversations best: one inquiry for every {fmtNumber(Math.round(best.views / Math.max(1, best.inquiries)))} views. <span className="text-[12px] opacity-70">(Sample data)</span>
            </p>
          )}
        </div>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as "30" | "60")} className="rounded-full">
          <ToggleGroupItem value="30" className="rounded-full">30 days</ToggleGroupItem>
          <ToggleGroupItem value="60" className="rounded-full">60 days</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {live.loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-border bg-card px-5 py-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))
            : (showLive
                ? liveTiles.map((m) => [m.name, fmtMetric(m), m.description] as const)
                : ([
                    ["Views", fmtCompact(views), undefined],
                    ["Avg. watch time", fmtDuration(weighted("watchTimeSec")), undefined],
                    ["Engagement", fmtPct(weighted("engagementRate")), undefined],
                    ["Leads", String(leads), undefined],
                  ] as const)
              ).map(([label, value, hint]) => (
                <div key={label} className="rounded-2xl border border-border bg-card px-5 py-4" title={hint}>
                  <div className="text-[13px] text-muted-foreground">{label}</div>
                  <div className="mt-1 font-serif text-[34px] leading-tight tnum">{value}</div>
                </div>
              ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground" data-testid="metrics-source">
          {showLive ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><span className="size-1.5 rounded-full bg-success" /> From Buffer</span>
              <span>· {live.data!.organization.name} · all channels · {fmtDate(live.data!.range.start)} – {fmtDate(live.data!.range.end)}</span>
              {liveRest.length > 0 && <span className="tnum">· {liveRest.map((m) => `${m.name} ${fmtMetric(m)}`).join(" · ")}</span>}
              {live.data!.metricsUpdatedAt && <span>· updated {fmtDateTime(live.data!.metricsUpdatedAt)}</span>}
            </>
          ) : live.loading ? (
            <span>Loading Buffer numbers…</span>
          ) : (
            <span>
              Sample data
              {live.error
                ? ` · Buffer numbers unavailable: ${live.error}`
                : buffer.connected
                  ? " · Buffer has no published posts in this range"
                  : buffer.status && "error" in buffer.status
                    ? " · couldn’t reach Buffer"
                    : " · connect Buffer in Settings for real numbers"}
            </span>
          )}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex justify-between text-[13px] text-muted-foreground">Views across every platform <span className="text-[12px]">Sample data</span></div>
        <ViewsChart data={series} height={260} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-4 flex items-baseline justify-between font-serif text-2xl">What&rsquo;s working <span className="font-sans text-[12px] text-muted-foreground">Sample data</span></h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {ranked.map(({ v, t, top }) => (
              <li key={v.id}>
                <Link href={`/studio/${v.id}/post`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/50">
                  <VideoThumb spec={v.thumbnail} format={v.format} size="xs" className={v.format === "short" ? "w-9 shrink-0" : "w-16 shrink-0"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{v.title}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground tnum">
                      {fmtCompact(t.views)} views · {fmtDuration(t.watchTimeSec)} avg watch{top && top.inquiries > 0 ? ` · best on ${getPlatform(top.platform).label}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-xl leading-none tnum">{t.inquiries}</div>
                    <div className="text-[11px] text-muted-foreground">leads</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-4 flex items-baseline justify-between font-serif text-2xl">Where <span className="font-sans text-[12px] text-muted-foreground">Sample data</span></h2>
          <div className="rounded-2xl border border-border bg-card p-5">
            <PlatformBars data={byPlatform.map((p) => ({ label: getPlatform(p.platform).label, value: p.views }))} format={fmtCompact} height={220} />
            <ul className="mt-4 space-y-2 border-t border-border pt-4 text-[13px]" style={{ ["--pi-bg" as string]: "var(--card)" }}>
              {byPlatform.map((p) => (
                <li key={p.platform} className="flex items-center gap-2">
                  <PlatformIcon id={p.platform} className="size-3.5 text-muted-foreground" />
                  <span className="flex-1">{getPlatform(p.platform).label}</span>
                  <span className="text-muted-foreground tnum">{fmtPct(p.engagementRate)} engaged · {p.inquiries} leads</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
