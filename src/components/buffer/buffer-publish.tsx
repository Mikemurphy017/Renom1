"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, Clock, ExternalLink, Info, Lock, Send, ShieldAlert, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ComplianceBadge, ReadyPill } from "@/components/shared/badges";
import { StepSection } from "@/components/studio/step-layout";
import { notesFor, type Note } from "@/components/studio/steps/post-notes";
import { useStore } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { composeCaption, activeDisclosure } from "@/lib/compose";
import { generateDescriptions, type PlatformCopy } from "@/lib/ai/content";
import { getPlatform } from "@/lib/mock/platforms";
import { ME } from "@/lib/profile";
import { createBufferPost, useAdvisorChannels } from "@/lib/buffer/use-buffer";
import { platformForService, type BufferChannel, type BufferMode } from "@/lib/buffer/types";
import type { PlatformId, Video } from "@/lib/types";
import { cn, fmtDateTime, fmtNumber, TODAY } from "@/lib/utils";
import { ChannelAvatar, channelLabel } from "./channel-avatar";

interface ChannelPlan {
  enabled: boolean;
  mode: BufferMode;
  date: string;
  time: string;
  text?: string; // advisor edits; falls back to the composed caption
}

const localTz = () => new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName")?.value ?? "local time";

type Result = { channelId: string; ok: boolean; message: string; dueAt?: string | null; link?: string | null };

/** Shared Buffer publishing state for a video (persists while moving between sub-steps). */
export function useBufferPlan(video: Video, channels: BufferChannel[]) {
  const [mine] = useAdvisorChannels(ME);
  const { profile } = useStore();
  const [videoUrl, setVideoUrl] = useDraft(video.id, "buffer.videoUrl", () => (video.outputUrl?.startsWith("https://") ? video.outputUrl : ""));
  const [plans, setPlans] = useDraft<Record<string, ChannelPlan>>(video.id, "buffer.plans", {});
  const [copies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", []);

  const base = video.scheduledFor ? new Date(video.scheduledFor) : new Date(TODAY.getTime() + 2 * 86400000);
  const defaultDate = () => {
    const d = new Date(Math.max(base.getTime(), Date.now() + 86400000));
    return { date: d.toLocaleDateString("en-CA"), time: "08:30" };
  };

  const planFor = (c: BufferChannel): ChannelPlan =>
    plans[c.id] ?? { enabled: mine.includes(c.id), mode: "schedule", ...defaultDate() };
  const setPlan = (id: string, patch: Partial<ChannelPlan>) =>
    setPlans((ps) => ({ ...ps, [id]: { ...(ps[id] ?? planFor(channels.find((c) => c.id === id)!)), ...patch } }));

  const platformOf = (c: BufferChannel): PlatformId => platformForService(c.service, video.format) ?? "linkedin";
  const captionFor = (c: BufferChannel) => {
    const plan = planFor(c);
    if (plan.text !== undefined) return plan.text;
    const p = platformOf(c);
    const copy = copies.find((x) => x.platform === p) ?? generateDescriptions(video, [getPlatform(p)])[0];
    return composeCaption(copy, p, profile);
  };
  const dueAtFor = (plan: ChannelPlan) => new Date(`${plan.date}T${plan.time}`);

  const notesForChannel = (c: BufferChannel): Note[] => {
    const plan = planFor(c);
    const p = getPlatform(platformOf(c));
    const notes = notesFor({ ...p, connected: true }, video, false).filter((n) => !n.text.includes("thumbnail"));
    if (c.isDisconnected) notes.unshift({ level: "block", text: `${channelLabel(c)} needs to be reconnected in Buffer.` });
    if (c.isLocked) notes.unshift({ level: "block", text: "This channel is locked in Buffer (over your plan's channel limit)." });
    const len = captionFor(c).length;
    if (len > p.descLimit) notes.push({ level: "block", text: `Caption is ${fmtNumber(len)} characters — ${p.label} allows ${fmtNumber(p.descLimit)}.` });
    if (!videoUrl) notes.push({ level: "warn", text: "No public video link yet, so this goes to Buffer as a draft. Attach the video there, or add a link in Select Content." });
    if (plan.mode === "schedule" && dueAtFor(plan).getTime() < Date.now() + 60_000) notes.push({ level: "block", text: "Scheduled time is in the past." });
    if (plan.mode === "queue" && c.isQueuePaused) notes.push({ level: "warn", text: "This channel's queue is paused in Buffer." });
    return notes;
  };

  return { videoUrl, setVideoUrl, planFor, setPlan, captionFor, platformOf, dueAtFor, notesForChannel };
}

type Plan = ReturnType<typeof useBufferPlan>;

export function BufferVideoLink({ plan }: { plan: Plan }) {
  const valid = !plan.videoUrl || /^https:\/\/\S+$/.test(plan.videoUrl);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="text-[13px] font-semibold">Public video link for Buffer</div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Buffer downloads the video from a link. Paste a public https:// link to the final MP4 (S3, Dropbox direct link, etc.). Without one, posts are sent to Buffer as drafts so you can attach the file there.
      </p>
      <Input className={cn("mt-3 font-mono text-[12px]", !valid && "border-destructive")} placeholder="https://…/final.mp4" value={plan.videoUrl} onChange={(e) => plan.setVideoUrl(e.target.value.trim())} />
      {!valid && <p className="mt-1.5 text-[12px] text-destructive">Must be a public https:// link.</p>}
    </div>
  );
}

export function BufferConfigure({ channels, plan, onBack, onNext }: { channels: BufferChannel[]; plan: Plan; onBack: () => void; onNext: () => void }) {
  const { profile } = useStore();
  const enabledCount = channels.filter((c) => plan.planFor(c).enabled).length;
  return (
    <StepSection
      title="Configure post · via Buffer"
      action={<a href="https://publish.buffer.com/channels" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">Connect more channels in Buffer <ExternalLink className="size-3" /></a>}
    >
      <div className="divide-y divide-border">
        {channels.map((c) => {
          const p = plan.planFor(c);
          const platform = getPlatform(plan.platformOf(c));
          const caption = plan.captionFor(c);
          return (
            <div key={c.id} className={cn("py-4", (c.isDisconnected || c.isLocked) && "opacity-60")}>
              <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
                <label className="flex items-center gap-3">
                  <Switch checked={p.enabled} disabled={c.isDisconnected || c.isLocked} onCheckedChange={(v) => plan.setPlan(c.id, { enabled: v })} />
                  <ChannelAvatar channel={c} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{channelLabel(c)}</div>
                    <div className="text-[11px] text-muted-foreground">{platform.label} · {c.timezone}</div>
                  </div>
                </label>
                {p.enabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ToggleGroup type="single" value={p.mode} onValueChange={(v) => v && plan.setPlan(c.id, { mode: v as BufferMode })}>
                      <ToggleGroupItem value="now">Publish now</ToggleGroupItem>
                      <ToggleGroupItem value="schedule">Schedule</ToggleGroupItem>
                      <ToggleGroupItem value="queue">Add to queue</ToggleGroupItem>
                    </ToggleGroup>
                    {p.mode === "schedule" && (
                      <>
                        <Input type="date" value={p.date} onChange={(e) => plan.setPlan(c.id, { date: e.target.value })} className="h-8 w-36 text-[12px] tnum" />
                        <Input type="time" value={p.time} onChange={(e) => plan.setPlan(c.id, { time: e.target.value })} className="h-8 w-28 text-[12px] tnum" />
                        <span className="text-[11px] text-muted-foreground">{localTz()}</span>
                      </>
                    )}
                    {p.mode === "queue" && <span className="text-[12px] text-muted-foreground">Next open slot in this channel&rsquo;s Buffer schedule</span>}
                  </div>
                )}
              </div>
              {p.enabled && (
                <div className="mt-3 md:ml-[276px]">
                  <Textarea rows={6} value={caption} onChange={(e) => plan.setPlan(c.id, { text: e.target.value })} className="text-[13px]" />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Includes disclosure {activeDisclosure(profile)?.version ?? "not set"} — edit carefully; changes are archived.</span>
                    <span className={cn("tnum", caption.length > platform.descLimit && "text-destructive")}>{fmtNumber(caption.length)} / {fmtNumber(platform.descLimit)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-5">
        <Button variant="ghost" onClick={onBack}><ArrowLeft /> Back</Button>
        <Button onClick={onNext} disabled={!enabledCount}>Review <ArrowRight /></Button>
      </div>
    </StepSection>
  );
}

export function BufferReview({ video, channels, plan, onEdit }: { video: Video; channels: BufferChannel[]; plan: Plan; onEdit: () => void }) {
  const { profile } = useStore();
  const { updateVideo, requireApproval, submitForReview } = useStore();
  const enabled = channels.filter((c) => plan.planFor(c).enabled);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [results, setResults] = React.useState<Result[] | null>(null);
  const needsApproval = requireApproval && video.compliance !== "approved";
  const blocked = enabled.some((c) => plan.notesForChannel(c).some((n) => n.level === "block"));

  const publish = async () => {
    setProgress(0);
    const out: Result[] = [];
    for (const [i, c] of enabled.entries()) {
      const p = plan.planFor(c);
      const platform = plan.platformOf(c);
      const r = await createBufferPost({
        channelId: c.id,
        service: c.service,
        text: plan.captionFor(c),
        mode: p.mode,
        dueAt: p.mode === "schedule" ? plan.dueAtFor(p).toISOString() : undefined,
        videoUrl: plan.videoUrl || undefined,
        title: platform === "youtube" || platform === "youtube_shorts" || platform === "tiktok" ? video.title : undefined,
        draft: !plan.videoUrl,
      });
      out.push(
        r.ok
          ? { channelId: c.id, ok: true, message: r.post.status === "draft" ? "Saved as a draft in Buffer" : r.post.status === "sent" ? "Published" : "Scheduled in Buffer", dueAt: r.post.dueAt, link: r.post.externalLink }
          : { channelId: c.id, ok: false, message: r.error }
      );
      setProgress(Math.round(((i + 1) / enabled.length) * 100));
    }
    setResults(out);
    setProgress(null);
    const okResults = out.filter((r) => r.ok);
    if (okResults.length) {
      const publishedNow = enabled.some((c) => plan.planFor(c).mode === "now" && out.find((r) => r.channelId === c.id)?.ok) && !!plan.videoUrl;
      const firstDue = okResults.map((r) => r.dueAt).filter(Boolean).sort()[0];
      updateVideo(video.id, {
        platforms: Array.from(new Set(enabled.map((c) => plan.platformOf(c)))),
        status: publishedNow ? "published" : "scheduled",
        publishedAt: publishedNow ? new Date().toISOString() : video.publishedAt,
        scheduledFor: firstDue ?? video.scheduledFor,
        posts: [
          ...(video.posts ?? []),
          ...enabled.flatMap((c) => {
            const r = out.find((x) => x.channelId === c.id);
            if (!r?.ok) return [];
            const mode = plan.planFor(c).mode;
            return [{
              platform: plan.platformOf(c),
              channel: channelLabel(c),
              caption: plan.captionFor(c),
              disclosureVersion: activeDisclosure(profile)?.version ?? "none",
              at: r.dueAt ?? new Date().toISOString(),
              how: (!plan.videoUrl ? "buffer-draft" : mode === "now" ? "buffer-now" : mode === "queue" ? "buffer-queue" : "buffer-scheduled") as "buffer-now",
            }];
          }),
        ],
      });
    }
    if (okResults.length === out.length) toast.success("Sent to Buffer", { description: `${out.length} post${out.length > 1 ? "s" : ""} created.` });
    else if (okResults.length) toast.warning("Some posts failed", { description: `${okResults.length} of ${out.length} reached Buffer.` });
    else toast.error("Buffer didn't accept the posts", { description: out[0]?.message });
  };

  if (results) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 shadow-soft">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("mx-auto flex size-12 items-center justify-center rounded-full", results.every((r) => r.ok) ? "bg-success-soft" : "bg-warning-soft")}>
          {results.every((r) => r.ok) ? <CircleCheck className="size-6 text-success" /> : <TriangleAlert className="size-6 text-destructive" />}
        </motion.div>
        <h2 className="mt-5 text-center font-serif text-2xl">{results.every((r) => r.ok) ? "Sent to Buffer." : "Some posts need attention."}</h2>
        <ul className="mt-6 divide-y divide-border rounded-md border border-border">
          {results.map((r) => {
            const c = channels.find((x) => x.id === r.channelId)!;
            return (
              <li key={r.channelId} className="flex items-center gap-3 px-4 py-3">
                <ChannelAvatar channel={c} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{channelLabel(c)}</div>
                  <div className={cn("text-[12px]", r.ok ? "text-muted-foreground" : "text-destructive")}>
                    {r.message}{r.ok && r.dueAt ? ` · ${fmtDateTime(r.dueAt)}` : ""}
                  </div>
                </div>
                {r.ok ? <CircleCheck className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline">View</a>}
              </li>
            );
          })}
        </ul>
        <div className="mt-6 flex justify-center gap-2">
          {results.some((r) => !r.ok) && <Button variant="outline" onClick={() => setResults(null)}>Try again</Button>}
          <Button variant="outline" asChild><a href="https://publish.buffer.com" target="_blank" rel="noreferrer">Open Buffer <ExternalLink /></a></Button>
          <Button asChild><Link href="/board">Back to board</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {needsApproval && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 bg-warning-soft px-4 py-3">
          <ShieldAlert className="size-5 text-destructive" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="font-medium text-destructive">Compliance approval required before sending to Buffer</div>
            <div className="text-[12px] text-muted-foreground">Status: <ComplianceBadge status={video.compliance} className="ml-1" /></div>
          </div>
          {video.compliance === "draft" || video.compliance === "changes_requested" ? (
            <Button size="sm" variant="outline" onClick={() => { submitForReview(video.id); toast.success("Submitted for review"); }}>Submit for review</Button>
          ) : (
            <Button size="sm" variant="outline" asChild><Link href="/compliance">Open queue</Link></Button>
          )}
        </div>
      )}
      {enabled.map((c) => {
        const p = plan.planFor(c);
        const notes = plan.notesForChannel(c);
        const ok = !notes.some((n) => n.level === "block");
        return (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              <ChannelAvatar channel={c} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{channelLabel(c)}</div>
                <div className="text-[11px] text-muted-foreground">{getPlatform(plan.platformOf(c)).label} · preferred aspect <span className="tnum">{getPlatform(plan.platformOf(c)).aspect}</span> · via Buffer</div>
              </div>
              <span className="text-[12px] text-muted-foreground tnum">
                {p.mode === "now" ? "Publish now" : p.mode === "queue" ? "Next queue slot" : <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {fmtDateTime(plan.dueAtFor(p).toISOString())}</span>}
              </span>
              <ReadyPill ok={ok} />
            </div>
            <p className="mt-3 line-clamp-3 border-t border-border pt-3 text-[12px] whitespace-pre-line text-muted-foreground">{plan.captionFor(c)}</p>
            <ul className="mt-2 space-y-1">
              {notes.map((n, i) => (
                <li key={i} className={cn("flex items-start gap-2 text-[12px]", n.level === "block" ? "text-destructive" : n.level === "warn" ? "text-[#7d6238] dark:text-primary" : "text-muted-foreground")}>
                  {n.level === "info" ? <Info className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
                  {n.text}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onEdit}>Edit</Button>
        <Button onClick={publish} disabled={blocked || needsApproval || progress !== null}>
          {needsApproval ? <Lock /> : <Send />} {plan.videoUrl ? "Confirm & Publish" : "Send drafts to Buffer"}
        </Button>
      </div>
      {progress !== null && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex justify-between text-[12px]"><span>Sending to Buffer…</span><span className="tnum">{progress}%</span></div>
          <Progress value={progress} />
        </div>
      )}
    </div>
  );
}
