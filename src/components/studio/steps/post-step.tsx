"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock, Film, Image as ImageIcon, Info, Lock, Plus, Send, ShieldAlert, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoThumb } from "@/components/shared/video-thumb";
import { Headshot } from "@/components/shared/headshot";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ComplianceBadge, ReadyPill } from "@/components/shared/badges";
import { useStore } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { generateDescriptions, type PlatformCopy } from "@/lib/ai/content";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import { ADVISOR } from "@/lib/mock/advisor";
import type { Platform, PlatformId, Video } from "@/lib/types";
import { cn, fmtDateTime, fmtDuration, sleep, TODAY } from "@/lib/utils";
import { StepSection } from "../step-layout";
import type { StepProps } from "../studio-view";

interface PlatformPlan {
  enabled: boolean;
  mode: "now" | "schedule";
  date: string;
  time: string;
}

type Note = { level: "info" | "warn" | "block"; text: string };

function notesFor(p: Platform, v: Video, useThumb: boolean): Note[] {
  const n: Note[] = [];
  const sizeMB = v.format === "short" ? 48 : 420;
  if (!p.connected) n.push({ level: "block", text: `${p.label} isn't connected. Connect it in Settings to publish.` });
  if (sizeMB > p.maxFileMB) n.push({ level: "block", text: `File is ${sizeMB} MB — over the ${p.maxFileMB} MB limit.` });
  else n.push({ level: "info", text: `${sizeMB} MB MP4 · within the ${p.maxFileMB >= 1000 ? `${p.maxFileMB / 1000} GB` : `${p.maxFileMB} MB`} limit.` });
  if (useThumb && !p.customThumbnail) n.push({ level: "warn", text: `${p.label} does not support custom thumbnails — it will be ignored.` });
  if (p.id === "linkedin" && v.format === "short") n.push({ level: "warn", text: "LinkedIn recommends 16:9 — your 9:16 video will display with side bars on desktop." });
  if (p.id === "youtube" && v.format === "short") n.push({ level: "warn", text: "Vertical video under 3 minutes will be classified as a Short." });
  if ((p.id === "youtube_shorts" || p.id === "instagram" || p.id === "tiktok") && v.format === "long") n.push({ level: "block", text: `${p.label} expects 9:16 vertical video. Choose a 16:9 platform or re-record.` });
  if (p.id === "facebook") n.push({ level: "info", text: "Plays as a Reel in feed; 4:5 crop is applied automatically." });
  if (p.id === "x" && v.runtimeSec > 140) n.push({ level: "block", text: "X limits video to 2:20 for standard accounts." });
  return n;
}

const SUBSTEPS = ["Select Content", "Configure Post", "Review & Publish"];

export function PostStep({ video }: StepProps) {
  const { updateVideo, requireApproval, submitForReview } = useStore();
  const vertical = video.format === "short";
  const [sub, setSub] = useDraft(video.id, "post.sub", 0);
  const [useThumb, setUseThumb] = useDraft(video.id, "post.useThumb", !!video.thumbnail);
  const defaults = video.platforms.length ? video.platforms : vertical ? (["youtube_shorts", "instagram", "linkedin"] as PlatformId[]) : (["youtube", "linkedin"] as PlatformId[]);
  const [copies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", () => generateDescriptions(video, defaults.map(getPlatform)));
  const sched = video.scheduledFor ? new Date(video.scheduledFor) : new Date(TODAY.getTime() + 2 * 86400000);
  const [plans, setPlans] = useDraft<Record<PlatformId, PlatformPlan>>(video.id, "post.plans", () =>
    Object.fromEntries(
      PLATFORMS.map((p) => [
        p.id,
        {
          enabled: defaults.includes(p.id),
          mode: video.scheduledFor ? "schedule" : "now",
          date: sched.toISOString().slice(0, 10),
          time: p.id === "linkedin" ? "07:45" : sched.toTimeString().slice(0, 5),
        },
      ])
    ) as Record<PlatformId, PlatformPlan>
  );
  const [preview, setPreview] = React.useState<"video" | "thumbnail">("video");
  const [previewPlatform, setPreviewPlatform] = React.useState<PlatformId>(defaults[0]);
  const [publishing, setPublishing] = React.useState<null | number>(null);
  const [done, setDone] = React.useState<null | { now: PlatformId[]; scheduled: PlatformId[] }>(video.status === "published" ? { now: video.platforms, scheduled: [] } : null);

  const enabled = PLATFORMS.filter((p) => plans[p.id].enabled);
  const setPlan = (id: PlatformId, patch: Partial<PlatformPlan>) => setPlans((ps) => ({ ...ps, [id]: { ...ps[id], ...patch } }));
  const blocked = enabled.some((p) => notesFor(p, video, useThumb).some((n) => n.level === "block"));
  const needsApproval = requireApproval && video.compliance !== "approved";

  const publish = async () => {
    setPublishing(0);
    for (let i = 0; i <= 100; i += 5) {
      setPublishing(i);
      await sleep(45);
    }
    const now = enabled.filter((p) => plans[p.id].mode === "now").map((p) => p.id);
    const scheduled = enabled.filter((p) => plans[p.id].mode === "schedule").map((p) => p.id);
    const firstSched = scheduled.map((id) => `${plans[id].date}T${plans[id].time}`).sort()[0];
    updateVideo(video.id, {
      platforms: enabled.map((p) => p.id),
      status: now.length && !scheduled.length ? "published" : "scheduled",
      publishedAt: now.length ? new Date().toISOString() : undefined,
      scheduledFor: firstSched ? new Date(firstSched).toISOString() : undefined,
      metrics: now.length ? now.map((platform) => ({ platform, views: 0, watchTimeSec: 0, engagementRate: 0, followers: 0, linkClicks: 0, inquiries: 0 })) : video.metrics,
    });
    setPublishing(null);
    setDone({ now, scheduled });
    toast.success(now.length ? "Published" : "Scheduled", {
      description: `${now.length ? `${now.length} platform${now.length > 1 ? "s" : ""} live now` : ""}${now.length && scheduled.length ? " · " : ""}${scheduled.length ? `${scheduled.length} scheduled` : ""}. Archived for books-and-records.`,
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-10 text-center shadow-soft">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft">
          <CircleCheck className="size-6 text-success" />
        </motion.div>
        <h2 className="mt-5 font-serif text-2xl">{done.now.length ? "Your video is live." : "Your video is scheduled."}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A copy of every post — caption, disclosure {ADVISOR.disclosures.find((d) => d.active)!.version} and approver — was saved to the Compliance archive.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {[...done.now, ...done.scheduled].map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px]">
              <PlatformIcon id={id} className="size-3.5" /> {getPlatform(id).label}
              {done.scheduled.includes(id) && <Clock className="size-3 text-muted-foreground" />}
            </span>
          ))}
        </div>
        <div className="mt-7 flex justify-center gap-2">
          <Button variant="outline" asChild><Link href="/performance">View performance</Link></Button>
          <Button asChild><Link href="/board">Back to board</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-stepper */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-soft">
        {SUBSTEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => i <= sub && setSub(i)}
              className={cn("flex items-center gap-2 text-[13px]", i <= sub ? "cursor-pointer" : "cursor-default", i === sub ? "font-semibold" : "text-muted-foreground")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px] tnum", i < sub ? "border-primary/50 bg-brass-soft text-primary" : i === sub ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {i < sub ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </button>
            {i < SUBSTEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      {sub === 0 && (
        <StepSection title="Select content">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border-2 border-primary bg-brass-soft/40 p-4">
              <div className="flex items-start gap-4">
                <div className={cn("shrink-0 overflow-hidden rounded-md bg-[#1A2840]", vertical ? "aspect-[9/16] w-20" : "aspect-video w-36")}>
                  <div className="relative h-full w-full"><Headshot className="absolute bottom-0 left-1/2 h-[80%] -translate-x-1/2" /></div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-semibold"><Film className="size-4 text-primary" /> Final export</div>
                  <div className="mt-1 text-[12px] text-muted-foreground tnum">
                    {vertical ? "1080×1920" : "1920×1080"} · {fmtDuration(video.runtimeSec)} · {vertical ? "48" : "420"} MB · captions burned in
                  </div>
                  <div className="mt-2"><ComplianceBadge status={video.compliance} /></div>
                </div>
                <Check className="size-4 text-primary" />
              </div>
            </div>
            <div className={cn("rounded-lg border p-4 transition-colors", useThumb ? "border-2 border-primary bg-brass-soft/40" : "border-border")}>
              <div className="flex items-start gap-4">
                <VideoThumb spec={video.thumbnail} format={video.format} size="xs" className={vertical ? "w-20" : "w-36"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-semibold"><ImageIcon className="size-4 text-primary" /> Custom thumbnail</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{video.thumbnail ? `“${video.thumbnail.headline}”` : "No thumbnail created"}</div>
                </div>
                <Switch checked={useThumb} disabled={!video.thumbnail} onCheckedChange={setUseThumb} aria-label="Use custom thumbnail" />
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-border pt-5">
            <Button onClick={() => setSub(1)}>Configure post <ArrowRight /></Button>
          </div>
        </StepSection>
      )}

      {sub === 1 && (
        <StepSection title="Configure post" action={<Link href="/settings#platforms" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"><Plus className="size-3" /> Connect more platforms</Link>}>
          <div className="divide-y divide-border">
            {PLATFORMS.map((p) => {
              const plan = plans[p.id];
              const copy = copies.find((c) => c.platform === p.id);
              return (
                <div key={p.id} className={cn("grid items-center gap-4 py-4 md:grid-cols-[220px_1fr_auto]", !p.connected && "opacity-60")}>
                  <label className="flex items-center gap-3">
                    <Switch checked={plan.enabled} disabled={!p.connected} onCheckedChange={(v) => setPlan(p.id, { enabled: v })} />
                    <PlatformIcon id={p.id} />
                    <span className="text-[13px] font-medium">{p.label}</span>
                    {!p.connected && <span className="text-[11px] text-muted-foreground">Not connected</span>}
                  </label>
                  <p className="line-clamp-2 text-[12px] text-muted-foreground">{copy ? copy.title ?? copy.description : "Description will be generated from your script."}</p>
                  {plan.enabled && (
                    <div className="flex flex-wrap items-center gap-2">
                      <ToggleGroup type="single" value={plan.mode} onValueChange={(v) => v && setPlan(p.id, { mode: v as "now" | "schedule" })}>
                        <ToggleGroupItem value="now">Publish now</ToggleGroupItem>
                        <ToggleGroupItem value="schedule">Schedule</ToggleGroupItem>
                      </ToggleGroup>
                      {plan.mode === "schedule" && (
                        <>
                          <Input type="date" value={plan.date} onChange={(e) => setPlan(p.id, { date: e.target.value })} className="h-8 w-36 text-[12px] tnum" />
                          <Input type="time" value={plan.time} onChange={(e) => setPlan(p.id, { time: e.target.value })} className="h-8 w-28 text-[12px] tnum" />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-5">
            <Button variant="ghost" onClick={() => setSub(0)}><ArrowLeft /> Back</Button>
            <Button onClick={() => { setPreviewPlatform(enabled[0]?.id ?? defaults[0]); setSub(2); }} disabled={!enabled.length}>Review <ArrowRight /></Button>
          </div>
        </StepSection>
      )}

      {sub === 2 && (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <div className="eyebrow">Social preview</div>
              <ToggleGroup type="single" value={preview} onValueChange={(v) => v && setPreview(v as "video" | "thumbnail")}>
                <ToggleGroupItem value="video"><Film /> Video</ToggleGroupItem>
                <ToggleGroupItem value="thumbnail"><ImageIcon /> Thumbnail</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="mx-auto w-[260px] rounded-[28px] border-[6px] border-[#0B1F3A] bg-black p-1 shadow-xl dark:border-[#1d3456]">
              <div className="relative aspect-[9/19] overflow-hidden rounded-[22px] bg-[#0b0b0b]">
                <div className="flex h-full items-center">
                  {preview === "thumbnail" ? (
                    <VideoThumb spec={video.thumbnail} format={video.format} size={vertical ? "md" : "sm"} className="w-full rounded-none" />
                  ) : (
                    <div className={cn("relative w-full overflow-hidden bg-gradient-to-b from-[#2A3B55] to-[#1A2840]", vertical ? "h-full" : "aspect-video")}>
                      <Headshot className="absolute bottom-0 left-1/2 h-[62%] -translate-x-1/2" />
                      <span className="absolute inset-x-4 top-[22%] text-center text-[13px] font-extrabold text-white uppercase [text-shadow:0_2px_6px_rgba(0,0,0,.5)]">{(video.script?.hook ?? video.title).split(" ").slice(0, 5).join(" ")}</span>
                    </div>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute inset-x-3 bottom-4 text-white">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ ["--pi-bg" as string]: "#000" }}>
                    <PlatformIcon id={previewPlatform} className="size-3.5" /> {getPlatform(previewPlatform).handle ?? "halewealth"}
                  </div>
                  <p className="mt-1 line-clamp-3 text-[10px] opacity-90">{copies.find((c) => c.platform === previewPlatform)?.description ?? video.title}</p>
                </div>
                {preview === "thumbnail" && useThumb && !getPlatform(previewPlatform).customThumbnail && (
                  <div className="absolute inset-x-3 top-3 rounded-md bg-black/70 px-2 py-1.5 text-[10px] text-white">Custom thumbnail ignored on {getPlatform(previewPlatform).label}</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {needsApproval && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/25 bg-warning-soft px-4 py-3">
                <ShieldAlert className="size-5 text-destructive" />
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="font-medium text-destructive">Compliance approval required before publishing</div>
                  <div className="text-[12px] text-muted-foreground">Status: <ComplianceBadge status={video.compliance} className="ml-1" /></div>
                </div>
                {video.compliance === "draft" || video.compliance === "changes_requested" ? (
                  <Button size="sm" variant="outline" onClick={() => { submitForReview(video.id); toast.success("Submitted for review", { description: "Ruth Lindqvist has been notified." }); }}>
                    Submit for review
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" asChild><Link href="/compliance">Open queue</Link></Button>
                )}
              </div>
            )}
            {enabled.map((p) => {
              const notes = notesFor(p, video, useThumb);
              const ok = !notes.some((n) => n.level === "block");
              const plan = plans[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => setPreviewPlatform(p.id)}
                  className={cn("block w-full cursor-pointer rounded-lg border bg-card p-4 text-left shadow-soft transition-colors", previewPlatform === p.id ? "border-primary/60" : "border-border hover:border-primary/30")}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-md bg-muted" style={{ ["--pi-bg" as string]: "var(--muted)" }}><PlatformIcon id={p.id} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">Preferred aspect <span className="tnum">{p.aspect}</span> · {p.handle}</div>
                    </div>
                    <span className="text-[12px] text-muted-foreground tnum">
                      {plan.mode === "now" ? "Publish now" : <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {fmtDateTime(`${plan.date}T${plan.time}`)}</span>}
                    </span>
                    <ReadyPill ok={ok} />
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-border pt-3">
                    {notes.map((n, i) => (
                      <li key={i} className={cn("flex items-start gap-2 text-[12px]", n.level === "block" ? "text-destructive" : n.level === "warn" ? "text-[#7d6238] dark:text-primary" : "text-muted-foreground")}>
                        {n.level === "info" ? <Info className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
                        {n.text}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link href="/settings#platforms" className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"><Plus className="size-3" /> Connect more platforms</Link>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSub(1)}>Edit</Button>
                <Button onClick={publish} disabled={blocked || needsApproval || publishing !== null}>
                  {needsApproval ? <Lock /> : <Send />} Confirm & Publish
                </Button>
              </div>
            </div>
            {publishing !== null && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-2 flex justify-between text-[12px]"><span>Uploading to {enabled.length} platforms…</span><span className="tnum">{publishing}%</span></div>
                <Progress value={publishing} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
