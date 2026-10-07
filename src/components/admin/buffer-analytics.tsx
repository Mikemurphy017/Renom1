"use client";

import * as React from "react";
import Link from "next/link";
import { ChartLine, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useBuffer, useBufferMetrics } from "@/lib/buffer/use-buffer";
import { platformForService, type BufferMetric, type BufferPost } from "@/lib/buffer/types";
import { fmtCompact, fmtDateTime, fmtPct } from "@/lib/utils";

/** The Buffer numbers worth a tile, in order; the rest go in one quiet line. */
const HEADLINE = ["views", "impressions", "reach", "engagementRate", "clicks", "postCount"];
const fmtMetric = (m: BufferMetric) => (m.unit === "percentage" ? fmtPct(m.value, 2) : fmtCompact(m.value));
const pick = (ms: BufferMetric[] | null, type: string) => ms?.find((m) => m.type === type);

function useSentPosts(days: number, enabled: boolean) {
  const [state, setState] = React.useState<{ key: number; posts: BufferPost[] | null; error: string | null } | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let live = true;
    const from = new Date(Date.now() - days * 86400000).toISOString();
    fetch(`/api/buffer/posts?status=sent&from=${encodeURIComponent(from)}&sort=dueAt&direction=desc&first=50`)
      .then((r) => r.json())
      .then((j) => live && setState({ key: days, posts: j.ok ? (j.posts as BufferPost[]) : null, error: j.ok ? null : j.error }))
      .catch((e) => live && setState({ key: days, posts: null, error: (e as Error).message }));
    return () => {
      live = false;
    };
  }, [days, enabled]);
  const cur = state?.key === days ? state : null;
  return { posts: cur?.posts ?? null, error: cur?.error ?? null, loading: enabled && !cur };
}

/** Buffer's numbers for every channel: admin only. */
export function BufferAnalytics() {
  const [range, setRange] = React.useState<"7" | "30" | "90">("30");
  const days = Number(range);
  const buffer = useBuffer();
  const metrics = useBufferMetrics(days, buffer.connected);
  const sent = useSentPosts(days, buffer.connected);
  const status = buffer.status && "channels" in buffer.status ? buffer.status : null;

  const tiles = metrics.data ? HEADLINE.map((t) => pick(metrics.data!.metrics, t)).filter((m): m is BufferMetric => !!m).slice(0, 4) : [];
  const rest = metrics.data ? metrics.data.metrics.filter((m) => !tiles.includes(m) && m.unit === "count" && m.value > 0) : [];
  const score = (p: BufferPost) => pick(p.metrics, "views")?.value ?? pick(p.metrics, "impressions")?.value ?? 0;
  const ranked = [...(sent.posts ?? [])].sort((a, b) => score(b) - score(a));

  if (buffer.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!buffer.connected) {
    return (
      <div>
        <h2 className="font-serif text-[28px] leading-tight tracking-tight">Analytics</h2>
        <EmptyState
          className="mt-10 rounded-2xl border border-dashed border-border"
          icon={ChartLine}
          title="Connect Buffer to see what’s working"
          description="Views, reach and engagement come straight from the posts Buffer publishes."
          action={<Button className="rounded-full" asChild><Link href="/admin/buffer">Buffer settings</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-[28px] leading-tight tracking-tight">Analytics</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            From Buffer · {status?.organization.name} · all channels
            {metrics.data?.metricsUpdatedAt && <> · updated {fmtDateTime(metrics.data.metricsUpdatedAt)}</>}
          </p>
        </div>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as typeof range)} className="rounded-full">
          <ToggleGroupItem value="7" className="rounded-full">7 days</ToggleGroupItem>
          <ToggleGroupItem value="30" className="rounded-full">30 days</ToggleGroupItem>
          <ToggleGroupItem value="90" className="rounded-full">90 days</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {metrics.loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}</div>
      ) : metrics.error ? (
        <p className="rounded-2xl border border-destructive/25 bg-warning-soft px-5 py-4 text-[14px] text-destructive">Couldn&rsquo;t load metrics from Buffer: {metrics.error}</p>
      ) : tiles.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-4 text-[14px] text-muted-foreground">No metrics yet for this period. Numbers appear once Buffer has published posts and the networks report back.</p>
      ) : (
        <section>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tiles.map((m) => (
              <div key={m.type} className="rounded-2xl border border-border bg-card px-5 py-4" title={m.description}>
                <div className="text-[13px] text-muted-foreground">{m.name}</div>
                <div className="mt-1 font-serif text-[34px] leading-tight tnum">{fmtMetric(m)}</div>
              </div>
            ))}
          </div>
          {rest.length > 0 && <p className="mt-3 text-[13px] text-muted-foreground tnum">{rest.map((m) => `${fmtMetric(m)} ${m.name.toLowerCase()}`).join(" · ")}</p>}
        </section>
      )}

      <section>
        <h2 className="mb-4 font-serif text-2xl">What&rsquo;s working</h2>
        {sent.loading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : sent.error ? (
          <p className="text-[14px] text-destructive">Couldn&rsquo;t load posts: {sent.error}</p>
        ) : ranked.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card px-5 py-4 text-[14px] text-muted-foreground">Nothing published in the last {days} days. When your first video goes out, it shows up here with its numbers.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {ranked.map((p) => {
              const platform = platformForService(p.channelService, "long");
              const ch = status?.channels.find((c) => c.id === p.channelId);
              const views = pick(p.metrics, "views") ?? pick(p.metrics, "impressions");
              const eng = pick(p.metrics, "engagementRate");
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3.5" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                  {platform && <PlatformIcon id={platform} className="size-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{p.text.split("\n")[0]}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {ch?.displayName ?? ch?.name} · {p.sentAt ? fmtDateTime(p.sentAt) : p.dueAt ? fmtDateTime(p.dueAt) : ""}
                      {eng && <> · {fmtMetric(eng)} engaged</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-xl leading-none tnum">{views ? fmtMetric(views) : "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{views?.name.toLowerCase() ?? "no data yet"}</div>
                  </div>
                  {p.externalLink && (
                    <a href={p.externalLink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Open post"><ExternalLink className="size-4" /></a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
