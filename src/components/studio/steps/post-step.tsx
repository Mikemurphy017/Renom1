"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, CalendarDays, Check, Hash, LoaderCircle, Lock, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { ComplianceBadge } from "@/components/shared/badges";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, streamWrite } from "@/lib/ai/writer";
import { WRITERS, getWriter, type WriterId } from "@/lib/ai/writers";
import type { PlatformCopy } from "@/lib/ai/content";
import { activeDisclosure, BOOKING_LINE, composeCaption, disclosureFor } from "@/lib/compose";
import { bookingUrlFor } from "@/lib/booking";
import { CoverIntroStatus } from "../cover-intro-note";
import { useCoverIntro } from "../use-cover-intro";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import type { PlatformId } from "@/lib/types";
import { cn, fmtNumber } from "@/lib/utils";
import { AskBar, RequestLine, Writing } from "../ask-bar";
import { CopyButton } from "./share-kit";
import { CoverStudio } from "./cover-studio";
import { ShareKit } from "./share-kit";
import { TeamPost } from "./team-post";
import { PhonePreview } from "../phone-preview";
import { DirectPost } from "./direct-post";
import type { StepProps } from "../studio-view";

const SUB = ["Cover", "Caption", "Post"] as const;

type Version = { copies: PlatformCopy[]; taglines: string[]; note: string };
type Target = WriterId | "current";
type Versions = Partial<Record<Target, Version>>;
type Run = { status: string; error?: string; platforms: PlatformId[] };
/** Captions for platforms that have none yet, added without touching the ones already there (or edited). */
const fill = (have: PlatformCopy[], fresh: PlatformCopy[]) => [...have, ...fresh.filter((f) => !have.some((h) => h.platform === f.platform))];

function VersionCard({ label, description, selected, onClick, preview, run, className }: { label: string; description: string; selected: boolean; onClick: () => void; preview?: string; run?: { status: string; error?: string }; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={!preview}
      className={cn("flex min-h-[132px] flex-col rounded-2xl border bg-card p-3.5 text-left transition-colors sm:p-4", selected ? "border-primary ring-1 ring-primary" : "border-border", preview ? "cursor-pointer hover:border-primary/50" : "cursor-default", className)}
    >
      <span className="text-[14px] font-medium">{label}</span>
      <span className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{description}</span>
      <span className="mt-auto pt-3 text-[12px] leading-snug">
        {run?.error && !preview ? <span className="text-destructive">Couldn’t write this one.</span> : run && !run.error ? <span className="text-muted-foreground">{run.status}</span> : preview ? <span className="line-clamp-2 text-foreground/80">{preview.split("\n")[0]}</span> : null}
      </span>
    </button>
  );
}

export function PostStep({ video }: StepProps) {
  const { profile, updateVideo, requireApproval, submitForReview, reviewer } = useStore();
  const vertical = video.format === "short";
  const [sub, setSub] = useDraft(video.id, "post.sub", 0);
  const intro = useCoverIntro(video);

  // ── Platforms ──
  const defaultPlatforms: PlatformId[] = video.platforms.length ? video.platforms : vertical ? ["youtube_shorts", "instagram", "linkedin"] : ["youtube", "linkedin"];
  const [platforms, setPlatforms] = useDraft<PlatformId[]>(video.id, "post.platforms", defaultPlatforms);

  // ── Captions: four versions, one per writer (like the script) ──
  // `desc.copies` is the version being edited; the others wait in `desc.versions`.
  const [copies, setCopies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", []);
  const [versions, setVersions] = useDraft<Versions>(video.id, "desc.versions", () => (copies.length ? { current: { copies, taglines: [], note: "" } } : {}));
  const [writer, setWriter] = useDraft<WriterId | "current">(video.id, "desc.writer", copies.length ? "current" : "story");
  const [tagline, setTagline] = useDraft(video.id, "desc.tagline", "");
  // One entry per version being written (or that failed), with the platforms that request covers.
  const [runs, setRuns] = React.useState<Partial<Record<Target, Run>>>({});
  // Captions are only written when the advisor asks: this is true once they have.
  const [asked, setAsked] = useDraft(video.id, "desc.asked", copies.length > 0);
  const [tab, setTab] = React.useState<PlatformId | null>(null);
  const activeTab = tab && platforms.includes(tab) ? tab : platforms[0];
  const ctrl = React.useRef<AbortController | null>(null);
  const writerRef = React.useRef(writer);
  writerRef.current = writer;
  React.useEffect(() => () => ctrl.current?.abort(), []);
  const busyIds = (Object.keys(runs) as Target[]).filter((id) => runs[id] && !runs[id]!.error);
  const busy = busyIds.length > 0;
  const current = versions[writer];

  const copiesRef = React.useRef(copies);
  copiesRef.current = copies;
  const versionsRef = React.useRef(versions);
  versionsRef.current = versions;

  /**
   * Writes one version's captions for `only` (default: every selected platform).
   * `merge` adds captions for platforms that have none and leaves the rest,
   * edits included, exactly as they are.
   */
  const writeOne = async (id: Target, signal: AbortSignal, o: { instruction?: string; only?: PlatformId[]; merge?: boolean } = {}) => {
    const want = o.only ?? platforms;
    if (!want.length) return;
    setRuns((r) => ({ ...r, [id]: { status: "Starting…", platforms: want } }));
    try {
      const base = writerRef.current === id ? copiesRef.current : versionsRef.current[id]?.copies;
      const out = await streamWrite(
        {
          task: "captions",
          profile: voiceProfileOf(profile),
          writer: id === "current" ? "story" : id,
          platforms: want,
          video: { title: video.title, format: video.format, script: video.script, outline: video.outline },
          current: o.instruction && base ? base.filter((c) => want.includes(c.platform)).map((c) => ({ platform: c.platform, title: c.title ?? null, description: c.description, hashtags: c.hashtags })) : undefined,
          instruction: o.instruction,
        },
        { signal, onStatus: (status) => setRuns((r) => ({ ...r, [id]: { status, platforms: want } })) }
      );
      const fresh: PlatformCopy[] = out.captions.filter((c) => want.includes(c.platform)).map((c) => ({ platform: c.platform, title: c.title ?? undefined, description: c.description, hashtags: c.hashtags, cta: "{{BOOKING_LINK}}" }));
      const prev = (writerRef.current === id ? copiesRef.current : versionsRef.current[id]?.copies) ?? [];
      // A full rewrite replaces the platforms it wrote; anything it didn't write stays.
      const nextCopies = o.merge ? fill(prev, fresh) : [...prev.filter((c) => !fresh.some((f) => f.platform === c.platform)), ...fresh];
      setVersions((v) => ({ ...v, [id]: { copies: nextCopies, taglines: o.merge && v[id]?.taglines.length ? v[id]!.taglines : out.taglines.slice(0, 3), note: o.merge && v[id]?.note ? v[id]!.note : out.note } }));
      // Open the first version that arrives, and refresh the one being edited.
      if (writerRef.current === id || !copiesRef.current.length) {
        writerRef.current = id;
        copiesRef.current = nextCopies;
        setWriter(id);
        setCopies(nextCopies);
      }
      // A platform that was asked for and didn't come back is an error on that platform, not a silent gap.
      const gaps = want.filter((p) => !fresh.some((f) => f.platform === p));
      setRuns((r) => {
        const n = { ...r };
        if (gaps.length) n[id] = { status: "", error: "No caption came back.", platforms: gaps };
        else delete n[id];
        return n;
      });
    } catch (e) {
      if (isAbort(e)) return;
      setRuns((r) => ({ ...r, [id]: { status: "", error: (e as Error).message, platforms: want } }));
    }
  };

  const start = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    return c.signal;
  };
  /** Every version, every selected platform: the explicit "Generate captions". */
  const writeAll = () => {
    if (!platforms.length) return;
    setAsked(true);
    const signal = start();
    for (const w of WRITERS) void writeOne(w.id, signal);
  };
  /** Only the platforms that have no caption yet, in every version there is. Existing captions and edits stay. */
  const writeMissing = (only?: PlatformId[]) => {
    const signal = start();
    const targets: Target[] = [...WRITERS.map((w) => w.id).filter((id) => versionsRef.current[id]), ...(versionsRef.current.current ? (["current"] as const) : [])];
    if (!targets.length) return writeAll();
    for (const id of targets) {
      const have = (writerRef.current === id ? copiesRef.current : versionsRef.current[id]?.copies) ?? [];
      const need = (only ?? platforms).filter((p) => !have.some((c) => c.platform === p));
      if (need.length) void writeOne(id, signal, { only: need, merge: true });
    }
  };

  const revise = (instruction: string) => {
    const c = new AbortController();
    ctrl.current = c;
    void writeOne(writer, c.signal, { instruction });
  };

  const choose = (id: WriterId | "current") => {
    const v = versions[id];
    if (!v || id === writer) return;
    // Keep the edits made to the version being left.
    setVersions((vs) => ({ ...vs, [writer]: { ...(vs[writer] ?? { taglines: [], note: "" }), copies } }));
    setWriter(id);
    setCopies(v.copies);
  };

  const updateCopy = (p: PlatformId, patch: Partial<PlatformCopy>) => {
    const next = copies.map((c) => (c.platform === p ? { ...c, ...patch } : c));
    setCopies(next);
    setVersions((vs) => (vs[writer] ? { ...vs, [writer]: { ...vs[writer]!, copies: next } } : vs));
  };
  const missing = platforms.filter((p) => !copies.some((c) => c.platform === p));
  /** Where one platform's caption stands in the version on screen. */
  const stateOf = (p: PlatformId): "ready" | "writing" | "failed" | "none" => {
    if (copies.some((c) => c.platform === p)) return "ready";
    const mine = runs[writer];
    const any = (Object.values(runs) as Run[]).filter((r) => r.platforms.includes(p));
    if (mine?.platforms.includes(p) ? !mine.error : any.some((r) => !r.error)) return "writing";
    return any.some((r) => r.error) ? "failed" : "none";
  };
  const errorOf = (p: PlatformId) => (runs[writer]?.platforms.includes(p) && runs[writer]?.error) || (Object.values(runs) as Run[]).find((r) => r.error && r.platforms.includes(p))?.error;
  const toWrite = missing.filter((p) => stateOf(p) !== "writing");

  // Copy saved before the writers ran shows as its own card next to theirs.
  const showCurrent = !!versions.current && !WRITERS.some((w) => versions[w.id]);

  // ── Post ──
  const needsApproval = requireApproval && video.compliance !== "approved";
  const router = useRouter();
  const saveDraft = () => {
    updateVideo(video.id, { status: "draft" });
    toast.success("Saved as a draft", { description: "It’s in Videos → Drafts. Nothing has been posted." });
    router.push("/videos?filter=drafts");
  };

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 pb-28">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight text-balance sm:text-[40px]">{["Pick a cover.", "Say it once, everywhere.", requireApproval ? "Approve it, then post it." : "We post it, or you do."][sub]}</h1>
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

      {sub === 0 && <CoverStudio video={video} intro={intro} onDone={() => setSub(1)} />}

      {sub === 1 && (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{asked ? "Where it’s going" : "1. Choose where it’s going"}</h2>
              <span className="text-[12px] text-muted-foreground">{asked ? "Add a platform anytime: only the new one is written." : "Pick every platform you want a caption for. Nothing is written until you say so."}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Platforms">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                const st = on && asked ? stateOf(p.id) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatforms(on ? platforms.filter((x) => x !== p.id) : [...platforms, p.id])}
                    aria-pressed={on}
                    data-state={st ?? undefined}
                    className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors", !on ? "border-border text-muted-foreground hover:text-foreground" : st === "failed" ? "border-destructive/60 bg-destructive/5" : "border-primary bg-brass-soft/70")}
                    style={{ ["--pi-bg" as string]: on ? "var(--brass-soft)" : "var(--background)" }}
                  >
                    <PlatformIcon id={p.id} className="size-3.5" /> {p.label}
                    {st === "ready" && <Check className="size-3.5 text-success" aria-label="Caption ready" />}
                    {st === "writing" && <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label="Writing" />}
                    {st === "failed" && <TriangleAlert className="size-3.5 text-destructive" aria-label="Failed" />}
                    {st === "none" && <span className="text-[11px] text-muted-foreground">no caption yet</span>}
                  </button>
                );
              })}
            </div>
            {!asked ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-[13px] text-muted-foreground">{platforms.length ? `2. Captions for ${platforms.map((p) => getPlatform(p).label).join(", ")}, in four versions to choose from.` : "Pick at least one platform."}</span>
                <Button className="rounded-full px-6" onClick={writeAll} disabled={!platforms.length || busy}><Sparkles /> Generate captions</Button>
              </div>
            ) : toWrite.length > 0 ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className={cn("text-[13px]", toWrite.some((p) => stateOf(p) === "failed") ? "text-destructive" : "text-muted-foreground")}>
                  {toWrite.some((p) => stateOf(p) === "failed") ? `Couldn’t write ${toWrite.filter((p) => stateOf(p) === "failed").map((p) => getPlatform(p).label).join(", ")}: ${errorOf(toWrite.find((p) => stateOf(p) === "failed")!) ?? "something went wrong"}` : `No caption yet for ${toWrite.map((p) => getPlatform(p).label).join(", ")}.`} Your other captions stay as they are.
                </span>
                <Button className="rounded-full px-5" onClick={() => writeMissing()}><Sparkles /> {toWrite.some((p) => stateOf(p) === "failed") ? "Try again" : `Generate ${toWrite.length === 1 ? `the ${getPlatform(toWrite[0]).label} caption` : `${toWrite.length} captions`}`}</Button>
              </div>
            ) : null}
          </div>

          {asked && (
          <>
          <div className={cn("grid grid-cols-2 gap-2", showCurrent ? "sm:grid-cols-3 lg:grid-cols-5" : "lg:grid-cols-4")}>
            {showCurrent && (
              <VersionCard className="col-span-2 sm:col-span-1" label="Current" description="The copy saved with this video." selected={writer === "current"} onClick={() => choose("current")} preview={versions.current?.copies[0]?.description} />
            )}
            {WRITERS.map((w) => (
              <VersionCard key={w.id} label={w.label} description={w.description} selected={writer === w.id} onClick={() => choose(w.id)} preview={(versions[w.id]?.copies.find((c) => c.platform === "linkedin") ?? versions[w.id]?.copies[0])?.description} run={runs[w.id]} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {copies.length > 0 && <RequestLine items={[`${platforms.length} ${platforms.length === 1 ? "platform" : "platforms"}`, video.source === "upload" || video.source === "clip" ? "From what you said in the video" : "From your script", "Your voice profile", `Disclosure ${activeDisclosure(profile)?.version ?? "not set"} (auto)`]} source={busy ? null : "claude"} />}
            {copies.length > 0 && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => window.confirm("Write four new versions for every platform? This replaces the captions you have, including your edits.") && writeAll()} disabled={busy}><RefreshCw className={cn(busy && "animate-spin")} /> Write four new versions</Button>}
          </div>

          {!copies.length ? (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
              {busy ? (
                <>
                  <Writing status={runs[writer]?.status || Object.values(runs).find((r) => r && !r.error)?.status || "Writing…"} />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : (
                <div className="text-center">
                  <p className="text-[14px] text-destructive">{Object.values(runs).find((r) => r?.error)?.error ?? "The captions weren’t written."}</p>
                  <Button className="mt-4 rounded-full" onClick={writeAll} disabled={!platforms.length}><RefreshCw /> Try again</Button>
                </div>
              )}
            </div>
          ) : (
            <div className={cn("grid items-start gap-6", video.output && "lg:grid-cols-[minmax(0,1fr)_auto]")}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
                <span className="font-serif text-[18px]">{writer === "current" ? "Current" : getWriter(writer).label}</span>
                {current?.note && <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{current.note}</span>}
              </div>
              <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border px-3 pt-3">
                {platforms.map((p) => {
                  const st = stateOf(p);
                  return (
                    <button
                      key={p}
                      onClick={() => setTab(p)}
                      className={cn("-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13px]", p === activeTab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
                      style={{ ["--pi-bg" as string]: "var(--card)" }}
                    >
                      <PlatformIcon id={p} className="size-3.5" /> {getPlatform(p).label}
                      {st === "writing" && <LoaderCircle className="size-3 animate-spin" />}
                      {st === "failed" && <TriangleAlert className="size-3 text-destructive" />}
                      {st === "none" && <span className="size-1.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
              {activeTab && (() => {
                const st = stateOf(activeTab);
                const label = getPlatform(activeTab).label;
                if (st === "ready") return <div className={cn(runs[writer] && !runs[writer]!.error && runs[writer]!.platforms.includes(activeTab) && "opacity-60")}><CaptionEditor platform={activeTab} bookingUrl={bookingUrlFor(video, profile)} copy={copies.find((c) => c.platform === activeTab)} update={(patch) => updateCopy(activeTab, patch)} /></div>;
                return (
                  <div className="space-y-3 p-8 text-center" data-caption-state={st}>
                    {st === "writing" ? (
                      <><Writing status={`Writing your ${label} caption…`} /><Skeleton className="mx-auto h-20 w-full max-w-md" /></>
                    ) : st === "failed" ? (
                      <>
                        <p className="text-[14px] text-destructive"><TriangleAlert className="mr-1.5 inline size-4 align-[-3px]" />The {label} caption wasn’t written: {errorOf(activeTab) ?? "something went wrong"}</p>
                        <Button className="rounded-full" onClick={() => writeMissing([activeTab])}><RefreshCw /> Try {label} again</Button>
                      </>
                    ) : (
                      <>
                        <p className="text-[14px] text-muted-foreground">No {label} caption yet. Your other captions won’t change.</p>
                        <Button className="rounded-full" onClick={() => writeMissing([activeTab])}><Sparkles /> Generate the {label} caption</Button>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            {video.output && (
              <div className="flex flex-col items-center gap-2 lg:sticky lg:top-28">
                <PhonePreview
                  src={video.output.url}
                  aspect={video.output.aspect}
                  seed={video.id}
                  name={profile.name}
                  avatar={profile.headshots.find((x) => x.url)?.url}
                  caption={(() => {
                    const c = copies.find((x) => x.platform === activeTab);
                    return c && activeTab ? composeCaption(c, activeTab, profile, bookingUrlFor(video, profile)) : video.title;
                  })()}
                />
                <CoverIntroStatus intro={intro} />
              </div>
            )}
            </div>
          )}

          {current && current.taglines.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <div className="eyebrow">Taglines</div>
              <p className="mt-1 text-[13px] text-muted-foreground">One-liners for an opening line, a pinned comment, on-screen text or a headline. Pick one to keep with the post.</p>
              <ul className="mt-4 space-y-2">
                {current.taglines.map((t) => (
                  <li key={t} className={cn("flex items-center gap-3 rounded-xl border px-4 py-3", tagline === t ? "border-primary bg-brass-soft/50" : "border-border")}>
                    <button onClick={() => setTagline(tagline === t ? "" : t)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" aria-pressed={tagline === t}>
                      <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", tagline === t ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{tagline === t && <Check className="size-3" />}</span>
                      <span className="font-serif text-[16px] leading-snug">{t}</span>
                    </button>
                    <CopyButton text={t} label="Tagline" className="size-8" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          </>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" className="rounded-full" onClick={() => setSub(0)}><ArrowLeft /> Cover</Button>
            <div className="flex items-center gap-3">
              {asked && copies.length > 0 && missing.length > 0 && !busy && <span className="hidden text-[12px] text-muted-foreground sm:inline">Generate or remove {missing.map((m) => getPlatform(m).label).join(", ")} to continue</span>}
              <Button className="rounded-full px-6" disabled={!copies.length || busy || missing.length > 0 || !platforms.length} onClick={() => setSub(2)}>Post <ArrowRight /></Button>
            </div>
          </div>
          {copies.length > 0 && <AskBar busy={!!runs[writer] && !runs[writer]!.error} status={runs[writer]?.status} note={null} onAsk={revise} suggestions={["Shorter LinkedIn post", "Add a question at the end", "More formal"]} />}
        </>
      )}

      {sub === 2 && (
        <>
          {needsApproval ? (
            <ApprovalGate
              status={video.compliance}
              onSubmit={() => { submitForReview(video.id); toast.success("Sent for approval", { description: reviewer ? `${reviewer} has it.` : "It’s in the Approve queue." }); }}
              onSaveDraft={saveDraft}
            />
          ) : (
            <>
              <TeamPost video={video} platforms={platforms} copies={copies} tagline={tagline} />
              <div className="space-y-4 border-t border-border pt-8">
                <div>
                  <h2 className="font-serif text-2xl">Or post it yourself.</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">From your connected accounts, now or on a schedule. Or download the MP4, copy each caption, and upload it by hand.</p>
                </div>
                <DirectPost video={video} platforms={platforms} copies={copies} />
                <ShareKit video={video} platforms={platforms} copies={copies} tagline={tagline} />
              </div>
              <div className="flex">
                <Button variant="ghost" className="rounded-full" onClick={() => setSub(1)}><ArrowLeft /> Caption</Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CaptionEditor({ platform, copy, bookingUrl, update }: { platform: PlatformId; copy?: PlatformCopy; bookingUrl?: string; update: (p: Partial<PlatformCopy>) => void }) {
  const { profile } = useStore();
  const p = getPlatform(platform);
  if (!copy) return <div className="p-8 text-center text-[14px] text-muted-foreground">No copy for {p.label} yet.</div>;
  const locked = disclosureFor(platform, profile);
  // Everything that goes out: caption, calendar link, hashtags and disclosure.
  const total = composeCaption(copy, platform, profile, bookingUrl).length;
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
      {bookingUrl && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border p-4 text-[13px]">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate">{BOOKING_LINE} <span className="text-primary">{bookingUrl}</span></div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">Added to the caption automatically. Switch it off for this video in <span className="font-medium">Edit → Calendar link</span>.</div>
          </div>
        </div>
      )}
      <div className="rounded-xl bg-brass-soft/60 p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#7d6238] uppercase dark:text-primary"><Lock className="size-3" /> Disclosure · {activeDisclosure(profile)?.version ?? "not set"} · added automatically</div>
        <p className="text-[12px] leading-relaxed whitespace-pre-line text-foreground/75 select-none">{locked}</p>
      </div>
    </div>
  );
}

function ApprovalGate({ status, onSubmit, onSaveDraft }: { status: string; onSubmit: () => void; onSaveDraft: () => void }) {
  const waiting = status === "submitted";
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brass-soft"><ShieldCheck className="size-6 text-primary" /></div>
      <h2 className="mt-5 font-serif text-2xl">{waiting ? "With your reviewer." : status === "changes_requested" ? "Your reviewer asked for changes." : "One approval before it goes out."}</h2>
      <p className="mt-2 text-[14px] text-muted-foreground">
        {waiting ? "You’ll be notified the moment it’s approved. Then it’s one click to send it to the team." : status === "changes_requested" ? "Make the edits, then send it back." : "Your reviewer sees the script, the captions and the disclosure together."}
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
        <button onClick={onSaveDraft} className="cursor-pointer text-muted-foreground hover:text-foreground">Not ready? Save it as a draft</button>
      </div>
    </div>
  );
}
