"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Kpi } from "@/components/shared/kpi";
import { VideoThumb } from "@/components/shared/video-thumb";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ViewsChart } from "@/components/charts/views-chart";
import { PlatformBars } from "@/components/charts/platform-bars";
import { useStore } from "@/lib/store";
import { DAILY_VIEWS, FOLLOWER_GROWTH } from "@/lib/mock/analytics";
import { getPlatform } from "@/lib/mock/platforms";
import { isPublished, platformTotals, videoTotals } from "@/lib/selectors";
import { cn, fmtCompact, fmtDate, fmtDuration, fmtNumber, fmtPct } from "@/lib/utils";

type SortKey = "title" | "views" | "watchTimeSec" | "engagementRate" | "followers" | "linkClicks" | "inquiries" | "date";
const METRICS = {
  views: { label: "Views", fmt: fmtCompact },
  engagementRate: { label: "Engagement", fmt: (n: number) => fmtPct(n) },
  inquiries: { label: "Inquiries", fmt: (n: number) => fmtNumber(Math.round(n)) },
  linkClicks: { label: "Link clicks", fmt: (n: number) => fmtNumber(Math.round(n)) },
} as const;

function SortHead({ k, sort, setSort, children, className }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; setSort: (s: { key: SortKey; dir: 1 | -1 }) => void; children: React.ReactNode; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button className={cn("inline-flex cursor-pointer items-center gap-1 uppercase hover:text-foreground", active && "text-foreground")} onClick={() => setSort({ key: k, dir: active ? ((-sort.dir) as 1 | -1) : -1 })}>
        {children} <Icon className="size-3" />
      </button>
    </TableHead>
  );
}

export default function PerformancePage() {
  const { videos } = useStore();
  const published = videos.filter(isPublished);
  const [range, setRange] = React.useState<"30" | "60">("30");
  const [metric, setMetric] = React.useState<keyof typeof METRICS>("views");
  const [view, setView] = React.useState<"video" | "platform">("video");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "views", dir: -1 });

  const series = DAILY_VIEWS.slice(-Number(range));
  const byPlatform = platformTotals(published);
  const totals = published.map(videoTotals);
  const views = totals.reduce((a, t) => a + t.views, 0);
  const sum = (k: "followers" | "linkClicks" | "inquiries") => totals.reduce((a, t) => a + t[k], 0);
  const weighted = (k: "watchTimeSec" | "engagementRate") => totals.reduce((a, t) => a + t[k] * t.views, 0) / Math.max(1, views);

  const rows = published
    .map((v) => ({ v, ...videoTotals(v), date: v.publishedAt ?? "" }))
    .sort((a, b) => {
      const x = sort.key === "title" ? a.v.title : a[sort.key];
      const y = sort.key === "title" ? b.v.title : b[sort.key];
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  const prow = [...byPlatform].sort((a, b) => {
    const k = sort.key === "title" || sort.key === "date" ? "views" : sort.key;
    return (a[k] - b[k]) * sort.dir;
  });

  const exportCsv = () => {
    const header = "Video,Published,Views,Avg watch (s),Engagement %,Followers,Link clicks,Inquiries";
    const lines = rows.map((r) => [`"${r.v.title}"`, r.date.slice(0, 10), r.views, Math.round(r.watchTimeSec), r.engagementRate.toFixed(1), r.followers, r.linkClicks, r.inquiries].join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "renom-performance.csv";
    a.click();
    toast.success("Exported performance CSV");
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Performance"
        title="What's working"
        description="Every published post feeds this view automatically — per video and per platform."
        actions={
          <>
            <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as "30" | "60")}>
              <ToggleGroupItem value="30">30 days</ToggleGroupItem>
              <ToggleGroupItem value="60">60 days</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download /> CSV</Button>
          </>
        }
      />

      <Card className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 xl:divide-x [&>*]:border-border max-xl:[&>*]:border-b">
        <Kpi label="Views" value={fmtCompact(views)} delta={18.4} />
        <Kpi label="Avg. watch time" value={fmtDuration(weighted("watchTimeSec"))} delta={-3.2} />
        <Kpi label="Engagement" value={fmtPct(weighted("engagementRate"))} delta={0.6} />
        <Kpi label="Follower growth" value={`+${fmtNumber(sum("followers"))}`} delta={12.1} />
        <Kpi label="Link clicks" value={fmtNumber(sum("linkClicks"))} delta={22.7} />
        <Kpi label="Inquiries" value={sum("inquiries")} delta={41.0} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader><div className="eyebrow">Views over time · all platforms</div></CardHeader>
          <CardContent><ViewsChart data={series} height={260} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader className="flex-wrap">
            <div className="eyebrow">Platform comparison</div>
            <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as keyof typeof METRICS)}>
              {(Object.keys(METRICS) as (keyof typeof METRICS)[]).map((k) => (
                <ToggleGroupItem key={k} value={k} className="px-2 text-[12px]">{METRICS[k].label}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            <PlatformBars
              data={[...byPlatform].sort((a, b) => b[metric] - a[metric]).map((p) => ({ label: getPlatform(p.platform).label, value: p[metric] }))}
              format={METRICS[metric].fmt}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="eyebrow">Detail</div>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "video" | "platform")}>
            <ToggleGroupItem value="video">By video</ToggleGroupItem>
            <ToggleGroupItem value="platform">By platform</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {view === "video" ? <SortHead k="title" sort={sort} setSort={setSort} className="pl-5">Video</SortHead> : <TableHead className="pl-5">Platform</TableHead>}
                {view === "video" ? <SortHead k="date" sort={sort} setSort={setSort}>Published</SortHead> : <TableHead>Posts</TableHead>}
                <SortHead k="views" sort={sort} setSort={setSort} className="text-right">Views</SortHead>
                <SortHead k="watchTimeSec" sort={sort} setSort={setSort} className="text-right">Avg. watch</SortHead>
                <SortHead k="engagementRate" sort={sort} setSort={setSort} className="text-right">Engagement</SortHead>
                <SortHead k="followers" sort={sort} setSort={setSort} className="text-right">Followers</SortHead>
                <SortHead k="linkClicks" sort={sort} setSort={setSort} className="text-right">Link clicks</SortHead>
                <SortHead k="inquiries" sort={sort} setSort={setSort} className="pr-5 text-right">Inquiries</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tnum">
              {view === "video"
                ? rows.map((r) => (
                    <TableRow key={r.v.id}>
                      <TableCell className="pl-5">
                        <Link href={`/studio/${r.v.id}/post`} className="flex items-center gap-3">
                          <VideoThumb spec={r.v.thumbnail} format={r.v.format} size="xs" className={r.v.format === "short" ? "w-7" : "w-12"} />
                          <div className="min-w-0">
                            <div className="max-w-[260px] truncate font-medium">{r.v.title}</div>
                            <div className="mt-0.5 flex gap-1 text-muted-foreground" style={{ ["--pi-bg" as string]: "var(--card)" }}>{r.v.platforms.map((p) => <PlatformIcon key={p} id={p} className="size-3" />)}</div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(r.date)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNumber(r.views)}</TableCell>
                      <TableCell className="text-right">{fmtDuration(r.watchTimeSec)}</TableCell>
                      <TableCell className="text-right">{fmtPct(r.engagementRate)}</TableCell>
                      <TableCell className="text-right">+{fmtNumber(r.followers)}</TableCell>
                      <TableCell className="text-right">{fmtNumber(r.linkClicks)}</TableCell>
                      <TableCell className="pr-5 text-right font-medium">{r.inquiries}</TableCell>
                    </TableRow>
                  ))
                : prow.map((p) => (
                    <TableRow key={p.platform}>
                      <TableCell className="pl-5"><span className="inline-flex items-center gap-2 font-medium" style={{ ["--pi-bg" as string]: "var(--card)" }}><PlatformIcon id={p.platform} />{getPlatform(p.platform).label}</span></TableCell>
                      <TableCell className="text-muted-foreground">{p.posts}</TableCell>
                      <TableCell className="text-right font-medium">{fmtNumber(p.views)}</TableCell>
                      <TableCell className="text-right">{fmtDuration(p.watchTimeSec)}</TableCell>
                      <TableCell className="text-right">{fmtPct(p.engagementRate)}</TableCell>
                      <TableCell className="text-right">+{fmtNumber(p.followers)}</TableCell>
                      <TableCell className="text-right">{fmtNumber(p.linkClicks)}</TableCell>
                      <TableCell className="pr-5 text-right font-medium">{p.inquiries}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="eyebrow">Audience by platform</div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FOLLOWER_GROWTH.map((f) => (
            <div key={f.platform} className="rounded-md border border-border p-4" style={{ ["--pi-bg" as string]: "var(--card)" }}>
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><PlatformIcon id={f.platform} className="size-3.5" /> {f.label}</div>
              <div className="mt-2 font-serif text-2xl tnum">{fmtNumber(f.followers)}</div>
              <div className="mt-1 text-[12px] text-success tnum">+{f.growth}% this month</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
