"use client";

import { ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvisorChannels, useBuffer } from "@/lib/buffer/use-buffer";
import { ADVISOR, TEAM } from "@/lib/mock/advisor";
import { fmtDateTime } from "@/lib/utils";
import { ChannelAvatar, channelLabel } from "./channel-avatar";
import { getPlatform } from "@/lib/mock/platforms";
import { platformForService, type BufferChannel } from "@/lib/buffer/types";

const serviceLabel = (c: BufferChannel) => {
  const p = platformForService(c.service, "long");
  return `${p ? getPlatform(p).label : c.service} ${c.type}`;
};

function BufferMark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-md bg-navy text-navy-foreground dark:bg-secondary">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
        <path d="M12 2 2 7l10 5 10-5zM4.6 10.8 2 12l10 5 10-5-2.6-1.2L12 14.4zm0 5L2 17l10 5 10-5-2.6-1.2L12 19.4z" />
      </svg>
    </span>
  );
}

export function BufferCard() {
  const { status, connected, loading, refresh } = useBuffer();
  const [mine, setMine] = useAdvisorChannels(TEAM[0].id);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <BufferMark />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            Buffer
            {connected && <span className="inline-flex items-center gap-1 text-[11px] font-normal text-success"><span className="size-1.5 rounded-full bg-success" /> Connected</span>}
          </div>
          <p className="text-[12px] text-muted-foreground">Renom schedules and publishes through your Buffer account. Social accounts are connected in Buffer.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refresh().then(() => toast.success("Buffer refreshed"))}><RefreshCw /> Refresh</Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://publish.buffer.com/channels" target="_blank" rel="noreferrer">Manage in Buffer <ExternalLink /></a>
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : !status?.configured ? (
          <div className="rounded-md border border-border bg-muted/50 p-4 text-[13px]">
            <div className="font-medium">Buffer isn&rsquo;t connected yet</div>
            <p className="mt-1 text-muted-foreground">
              Create an API key at publish.buffer.com/settings/api and add it to <code className="font-mono text-[12px]">.env.local</code> as <code className="font-mono text-[12px]">BUFFER_API_KEY</code>, then restart the app. Until then, publishing in the Post step is simulated.
            </p>
          </div>
        ) : "error" in status ? (
          <div className="flex gap-3 rounded-md border border-destructive/25 bg-warning-soft p-4 text-[13px]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <div className="font-medium text-destructive">Couldn&rsquo;t reach Buffer</div>
              <p className="mt-1 text-muted-foreground">{status.error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{status.organization.name}</span> · {status.account.email}
              </span>
              <span className="tnum">
                {status.organization.channelCount} of {status.organization.channelLimit} channels · {status.upcoming.length} {status.upcoming.length === 1 ? "post" : "posts"} scheduled
              </span>
            </div>
            <div className="eyebrow mb-2">Posts as {ADVISOR.name}</div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {status.channels.map((c) => {
                const next = status.upcoming.find((p) => p.channelId === c.id && p.dueAt);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                      <Checkbox
                        checked={mine.includes(c.id)}
                        onCheckedChange={(v) => setMine(v ? [...mine, c.id] : mine.filter((x) => x !== c.id))}
                        aria-label={`Post as ${channelLabel(c)}`}
                      />
                      <ChannelAvatar channel={c} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{channelLabel(c)}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {serviceLabel(c)} · {c.timezone}
                          {next?.dueAt && <> · next post {fmtDateTime(next.dueAt)}</>}
                        </div>
                      </div>
                      {c.isDisconnected ? (
                        <span className="text-[11px] font-medium text-destructive">Reconnect in Buffer</span>
                      ) : c.isQueuePaused ? (
                        <span className="text-[11px] text-muted-foreground">Queue paused</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success"><span className="size-1.5 rounded-full bg-success" /> Ready</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Checked channels are pre-selected when this advisor publishes. Your plan allows {status.organization.channelLimit} channels; to add YouTube, Instagram or others, connect them in Buffer (an upgrade may be needed).
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
