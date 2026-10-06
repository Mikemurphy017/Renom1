"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Clock, Hash, Lock, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { VideoThumb } from "@/components/shared/video-thumb";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ComplianceBadge } from "@/components/shared/badges";
import { BufferConfigure, BufferReview, BufferVideoLink, useBufferPlan } from "@/components/buffer/buffer-publish";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, useWriter } from "@/lib/ai/writer";
import { generateThumbnails, type PlatformCopy } from "@/lib/ai/content";
import { useAdvisorChannels, useBuffer } from "@/lib/buffer/use-buffer";
import { platformForService } from "@/lib/buffer/types";
import { activeDisclosure, disclosureFor } from "@/lib/compose";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import { TEAM } from "@/lib/mock/advisor";
import type { PlatformId, ThumbnailSpec } from "@/lib/types";
import { cn, fmtNumber, sleep, TODAY } from "@/lib/utils";
import { AskBar, RequestLine, Writing } from "../ask-bar";
import type { StepProps } from "../studio-view";

type Cover = ThumbnailSpec & { id: string; size: string };
const SUB = ["Cover", "Caption", "Schedule"] as const;

export function PostStep({ video }: StepProps) {
  const { profile, updateVideo, requireApproval, submitForReview } = useStore();
  const vertical = video.format === "short";
  const [sub, setSub] = useDraft(video.id, "post.sub", 0);

  // ── Cover ──
  const [covers, setCovers] = useDraft<Cover[]>(video.id, "post.covers", () => {
    const fresh = generateThumbnails(video.title, video.thumbnail ? 3 : 4, vertical ? "Instagram Reels" : "YouTube").map((c) => ({ ...c, size: vertical ? "768×1376" : "1376×768" }));
    return video.thumbnail ? [{ ...video.thumbnail, id: "current", size: vertical ? "768×1376" : "1376×768" }, ...fresh] : fresh;
  });
  const [coverId, setCoverId] = useDraft<string>(video.id, "post.cover", covers[0]?.id ?? "");

  // ── Platforms (from Buffer when connected) ──
  const buffer = useBuffer();
  const bufferOn = buffer.connected;
  const bufferChannels = buffer.status && "channels" in buffer.status ? buffer.status.channels : [];
  const [mine] = useAdvisorChannels(TEAM[0].id);
  const bufferPlatforms = Array.from(new Set(bufferChannels.filter((c) => !mine.length || mine.includes(c.id)).map((c) => platformForService(c.service, video.format)).filter(Boolean))) as PlatformId[];
  const defaultPlatforms: PlatformId[] = bufferOn && bufferPlatforms.length ? bufferPlatforms : video.platforms.length ? video.platforms : vertical ? ["youtube_shorts", "instagram", "linkedin"] : ["youtube", "linkedin"];
  const [platforms, setPlatforms] = useDraft<PlatformId[]>(video.id, "post.platforms", defaultPlatforms);

  // ── Captions ──
  const [copies, setCopies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", []);
  const [tab, setTab] = React.useState<PlatformId | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const { write, busy, status, source } = useWriter();
  const activeTab = tab && platforms.includes(tab) ? tab : platforms[0];

  const writeCaptions = React.useCallback(
    async (instruction?: string) => {
      try {
        const out = await write({
          task: "captions",
          profile: voiceProfileOf(profile),
          platforms,
          video: { title: video.title, format: video.format, script: video.script, outline: video.outline },
          current: instruction ? copies.map((c) => ({ platform: c.platform, title: c.title ?? null, description: c.description, hashtags: c.hashtags })) : undefined,
          instruction,
        });
        setCopies(out.captions.map((c) => ({ platform: c.platform, title: c.title ?? undefined, description: c.description, hashtags: c.hashtags, cta: "{{BOOKING_LINK}}" })));
        setNote(out.note);
      } catch (e) {
        if (isAbort(e)) return;
        toast.error("Couldn’t write captions", { description: (e as Error).message });
      }
    },
    [write, profile, platforms, video, copies, setCopies]
  );

  React.useEffect(() => {
    if (sub === 1 && !copies.length && !busy) writeCaptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const updateCopy = (p: PlatformId, patch: Partial<PlatformCopy>) => setCopies((cs) => cs.map((c) => (c.platform === p ? { ...c, ...patch } : c)));
  const missing = platforms.filter((p) => !copies.some((c) => c.platform === p));

  // ── Schedule ──
  const bplan = useBufferPlan(video, bufferChannels);
  const [bufferPhase, setBufferPhase] = React.useState<"configure" | "review">("configure");
  const needsApproval = requireApproval && video.compliance !== "approved";

  const chosenCover = covers.find((c) => c.id === coverId) ?? covers[0];

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 pb-28">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">{["Pick a cover.", "Say it once, everywhere.", "Approve it, schedule it, done."][sub]}</h1>
        <div className="mt-5 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {SUB.map((s, i) => (
              <button
                key={s}
                onClick={() => i <= sub && setSub(i)}
                className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] transition-colors", i === sub ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : i < sub ? "cursor-pointer text-foreground hover:bg-muted" : "cursor-default text-muted-foreground")}
              >
                {i < sub ? <Check className="size-3.5 text-primary" /> : <span className="text-[11px] opacity-60">{i + 1}</span>}
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sub === 0 && (
        <>
          <p className="text-center text-[14px] text-muted-foreground">One headshot, endless poses. Pick the one you&rsquo;d stop scrolling for.</p>
          <div className={cn("grid gap-4", vertical ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
            {covers.map((c) => (
              <button key={c.id + c.pose + c.style} onClick={() => setCoverId(c.id)} className={cn("cursor-pointer rounded-2xl p-1.5 transition-all", c.id === chosenCover?.id ? "bg-brass-soft ring-2 ring-primary" : "hover:bg-card")}>
                <VideoThumb spec={c} format={video.format} size="md" label={c.size} className="rounded-xl" />
                <div className="mt-1.5 text-[12px] text-muted-foreground">{c.id === "current" ? "Current" : c.headline}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="rounded-full" onClick={() => setCovers(generateThumbnails(video.title, 4, vertical ? "Instagram Reels" : "YouTube").map((c) => ({ ...c, id: c.id + Math.random(), size: vertical ? "768×1376" : "1376×768" })))}>
              <RefreshCw /> More covers
            </Button>
            <Button className="rounded-full px-6" onClick={() => { if (chosenCover) updateVideo(video.id, { thumbnail: { style: chosenCover.style, pose: chosenCover.pose, headline: chosenCover.headline, accent: chosenCover.accent } }); setSub(1); }}>
              Write captions <ArrowRight />
            </Button>
          </div>
        </>
      )}

      {sub === 1 && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p.id) : [...platforms, p.id])}
                  className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors", on ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}
                  style={{ ["--pi-bg" as string]: on ? "var(--brass-soft)" : "var(--background)" }}
                >
                  <PlatformIcon id={p.id} className="size-3.5" /> {p.label}
                </button>
              );
            })}
          </div>
          {bufferOn && bufferPlatforms.length > 0 && bufferPlatforms.every((b) => platforms.includes(b)) && <p className="text-center text-[12px] text-muted-foreground">Includes every platform on your Buffer channels.</p>}

          {(busy || copies.length > 0) && (
            <RequestLine items={[`${platforms.length} platforms`, "From your script", "Your voice profile", `Disclosure ${activeDisclosure(profile).version} (auto)`]} source={busy ? null : source} />
          )}

          {busy && !copies.length ? (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
              <Writing status={status} />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            copies.length > 0 && (
              <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-soft", busy && "opacity-60")}>
                <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      onClick={() => setTab(p)}
                      className={cn("-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13px]", p === activeTab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                      style={{ ["--pi-bg" as string]: "var(--card)" }}
                    >
                      <PlatformIcon id={p} className="size-3.5" /> {getPlatform(p).label}
                    </button>
                  ))}
                </div>
                {activeTab && <CaptionEditor platform={activeTab} copy={copies.find((c) => c.platform === activeTab)} update={(patch) => updateCopy(activeTab, patch)} />}
              </div>
            )
          )}

          {missing.length > 0 && copies.length > 0 && !busy && (
            <div className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              No copy yet for {missing.map((m) => getPlatform(m).label).join(", ")}.
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => writeCaptions()}><Sparkles /> Write all</Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" className="rounded-full" onClick={() => setSub(0)}><ArrowLeft /> Cover</Button>
            <Button className="rounded-full px-6" disabled={!copies.length || busy} onClick={() => setSub(2)}>Schedule <ArrowRight /></Button>
          </div>
          {copies.length > 0 && <AskBar busy={busy} status={status} note={note} onAsk={(t) => writeCaptions(t)} suggestions={["Shorter LinkedIn post", "Add a question at the end", "More formal"]} />}
        </>
      )}

      {sub === 2 && (
        <>
          {needsApproval ? (
            <ApprovalGate status={video.compliance} onSubmit={() => { submitForReview(video.id); toast.success("Sent for approval", { description: "Ruth Lindqvist has it." }); }} />
          ) : bufferOn ? (
            <>
              {bufferPhase === "configure" ? (
                <>
                  <BufferVideoLink plan={bplan} />
                  <BufferConfigure channels={bufferChannels} plan={bplan} onBack={() => setSub(1)} onNext={() => setBufferPhase("review")} />
                </>
              ) : (
                <BufferReview video={video} channels={bufferChannels} plan={bplan} onEdit={() => setBufferPhase("configure")} />
              )}
            </>
          ) : (
            <SimulatedSchedule video={video} platforms={platforms} onBack={() => setSub(1)} />
          )}
        </>
      )}
    </div>
  );
}

function CaptionEditor({ platform, copy, update }: { platform: PlatformId; copy?: PlatformCopy; update: (p: Partial<PlatformCopy>) => void }) {
  const { profile } = useStore();
  const p = getPlatform(platform);
  if (!copy) return <div className="p-8 text-center text-[14px] text-muted-foreground">No copy for {p.label} yet.</div>;
  const locked = disclosureFor(platform, profile);
  const tags = copy.hashtags.map((h) => `#${h}`).join(" ");
  const total = copy.description.length + (tags ? tags.length + 2 : 0) + locked.length + 2;
  const over = total > p.descLimit;
  return (
    <div className="space-y-4 p-5 sm:p-6">
      {p.titleLimit ? (
        <div>
          <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground"><span>Title</span><span className="tnum">{copy.title?.length ?? 0} / {p.titleLimit}</span></div>
          <Input value={copy.title ?? ""} onChange={(e) => update({ title: e.target.value })} className="text-[15px]" />
        </div>
      ) : null}
      <div>
        <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
          <span>Caption</span>
          <span className={cn("tnum", over && "text-destructive")}>{fmtNumber(total)} / {fmtNumber(p.descLimit)} with disclosure</span>
        </div>
        <Textarea rows={platform === "x" ? 3 : 8} value={copy.description} onChange={(e) => update({ description: e.target.value })} className="text-[15px] leading-relaxed" />
        {over && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-destructive"><TriangleAlert className="size-3.5" /> {fmtNumber(total - p.descLimit)} characters over the {p.label} limit.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {copy.hashtags.map((h) => (
          <span key={h} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px]">
            <Hash className="size-3 text-muted-foreground" />{h}
            <button className="cursor-pointer text-muted-foreground" onClick={() => update({ hashtags: copy.hashtags.filter((x) => x !== h) })} aria-label={`Remove ${h}`}><X className="size-3" /></button>
          </span>
        ))}
        <input
          placeholder="+ hashtag"
          className="w-24 bg-transparent px-2 text-[12px] outline-none"
          onKeyDown={(e) => {
            const v = e.currentTarget.value.replace(/^#/, "").trim();
            if (e.key === "Enter" && v) {
              update({ hashtags: [...copy.hashtags, v] });
              e.currentTarget.value = "";
            }
          }}
        />
      </div>
      <div className="rounded-xl bg-brass-soft/60 p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#7d6238] uppercase dark:text-primary"><Lock className="size-3" /> Disclosure · {activeDisclosure(profile).version} · added automatically</div>
        <p className="text-[12px] leading-relaxed whitespace-pre-line text-foreground/75 select-none">{locked}</p>
      </div>
    </div>
  );
}

function ApprovalGate({ status, onSubmit }: { status: string; onSubmit: () => void }) {
  const waiting = status === "submitted";
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brass-soft"><ShieldCheck className="size-6 text-primary" /></div>
      <h2 className="mt-5 font-serif text-2xl">{waiting ? "With your reviewer." : status === "changes_requested" ? "Your reviewer asked for changes." : "One approval before it goes out."}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {waiting ? "You’ll be notified the moment it’s approved. Then scheduling is one click." : status === "changes_requested" ? "Make the edits, then send it back." : "Your reviewer sees the script, the captions and the disclosure together."}
      </p>
      <div className="mt-2 flex justify-center"><ComplianceBadge status={status as "draft"} /></div>
      <div className="mt-6 flex justify-center gap-2">
        {waiting ? (
          <Button variant="outline" className="rounded-full" asChild><Link href="/approve">Open Approve</Link></Button>
        ) : (
          <Button className="rounded-full px-6" onClick={onSubmit}><Send /> {status === "changes_requested" ? "Send back for approval" : "Send for approval"}</Button>
        )}
      </div>
    </div>
  );
}

function SimulatedSchedule({ video, platforms, onBack }: { video: StepProps["video"]; platforms: PlatformId[]; onBack: () => void }) {
  const { updateVideo } = useStore();
  const base = video.scheduledFor ? new Date(video.scheduledFor) : new Date(TODAY.getTime() + 2 * 86400000);
  const [plan, setPlan] = React.useState<Record<string, { on: boolean; mode: "now" | "schedule"; date: string; time: string }>>(() =>
    Object.fromEntries(platforms.map((p) => [p, { on: getPlatform(p).connected, mode: "schedule", date: base.toISOString().slice(0, 10), time: "08:30" }]))
  );
  const [progress, setProgress] = React.useState<number | null>(null);
  const [done, setDone] = React.useState(false);
  const enabled = platforms.filter((p) => plan[p]?.on);

  const publish = async () => {
    for (let i = 0; i <= 100; i += 10) { setProgress(i); await sleep(60); }
    const now = enabled.some((p) => plan[p].mode === "now");
    const firstSched = enabled.filter((p) => plan[p].mode === "schedule").map((p) => `${plan[p].date}T${plan[p].time}`).sort()[0];
    updateVideo(video.id, { platforms: enabled, status: now && !firstSched ? "published" : "scheduled", publishedAt: now ? new Date().toISOString() : undefined, scheduledFor: firstSched ? new Date(firstSched).toISOString() : undefined });
    setProgress(null);
    setDone(true);
    toast.success(now ? "Published" : "Scheduled", { description: "Archived for your records." });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft"><CircleCheck className="size-6 text-success" /></motion.div>
        <h2 className="mt-5 font-serif text-2xl">That&rsquo;s it. You&rsquo;re done.</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">Every caption, disclosure and approval is in the archive.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" className="rounded-full" asChild><Link href="/analyze">See how it does</Link></Button>
          <Button className="rounded-full" asChild><Link href="/">Home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-[13px] text-muted-foreground">Buffer isn&rsquo;t connected, so this is a preview. <Link href="/settings#publishing" className="text-primary hover:underline">Connect Buffer</Link></p>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {platforms.map((p) => {
          const pl = getPlatform(p);
          const s = plan[p];
          return (
            <div key={p} className={cn("flex flex-wrap items-center gap-3 px-5 py-4", !pl.connected && "opacity-50")} style={{ ["--pi-bg" as string]: "var(--card)" }}>
              <Switch checked={s.on} disabled={!pl.connected} onCheckedChange={(v) => setPlan({ ...plan, [p]: { ...s, on: v } })} />
              <PlatformIcon id={p} />
              <span className="w-32 text-[14px] font-medium">{pl.label}</span>
              {s.on && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <ToggleGroup type="single" value={s.mode} onValueChange={(v) => v && setPlan({ ...plan, [p]: { ...s, mode: v as "now" | "schedule" } })} className="rounded-full">
                    <ToggleGroupItem value="now" className="rounded-full">Now</ToggleGroupItem>
                    <ToggleGroupItem value="schedule" className="rounded-full">Schedule</ToggleGroupItem>
                  </ToggleGroup>
                  {s.mode === "schedule" && (
                    <>
                      <Input type="date" value={s.date} onChange={(e) => setPlan({ ...plan, [p]: { ...s, date: e.target.value } })} className="h-8 w-36 text-[12px] tnum" />
                      <Input type="time" value={s.time} onChange={(e) => setPlan({ ...plan, [p]: { ...s, time: e.target.value } })} className="h-8 w-28 text-[12px] tnum" />
                    </>
                  )}
                </div>
              )}
              {!pl.connected && <span className="ml-auto text-[12px] text-muted-foreground">Not connected</span>}
            </div>
          );
        })}
      </div>
      {progress !== null && <Progress value={progress} />}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="rounded-full" onClick={onBack}><ArrowLeft /> Caption</Button>
        <Button className="rounded-full px-6" disabled={!enabled.length || progress !== null} onClick={publish}>
          <Clock /> {enabled.some((p) => plan[p].mode === "now") ? "Publish" : `Schedule ${enabled.length}`}
        </Button>
      </div>
    </div>
  );
}
