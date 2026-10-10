"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, ExternalLink, LoaderCircle, Plug, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import { activeDisclosure, composeCaption } from "@/lib/compose";
import type { PlatformCopy } from "@/lib/ai/content";
import { getPlatform } from "@/lib/mock/platforms";
import { SERVICE_OF, type SocialPost } from "@/lib/social/types";
import { BUFFER_CHANNELS_URL, cancelScheduled, connectBuffer, publishVideo, useSocialPosts, useSocialStatus } from "@/lib/social/use-social";
import type { PlatformId, PostRecord, Video } from "@/lib/types";
import { cn, fmtDateTime } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (d: Date) => ({ date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` });

/** What the advisor's own posts mean for the video record (status, archive of what went out). */
function videoPatch(v: Video, posts: SocialPost[]): Partial<Video> | null {
  const live = posts.filter((p) => p.status !== "cancelled" && p.status !== "failed");
  const posted = live.filter((p) => p.status === "posted");
  const patch: Partial<Video> = {};
  const recorded = new Set((v.posts ?? []).filter((r) => r.how === "direct").map((r) => `${r.platform}|${r.at}`));
  const fresh: PostRecord[] = posted
    .map((p) => ({ platform: p.platform, channel: p.channelName, caption: p.caption, disclosureVersion: p.disclosureVersion, at: p.postedAt ?? p.scheduledFor ?? p.createdAt, how: "direct" as const }))
    .filter((r) => !recorded.has(`${r.platform}|${r.at}`));
  if (fresh.length) {
    patch.posts = [...(v.posts ?? []), ...fresh];
    if (v.status !== "published") {
      patch.status = "published";
      patch.publishedAt = fresh[0].at;
    }
    patch.platforms = [...new Set([...v.platforms, ...fresh.map((r) => r.platform)])];
  } else if (v.status !== "published") {
    const next = live.filter((p) => p.status === "scheduled" && p.scheduledFor).map((p) => p.scheduledFor!).sort()[0];
    if (next && (v.status !== "scheduled" || v.scheduledFor !== next)) {
      patch.status = "scheduled";
      patch.scheduledFor = next;
    } else if (!next && v.status === "scheduled" && !v.teamPost && posts.length) {
      // Everything scheduled was cancelled.
      patch.status = "draft";
      patch.scheduledFor = undefined;
    }
  }
  return Object.keys(patch).length ? patch : null;
}

/** Post the finished video to the advisor's own Buffer channels, now or at a set time. */
export function DirectPost({ video, platforms, copies }: { video: Video; platforms: PlatformId[]; copies: PlatformCopy[] }) {
  const { profile, updateVideo } = useStore();
  const { status } = useSocialStatus();
  const { posts, setPosts } = useSocialPosts(video.id);
  const [when, setWhen] = React.useState<"now" | "at">("now");
  const later = localParts(new Date(Date.now() + 3600_000));
  const [date, setDate] = React.useState(later.date);
  const [time, setTime] = React.useState(later.time);
  const [off, setOff] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Keep the video's status and archive in step with what went out.
  const videoRef = React.useRef(video);
  videoRef.current = video;
  React.useEffect(() => {
    if (!posts?.length) return;
    const patch = videoPatch(videoRef.current, posts);
    if (patch) updateVideo(videoRef.current.id, patch);
  }, [posts, updateVideo]);

  if (!status?.available) return null;

  const back = `/studio/${video.id}/post`;
  const ready = platforms.filter((p) => copies.some((c) => c.platform === p));
  // Each of the advisor's channels once, with the caption it takes (Shorts for a short video on YouTube).
  const targets = (status.channels ?? [])
    .filter((c) => !c.disconnected)
    .flatMap((c) => {
      const fits = ready.filter((p) => SERVICE_OF[p] === c.service);
      const platform = fits.length > 1 ? (fits.find((p) => (video.format === "short" ? p === "youtube_shorts" : p === "youtube")) ?? fits[0]) : fits[0];
      return platform ? [{ channel: c, platform }] : [];
    });
  const chosen = targets.filter((t) => !off.includes(t.channel.id));
  const missing = ready.filter((p) => !targets.some((t) => SERVICE_OF[t.platform] === SERVICE_OF[p]));
  const out = video.output;
  const at = when === "at" ? new Date(`${date}T${time}`) : null;
  const blocker = !out
    ? "Finish the edit first so there’s a video to post."
    : !ready.length
      ? "Write the captions first (the Caption step)."
      : !chosen.length
        ? "Pick at least one of your channels."
        : at && (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 5 * 60_000)
          ? "Pick a time at least 5 minutes from now."
          : null;

  const submit = async () => {
    if (!out) return;
    setBusy("post");
    try {
      const r = await publishVideo({
        videoId: video.id,
        title: video.title,
        outputId: out.id,
        posts: chosen.map(({ channel, platform }) => {
          const c = copies.find((x) => x.platform === platform)!;
          return { channelId: channel.id, platform, text: composeCaption(c, platform, profile), title: c.title };
        }),
        disclosureVersion: activeDisclosure(profile)?.version ?? "none",
        scheduleAt: at ? at.toISOString() : undefined,
      });
      setPosts((cur) => [...r.posts, ...(cur ?? [])]);
      if (r.posts.length) toast.success(at ? `Scheduled for ${fmtDateTime(at.toISOString())}` : "Posting now", { description: r.posts.map((p) => p.channelName).join(", ") });
      for (const e of r.errors) toast.error(`${getPlatform(e.platform).label}: ${e.error}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (p: SocialPost) => {
    if (!window.confirm(`Cancel the ${getPlatform(p.platform).label} post${p.scheduledFor ? ` scheduled for ${fmtDateTime(p.scheduledFor)}` : ""}?`)) return;
    setBusy(p.id);
    try {
      const next = await cancelScheduled(p.id);
      setPosts((cur) => (cur ?? []).map((x) => (x.id === next.id ? next : x)));
      toast.success("Cancelled");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown = (posts ?? []).filter((p) => p.status !== "cancelled");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brass-soft text-primary"><Send className="size-5" /></span>
        <div>
          <h3 className="font-serif text-xl leading-tight">Post from your Buffer</h3>
          <p className="mt-1 text-[14px] text-muted-foreground">Goes out on your own channels with the captions and disclosure above, right away or when you choose.</p>
        </div>
      </div>

      {!status.connected ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button className="rounded-full" onClick={() => { setBusy("connect"); connectBuffer(back); }} disabled={!!busy}>
            {busy === "connect" ? <LoaderCircle className="animate-spin" /> : <Plug />} Connect Buffer
          </Button>
          <span className="text-[12px] text-muted-foreground">One time. Only you see your channels.</span>
        </div>
      ) : (
        <>
          {status.error && <p className="mt-4 flex items-center gap-1.5 text-[13px] text-destructive"><TriangleAlert className="size-4" /> {status.error} <button className="cursor-pointer underline" onClick={() => connectBuffer(back)}>Connect again</button></p>}

          {shown.length > 0 && (
            <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
              {shown.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-[13px]" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                  <PlatformIcon id={p.platform} className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.channelName}</div>
                    <div className={cn("flex items-center gap-1 text-[12px]", p.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                      {p.status === "posted" && <><CircleCheck className="size-3.5 text-success" /> Posted{p.postedAt ? ` ${fmtDateTime(p.postedAt)}` : ""}</>}
                      {p.status === "scheduled" && <><CalendarClock className="size-3.5" /> Scheduled for {p.scheduledFor ? fmtDateTime(p.scheduledFor) : "later"}</>}
                      {p.status === "posting" && <><LoaderCircle className="size-3.5 animate-spin" /> Posting…</>}
                      {p.status === "failed" && <><TriangleAlert className="size-3.5" /> {p.error || "Didn’t go out."}</>}
                    </div>
                  </div>
                  {p.postUrl && (
                    <a href={p.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">View <ExternalLink className="size-3" /></a>
                  )}
                  {p.status === "scheduled" && (
                    <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" disabled={!!busy} onClick={() => void cancel(p)}>
                      {busy === p.id ? <LoaderCircle className="animate-spin" /> : null} Cancel
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 text-[13px] font-medium">Where</div>
              {targets.length ? (
                <div className="flex flex-wrap gap-1.5" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                  {targets.map(({ channel, platform }) => {
                    const on = !off.includes(channel.id);
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setOff((o) => (o.includes(channel.id) ? o.filter((x) => x !== channel.id) : [...o, channel.id]))}
                        aria-pressed={on}
                        className={cn("inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors", on ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}
                      >
                        <PlatformIcon id={platform} className="size-3.5 shrink-0" /> <span className="truncate">{channel.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">{ready.length ? "None of your Buffer channels match these captions yet." : "No captions yet."}</p>
              )}
              {missing.length > 0 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  No {missing.map((m) => getPlatform(m).label).join(", ")} channel in your Buffer.{" "}
                  <a href={BUFFER_CHANNELS_URL} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">Add it in Buffer</a>, then come back.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 text-[13px] font-medium">When</div>
              <div className="flex flex-wrap gap-2">
                {([["now", "Right now"], ["at", "Schedule it"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setWhen(k)} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px]", when === k ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
                ))}
              </div>
              {when === "at" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input type="date" value={date} min={localParts(new Date()).date} onChange={(e) => setDate(e.target.value)} className="h-10 w-auto tnum" aria-label="Date" />
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-auto tnum" aria-label="Time" />
                </div>
              )}
            </div>

            {blocker && <p className="text-[13px] text-destructive">{blocker}</p>}
            <Button className="rounded-full px-6" onClick={() => void submit()} disabled={!!blocker || !!busy}>
              {busy === "post" ? <LoaderCircle className="animate-spin" /> : when === "at" ? <CalendarClock /> : <Send />}
              {when === "at" ? `Schedule${at && !Number.isNaN(at.getTime()) ? ` for ${fmtDateTime(at.toISOString())}` : ""}` : `Post now${chosen.length ? ` to ${chosen.length} ${chosen.length === 1 ? "channel" : "channels"}` : ""}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
