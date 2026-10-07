"use client";

import * as React from "react";
import { CheckCheck, ChevronDown, CircleCheck, Download, ImageDown, LoaderCircle, RefreshCw, Send, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ChannelAvatar, channelLabel } from "@/components/buffer/channel-avatar";
import { CopyButton } from "@/components/studio/steps/share-kit";
import { createBufferPost, useBuffer } from "@/lib/buffer/use-buffer";
import { platformForService, type BufferChannel, type BufferMode } from "@/lib/buffer/types";
import { getPlatform } from "@/lib/mock/platforms";
import type { PostRequest, PostRequestBufferPost, PostRequestStatus } from "@/lib/posting/types";
import { cn, fmtDateTime, fmtDuration, relativeTime } from "@/lib/utils";

type Data = { requests: PostRequest[]; channels: Record<string, string[]> };

const TABS: { id: string; label: string; match: PostRequestStatus[] }[] = [
  { id: "todo", label: "To post", match: ["submitted"] },
  { id: "buffer", label: "Drafts in Buffer", match: ["in_buffer"] },
  { id: "scheduled", label: "Scheduled", match: ["scheduled"] },
  { id: "posted", label: "Posted", match: ["posted"] },
  { id: "returned", label: "Sent back", match: ["returned"] },
];

async function act(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/posting/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || "That didn’t work.");
}

/** Every advisor's "please post this" requests, and the tools to post them through Buffer. */
export function PostingQueue() {
  const [data, setData] = React.useState<Data | null>(null);
  const [tab, setTab] = React.useState("todo");
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetch("/api/admin/posting", { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) throw new Error(j.error);
      setData({ requests: j.requests, channels: j.channels });
    } catch (e) {
      toast.error("Couldn’t load the queue", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => void load(), [load]);

  const current = TABS.find((t) => t.id === tab)!;
  const shown = (data?.requests ?? [])
    .filter((r) => current.match.includes(r.status))
    .sort((a, b) => (tab === "todo" ? a.submittedAt.localeCompare(b.submittedAt) : b.updatedAt.localeCompare(a.updatedAt)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] leading-tight tracking-tight">Posting queue</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Videos advisors have asked the team to post. Send each to Buffer, or mark it posted if you published it another way. Advisors see the status, never Buffer.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()} disabled={loading}><RefreshCw className={cn(loading && "animate-spin")} /> Refresh</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = data?.requests.filter((r) => t.match.includes(r.status)).length ?? 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px]", tab === t.id ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}>
              {t.label} <span className="ml-1 tnum opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {!data ? (
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-[14px] text-muted-foreground">{tab === "todo" ? "Nothing waiting. New requests from advisors show up here." : "Nothing here."}</p>
      ) : (
        <div className="space-y-4">
          {shown.map((r) => <RequestCard key={`${r.id}-${r.updatedAt}`} r={r} assigned={data.channels[r.userId] ?? []} defaultOpen={tab === "todo"} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}

function RequestCard({ r, assigned, defaultOpen, onChanged }: { r: PostRequest; assigned: string[]; defaultOpen: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mode, setMode] = React.useState<"none" | "return" | "scheduled">("none");
  const [note, setNote] = React.useState("");
  const [when, setWhen] = React.useState(r.timing.at ? toLocal(r.timing.at) : toLocal(new Date(Date.now() + 86400000).toISOString()));
  const [busy, setBusy] = React.useState(false);
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "video";

  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      await act(r.id, body);
      toast.success(done);
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-4 p-4 text-left hover:bg-muted/40 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-muted-foreground">{r.advisorName} · {r.advisorEmail}</div>
          <div className="mt-0.5 truncate text-[16px] font-medium">{r.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>Sent {relativeTime(r.submittedAt)}</span>
            <span className={cn(r.timing.kind === "at" && "font-medium text-foreground")}>{r.timing.kind === "at" ? `Wants it ${fmtDateTime(r.timing.at!)}` : "As soon as possible"}</span>
            {r.scheduledFor && r.status === "scheduled" && <span>Scheduled {fmtDateTime(r.scheduledFor)}</span>}
            {r.postedAt && r.status === "posted" && <span>Posted {fmtDateTime(r.postedAt)}</span>}
          </div>
        </div>
        <div className="hidden gap-1.5 text-muted-foreground sm:flex" style={{ ["--pi-bg" as string]: "var(--card)" }}>
          {r.platforms.map((p) => <PlatformIcon key={p} id={p} className="size-4" />)}
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-6 border-t border-border p-4 sm:p-5">
          {r.tagline && (
            <div className="flex items-center gap-3 rounded-xl border border-border p-3.5">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Tagline</span>
              <span className="min-w-0 flex-1 font-serif text-[15px]">{r.tagline}</span>
              <CopyButton text={r.tagline} label="Tagline" className="size-7" />
            </div>
          )}
          {r.note && <div className="rounded-xl bg-brass-soft/60 p-3.5 text-[14px]"><span className="font-medium">Note from {r.advisorName.split(" ")[0] || "the advisor"}:</span> {r.note}</div>}
          {r.teamNote && <div className="rounded-xl bg-muted p-3.5 text-[14px]"><span className="font-medium">Team note:</span> {r.teamNote}</div>}

          <div className="grid gap-5 md:grid-cols-[auto_1fr]">
            <div className="flex justify-center rounded-xl bg-[#06101F] p-2">
              <video src={r.output.url} controls playsInline preload="metadata" className={cn("rounded-md bg-black", r.output.aspect === "9:16" ? "h-64 w-auto" : "h-44 w-auto")} />
            </div>
            <div className="space-y-3">
              <div className="text-[13px] text-muted-foreground tnum">MP4 · {r.output.aspect} · {fmtDuration(r.output.durationSec)} · disclosure {r.disclosureVersion}</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full"><a href={`${r.output.url}?download=${encodeURIComponent(slug)}`} download><Download /> MP4</a></Button>
                {r.covers.map((c) => (
                  <Button key={c.shape} asChild size="sm" variant="outline" className="rounded-full"><a href={c.url} download={`${slug}-cover-${c.shape === "short" ? "9x16" : "16x9"}.jpg`}><ImageDown /> Cover {c.shape === "short" ? "9:16" : "16:9"}</a></Button>
                ))}
              </div>
              <div className="space-y-2">
                {r.captions.map((c) => (
                  <div key={c.platform} className="rounded-xl border border-border p-3" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                    <div className="flex items-center gap-2">
                      <PlatformIcon id={c.platform} className="size-3.5" />
                      <span className="flex-1 text-[13px] font-medium">{getPlatform(c.platform).label}</span>
                      <CopyButton text={c.text} label={`${getPlatform(c.platform).label} caption`} className="size-7" />
                    </div>
                    {c.title && <div className="mt-2 text-[12px]"><span className="text-muted-foreground">Title:</span> {c.title}</div>}
                    <p className="scrollbar-thin mt-2 max-h-28 overflow-y-auto text-[12px] leading-relaxed whitespace-pre-line text-foreground/80">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {r.buffer?.length ? (
            <div className="rounded-xl border border-border p-3.5 text-[13px]">
              <div className="mb-2 font-medium">In Buffer</div>
              <ul className="space-y-1 text-muted-foreground">
                {r.buffer.map((b) => <li key={b.channelId}>{b.channel} · {b.mode === "draft" ? "draft" : b.mode === "queue" ? "queued" : b.mode === "now" ? "published" : b.dueAt ? fmtDateTime(b.dueAt) : "scheduled"}</li>)}
              </ul>
            </div>
          ) : null}

          {(r.status === "submitted" || r.status === "in_buffer") && <SendToBuffer r={r} assigned={assigned} onSent={onChanged} />}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {r.status !== "posted" && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => void run({ action: "posted" }, "Marked as posted")}><CheckCheck /> Mark posted</Button>}
            {r.status !== "posted" && r.status !== "scheduled" && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => setMode(mode === "scheduled" ? "none" : "scheduled")}>Mark scheduled…</Button>}
            {r.status !== "posted" && r.status !== "returned" && <Button size="sm" variant="ghost" className="rounded-full" disabled={busy} onClick={() => setMode(mode === "return" ? "none" : "return")}><Undo2 /> Send back…</Button>}
            {r.status !== "submitted" && <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" disabled={busy} onClick={() => void run({ action: "reopen" }, "Back in the queue")}>Move to “To post”</Button>}
          </div>
          {mode === "scheduled" && (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-9 w-auto tnum" />
              <Button size="sm" className="rounded-full" disabled={busy} onClick={() => void run({ action: "scheduled", at: new Date(when).toISOString() }, "Marked as scheduled")}>Save</Button>
            </div>
          )}
          {mode === "return" && (
            <div className="space-y-2">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should the advisor change? They’ll see this in the Post step." />
              <Button size="sm" className="rounded-full" disabled={busy || !note.trim()} onClick={() => void run({ action: "return", note }, "Sent back to the advisor")}>Send back</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
function toLocal(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ChannelPlan {
  on: boolean;
  mode: BufferMode;
  at: string;
  text: string;
  title?: string;
}

function SendToBuffer({ r, assigned, onSent }: { r: PostRequest; assigned: string[]; onSent: () => Promise<void> }) {
  const buffer = useBuffer();
  const channels = buffer.status && "channels" in buffer.status ? buffer.status.channels : [];
  const usable = channels.filter((c) => !c.isDisconnected && !c.isLocked);
  const [plans, setPlans] = React.useState<Record<string, ChannelPlan>>({});
  const [busy, setBusy] = React.useState(false);
  const [results, setResults] = React.useState<{ channel: string; ok: boolean; message: string }[] | null>(null);

  const defaultAt = r.timing.at && Date.parse(r.timing.at) > Date.now() + 120_000 ? toLocal(r.timing.at) : toLocal(new Date(Date.now() + 86400000).toISOString()).slice(0, 11) + "08:30";
  const captionFor = (c: BufferChannel) => {
    const p = platformForService(c.service, r.format);
    return r.captions.find((x) => x.platform === p) ?? r.captions.find((x) => p && getPlatform(x.platform).label === getPlatform(p).label) ?? r.captions[0];
  };
  const planFor = (c: BufferChannel): ChannelPlan =>
    plans[c.id] ?? { on: assigned.includes(c.id), mode: r.timing.kind === "at" ? "schedule" : "queue", at: defaultAt, text: captionFor(c)?.text ?? "", title: captionFor(c)?.title ?? r.title };
  const setPlan = (c: BufferChannel, patch: Partial<ChannelPlan>) => setPlans((ps) => ({ ...ps, [c.id]: { ...planFor(c), ...patch } }));
  const chosen = usable.filter((c) => planFor(c).on);

  const send = async () => {
    setBusy(true);
    setResults(null);
    try {
      const link = await fetch(`/api/video/files/${encodeURIComponent(r.output.id)}/link`).then((x) => x.json());
      if (!link.ok) throw new Error(link.error || "Couldn’t make a public link to the video.");
      const out: { channel: string; ok: boolean; message: string }[] = [];
      const posted: PostRequestBufferPost[] = [];
      for (const c of chosen) {
        const p = planFor(c);
        const platform = platformForService(c.service, r.format);
        const cover = r.covers.find((x) => x.shape === (platform && getPlatform(platform).aspect === "16:9" ? "long" : "short")) ?? r.covers[0];
        const res = await createBufferPost({
          channelId: c.id,
          service: c.service,
          text: p.text,
          mode: p.mode,
          dueAt: p.mode === "schedule" ? new Date(p.at).toISOString() : undefined,
          videoUrl: link.url,
          thumbnailOffsetMs: cover?.frameMs,
          title: platform === "youtube" || platform === "youtube_shorts" || platform === "tiktok" ? p.title || r.title : undefined,
          draft: p.mode === "draft",
        });
        if (res.ok) {
          posted.push({ channelId: c.id, channel: channelLabel(c), platform, mode: p.mode, dueAt: res.post.dueAt, postId: res.post.id });
          out.push({ channel: channelLabel(c), ok: true, message: p.mode === "draft" ? "Saved as a draft" : p.mode === "now" ? "Published" : res.post.dueAt ? `Scheduled ${fmtDateTime(res.post.dueAt)}` : "Added to the queue" });
        } else out.push({ channel: channelLabel(c), ok: false, message: res.error });
      }
      setResults(out);
      if (posted.length) {
        await act(r.id, { action: "buffer", posts: [...(r.buffer ?? []).filter((b) => !posted.some((p) => p.channelId === b.channelId)), ...posted] });
        toast.success(`Sent to Buffer (${posted.length} of ${chosen.length})`);
        await onSent();
      } else toast.error("Buffer didn’t accept the posts", { description: out[0]?.message });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (buffer.loading) return <LoaderCircle className="size-5 animate-spin text-muted-foreground" />;
  if (!buffer.connected) return <p className="rounded-xl bg-muted p-3.5 text-[13px] text-muted-foreground">Buffer isn’t connected. Download the MP4 and captions above and post it by hand, then mark it posted.</p>;

  return (
    <div className="rounded-xl border border-primary/40 p-4">
      <div className="text-[15px] font-medium">Send to Buffer</div>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{assigned.length ? "This advisor’s channels are selected." : "No channels assigned to this advisor yet (Admin → Buffer). Pick them here."} The MP4 is attached for you.</p>
      <div className="mt-4 divide-y divide-border">
        {usable.map((c) => {
          const p = planFor(c);
          const platform = platformForService(c.service, r.format);
          return (
            <div key={c.id} className="py-3">
              <label className="flex cursor-pointer items-center gap-3">
                <Switch checked={p.on} onCheckedChange={(v) => setPlan(c, { on: v })} />
                <ChannelAvatar channel={c} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{channelLabel(c)}</span>
                {assigned.includes(c.id) && <span className="text-[11px] text-primary">{r.advisorName.split(" ")[0]}’s</span>}
              </label>
              {p.on && (
                <div className="mt-3 space-y-2 sm:pl-[92px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup type="single" value={p.mode} onValueChange={(v) => v && setPlan(c, { mode: v as BufferMode })}>
                      <ToggleGroupItem value="schedule">Schedule</ToggleGroupItem>
                      <ToggleGroupItem value="queue">Queue</ToggleGroupItem>
                      <ToggleGroupItem value="draft">Draft</ToggleGroupItem>
                      <ToggleGroupItem value="now">Now</ToggleGroupItem>
                    </ToggleGroup>
                    {p.mode === "schedule" && <Input type="datetime-local" value={p.at} onChange={(e) => setPlan(c, { at: e.target.value })} className="h-8 w-auto text-[12px] tnum" />}
                  </div>
                  {(platform === "youtube" || platform === "youtube_shorts" || platform === "tiktok") && (
                    <Input value={p.title ?? ""} onChange={(e) => setPlan(c, { title: e.target.value })} placeholder="Title" className="h-8 text-[13px]" />
                  )}
                  <Textarea rows={4} value={p.text} onChange={(e) => setPlan(c, { text: e.target.value })} className="text-[12px]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {results && (
        <ul className="mt-3 space-y-1">
          {results.map((x) => (
            <li key={x.channel} className={cn("flex items-center gap-2 text-[12px]", x.ok ? "text-muted-foreground" : "text-destructive")}>
              {x.ok ? <CircleCheck className="size-3.5 text-success" /> : <XCircle className="size-3.5" />} {x.channel}: {x.message}
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-4 rounded-full" disabled={busy || !chosen.length || chosen.some((c) => !planFor(c).text.trim() || (planFor(c).mode === "schedule" && Date.parse(planFor(c).at) < Date.now() + 60_000))} onClick={() => void send()}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Send />} Send {chosen.length || ""} to Buffer
      </Button>
    </div>
  );
}
