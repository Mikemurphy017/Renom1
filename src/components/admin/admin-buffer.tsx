"use client";

import * as React from "react";
import { Check, ExternalLink, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/shared/page";
import { ChannelAvatar, channelLabel } from "@/components/buffer/channel-avatar";
import { BufferPostMenu } from "@/components/buffer/post-menu";
import { useBuffer } from "@/lib/buffer/use-buffer";
import { platformForService, type BufferChannel } from "@/lib/buffer/types";
import { getPlatform } from "@/lib/mock/platforms";
import { cn, fmtDateTime } from "@/lib/utils";

type Advisor = { id: string; name: string; email: string };

const serviceLabel = (c: BufferChannel) => {
  const p = platformForService(c.service, "long");
  return p ? getPlatform(p).label : c.service;
};

/** Buffer is the team's tool: the connection, what's coming up, and which channels post for which advisor. */
export function AdminBuffer() {
  const { status, loading, refresh } = useBuffer();
  const [advisors, setAdvisors] = React.useState<Advisor[] | null>(null);
  const [map, setMap] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/posting", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) throw new Error(j.error);
        setAdvisors(j.users.filter((u: Advisor) => u.email));
        setMap(j.channels ?? {});
      })
      .catch((e) => toast.error("Couldn’t load advisors", { description: (e as Error).message }));
  }, []);

  const channels = status && "channels" in status ? status.channels : [];

  const toggle = async (advisor: Advisor, channelId: string) => {
    const cur = map[advisor.id] ?? [];
    const next = cur.includes(channelId) ? cur.filter((x) => x !== channelId) : [...cur, channelId];
    setMap((m) => ({ ...m, [advisor.id]: next }));
    setSaving(advisor.id);
    try {
      const res = await fetch("/api/admin/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: advisor.id, channelIds: next }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
    } catch (e) {
      setMap((m) => ({ ...m, [advisor.id]: cur }));
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] leading-tight tracking-tight">Buffer</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Only admins see Buffer. Advisors send videos to the posting queue; you post them from there to the channels assigned below.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => refresh().then(() => toast.success("Buffer refreshed"))}><RefreshCw /> Refresh</Button>
          <Button variant="outline" size="sm" className="rounded-full" asChild><a href="https://publish.buffer.com" target="_blank" rel="noreferrer">Open Buffer <ExternalLink /></a></Button>
        </div>
      </div>

      {loading ? (
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      ) : !status?.configured ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-[14px]">
          <div className="font-medium">Buffer isn’t connected</div>
          <p className="mt-1 text-muted-foreground">Create a personal API key at publish.buffer.com/settings/api and set <code className="font-mono text-[12px]">BUFFER_API_KEY</code> on the server.</p>
        </div>
      ) : "error" in status ? (
        <div className="flex gap-3 rounded-2xl border border-destructive/25 bg-warning-soft p-5 text-[14px]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div><div className="font-medium text-destructive">Couldn’t reach Buffer</div><p className="mt-1 text-muted-foreground">{status.error}</p></div>
        </div>
      ) : (
        <>
          <section>
            <SectionLabel>{status.organization.name} · {status.organization.channelCount} of {status.organization.channelLimit} channels</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {channels.map((c) => (
                <div key={c.id} className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3", (c.isDisconnected || c.isLocked) && "opacity-60")}>
                  <ChannelAvatar channel={c} />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{channelLabel(c)}</div>
                    <div className="text-[12px] text-muted-foreground">{serviceLabel(c)}{c.isDisconnected ? " · reconnect in Buffer" : c.isLocked ? " · locked" : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionLabel>Who posts where</SectionLabel>
            <p className="-mt-1 mb-4 text-[13px] text-muted-foreground">Pick each advisor’s channels. They’re preselected when you post that advisor’s videos, and the advisor sees their names (only theirs) in Settings.</p>
            {advisors === null ? (
              <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {advisors.map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      {a.name} <span className="font-normal text-muted-foreground">{a.email}</span>
                      {saving === a.id && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {channels.map((c) => {
                        const on = (map[a.id] ?? []).includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => void toggle(a, c.id)}
                            className={cn("flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-[12px] transition-colors", on ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}
                          >
                            <ChannelAvatar channel={c} className="size-6" />
                            {channelLabel(c)}
                            {on && <Check className="size-3.5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Coming up in Buffer</SectionLabel>
            {status.upcoming.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card px-5 py-4 text-[14px] text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {status.upcoming.map((p) => {
                  const c = channels.find((x) => x.id === p.channelId);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      {c && <ChannelAvatar channel={c} className="size-8" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px]">{p.text.split("\n")[0]}</div>
                        <div className="text-[12px] text-muted-foreground">{c ? channelLabel(c) : "Channel"} · {p.dueAt ? fmtDateTime(p.dueAt) : "in queue"}</div>
                      </div>
                      <BufferPostMenu post={p} title={p.text.split("\n")[0]} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
