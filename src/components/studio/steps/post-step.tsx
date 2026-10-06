"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Bookmark, Check, CircleCheck, Hash, Lock, Send, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ComplianceBadge } from "@/components/shared/badges";
import { BufferConfigure, BufferReview, BufferVideoLink, useBufferPlan } from "@/components/buffer/buffer-publish";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, useWriter } from "@/lib/ai/writer";
import type { PlatformCopy } from "@/lib/ai/content";
import { useAdvisorChannels, useBuffer } from "@/lib/buffer/use-buffer";
import { platformForService } from "@/lib/buffer/types";
import { activeDisclosure, composeCaption, disclosureFor } from "@/lib/compose";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import { ME } from "@/lib/profile";
import type { PlatformId } from "@/lib/types";
import { cn, fmtNumber } from "@/lib/utils";
import { AskBar, RequestLine, Writing } from "../ask-bar";
import { CoverStudio } from "./cover-studio";
import type { StepProps } from "../studio-view";

const SUB = ["Cover", "Caption", "Schedule"] as const;

export function PostStep({ video }: StepProps) {
  const { profile, updateVideo, requireApproval, submitForReview, reviewer } = useStore();
  const vertical = video.format === "short";
  const [sub, setSub] = useDraft(video.id, "post.sub", 0);

  // ── Platforms (from Buffer when connected) ──
  const buffer = useBuffer();
  const bufferOn = buffer.connected;
  const bufferChannels = buffer.status && "channels" in buffer.status ? buffer.status.channels : [];
  const [mine] = useAdvisorChannels(ME);
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
  // Buffer drafts don't go out, so they can be saved before approval.
  const [bufferDrafts, setBufferDrafts] = React.useState(false);
  const router = useRouter();
  const saveDraft = () => {
    updateVideo(video.id, { status: "draft" });
    toast.success("Saved as a draft", { description: "It’s in Videos → Drafts. Nothing has been posted." });
    router.push("/videos?filter=drafts");
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 pb-28">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">{["Pick a cover.", "Say it once, everywhere.", requireApproval ? "Approve it, schedule it, done." : "Schedule it, or save it as a draft."][sub]}</h1>
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
        {video.status !== "published" && (
          <button onClick={saveDraft} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <Bookmark className="size-3.5" /> Save as draft and finish later
          </button>
        )}
      </div>

      {sub === 0 && <CoverStudio video={video} onDone={() => setSub(1)} />}

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
            <RequestLine items={[`${platforms.length} platforms`, "From your script", "Your voice profile", `Disclosure ${activeDisclosure(profile)?.version ?? "not set"} (auto)`]} source={busy ? null : source} />
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
          {needsApproval && !bufferDrafts ? (
            <ApprovalGate
              status={video.compliance}
              onSubmit={() => { submitForReview(video.id); toast.success("Sent for approval", { description: reviewer ? `${reviewer} has it.` : "It’s in the Approve queue." }); }}
              onSaveDraft={saveDraft}
              onBufferDrafts={bufferOn ? () => setBufferDrafts(true) : undefined}
            />
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
            <ManualPost video={video} platforms={platforms} copies={copies} onBack={() => setSub(1)} />
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
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#7d6238] uppercase dark:text-primary"><Lock className="size-3" /> Disclosure · {activeDisclosure(profile)?.version ?? "not set"} · added automatically</div>
        <p className="text-[12px] leading-relaxed whitespace-pre-line text-foreground/75 select-none">{locked}</p>
      </div>
    </div>
  );
}

function ApprovalGate({ status, onSubmit, onSaveDraft, onBufferDrafts }: { status: string; onSubmit: () => void; onSaveDraft: () => void; onBufferDrafts?: () => void }) {
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
      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-border pt-4 text-[13px]">
        {onBufferDrafts && <button onClick={onBufferDrafts} className="cursor-pointer text-primary hover:underline">Save to Buffer drafts meanwhile</button>}
        <button onClick={onSaveDraft} className="cursor-pointer text-muted-foreground hover:text-foreground">Save as draft here</button>
      </div>
    </div>
  );
}

/** Without Buffer: connect it, or post by hand and keep the record. */
function ManualPost({ video, platforms, copies, onBack }: { video: StepProps["video"]; platforms: PlatformId[]; copies: PlatformCopy[]; onBack: () => void }) {
  const { updateVideo, profile } = useStore();
  const [done, setDone] = React.useState(false);
  const captionFor = (p: PlatformId) => {
    const c = copies.find((x) => x.platform === p);
    return c ? composeCaption(c, p, profile) : "";
  };

  const markPosted = () => {
    const at = new Date().toISOString();
    updateVideo(video.id, {
      platforms,
      status: "published",
      publishedAt: at,
      posts: [
        ...(video.posts ?? []),
        ...platforms.map((p) => ({ platform: p, channel: "Posted manually", caption: captionFor(p), disclosureVersion: activeDisclosure(profile)?.version ?? "none", at, how: "manual" as const })),
      ],
    });
    setDone(true);
    toast.success("Marked as posted", { description: "The captions and disclosure are in your archive." });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft"><CircleCheck className="size-6 text-success" /></motion.div>
        <h2 className="mt-5 font-serif text-2xl">That&rsquo;s it. You&rsquo;re done.</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">Every caption and disclosure is in your archive.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" className="rounded-full" asChild><Link href="/approve">See the archive</Link></Button>
          <Button className="rounded-full" asChild><Link href="/">Home</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
        <h2 className="font-serif text-2xl">Connect Buffer to schedule.</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">Buffer posts to LinkedIn, YouTube, Instagram, Facebook and more for you. Or post it yourself and keep the record here.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button className="rounded-full px-5" asChild><Link href="/settings#publishing">Connect Buffer</Link></Button>
          <Button variant="outline" className="rounded-full" onClick={markPosted} disabled={!platforms.length}>I posted it myself</Button>
        </div>
      </div>
      <div className="mx-auto max-w-lg space-y-2">
        {platforms.map((p) => (
          <div key={p} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px]" style={{ ["--pi-bg" as string]: "var(--card)" }}>
            <PlatformIcon id={p} className="size-4" />
            <span className="flex-1">{getPlatform(p).label}</span>
            <Button
              size="xs"
              variant="ghost"
              disabled={!captionFor(p)}
              onClick={() => {
                navigator.clipboard?.writeText(captionFor(p)).then(() => toast.success(`${getPlatform(p).label} caption copied`)).catch(() => toast.error("Couldn’t copy"));
              }}
            >
              Copy caption
            </Button>
          </div>
        ))}
      </div>
      <div className="flex">
        <Button variant="ghost" className="rounded-full" onClick={onBack}><ArrowLeft /> Caption</Button>
      </div>
    </div>
  );
}
