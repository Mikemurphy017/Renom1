"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Check, Hash, Lock, RefreshCw, Send, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
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
import { activeDisclosure, disclosureFor } from "@/lib/compose";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import type { PlatformId } from "@/lib/types";
import { cn, fmtNumber } from "@/lib/utils";
import { AskBar, RequestLine, Writing } from "../ask-bar";
import { CopyButton } from "./share-kit";
import { CoverStudio } from "./cover-studio";
import { ShareKit } from "./share-kit";
import { TeamPost } from "./team-post";
import { DirectPost } from "./direct-post";
import type { StepProps } from "../studio-view";

const SUB = ["Cover", "Caption", "Post"] as const;

type Version = { copies: PlatformCopy[]; taglines: string[]; note: string };
type Versions = Partial<Record<WriterId | "current", Version>>;

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
        {run?.error ? <span className="text-destructive">Couldn’t write this one.</span> : run ? <span className="text-muted-foreground">{run.status}</span> : preview ? <span className="line-clamp-2 text-foreground/80">{preview.split("\n")[0]}</span> : null}
      </span>
    </button>
  );
}

export function PostStep({ video }: StepProps) {
  const { profile, updateVideo, requireApproval, submitForReview, reviewer } = useStore();
  const vertical = video.format === "short";
  const [sub, setSub] = useDraft(video.id, "post.sub", 0);

  // ── Platforms ──
  const defaultPlatforms: PlatformId[] = video.platforms.length ? video.platforms : vertical ? ["youtube_shorts", "instagram", "linkedin"] : ["youtube", "linkedin"];
  const [platforms, setPlatforms] = useDraft<PlatformId[]>(video.id, "post.platforms", defaultPlatforms);

  // ── Captions: four versions, one per writer (like the script) ──
  // `desc.copies` is the version being edited; the others wait in `desc.versions`.
  const [copies, setCopies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", []);
  const [versions, setVersions] = useDraft<Versions>(video.id, "desc.versions", () => (copies.length ? { current: { copies, taglines: [], note: "" } } : {}));
  const [writer, setWriter] = useDraft<WriterId | "current">(video.id, "desc.writer", copies.length ? "current" : "story");
  const [tagline, setTagline] = useDraft(video.id, "desc.tagline", "");
  const [runs, setRuns] = React.useState<Partial<Record<WriterId, { status: string; error?: string }>>>({});
  const [tab, setTab] = React.useState<PlatformId | null>(null);
  const activeTab = tab && platforms.includes(tab) ? tab : platforms[0];
  const ctrl = React.useRef<AbortController | null>(null);
  const writerRef = React.useRef(writer);
  writerRef.current = writer;
  React.useEffect(() => () => ctrl.current?.abort(), []);
  const busyIds = (Object.keys(runs) as WriterId[]).filter((id) => runs[id] && !runs[id]!.error);
  const busy = busyIds.length > 0;
  const current = versions[writer];

  const writeOne = async (id: WriterId, signal: AbortSignal, instruction?: string) => {
    setRuns((r) => ({ ...r, [id]: { status: "Starting…" } }));
    try {
      const base = writerRef.current === id ? copies : versions[id]?.copies;
      const out = await streamWrite(
        {
          task: "captions",
          profile: voiceProfileOf(profile),
          writer: id,
          platforms,
          video: { title: video.title, format: video.format, script: video.script, outline: video.outline },
          current: instruction && base ? base.map((c) => ({ platform: c.platform, title: c.title ?? null, description: c.description, hashtags: c.hashtags })) : undefined,
          instruction,
        },
        { signal, onStatus: (status) => setRuns((r) => ({ ...r, [id]: { status } })) }
      );
      const next: Version = {
        copies: out.captions.map((c) => ({ platform: c.platform, title: c.title ?? undefined, description: c.description, hashtags: c.hashtags, cta: "{{BOOKING_LINK}}" })),
        taglines: out.taglines.slice(0, 3),
        note: out.note,
      };
      setVersions((v) => ({ ...v, [id]: next }));
      // Open the first version that arrives, and refresh the one being edited.
      if (writerRef.current === id || !copies.length) {
        setWriter(id);
        setCopies(next.copies);
      }
      setRuns((r) => {
        const n = { ...r };
        delete n[id];
        return n;
      });
    } catch (e) {
      if (isAbort(e)) return;
      setRuns((r) => ({ ...r, [id]: { status: "", error: (e as Error).message } }));
    }
  };

  const writeAll = () => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    for (const w of WRITERS) void writeOne(w.id, c.signal);
  };

  const revise = (instruction: string) => {
    const id: WriterId = writer === "current" ? "story" : writer;
    const c = new AbortController();
    ctrl.current = c;
    void writeOne(id, c.signal, instruction);
  };

  const choose = (id: WriterId | "current") => {
    const v = versions[id];
    if (!v || id === writer) return;
    // Keep the edits made to the version being left.
    setVersions((vs) => ({ ...vs, [writer]: { ...(vs[writer] ?? { taglines: [], note: "" }), copies } }));
    setWriter(id);
    setCopies(v.copies);
  };

  React.useEffect(() => {
    if (sub === 1 && !copies.length && !busy && !WRITERS.some((w) => versions[w.id])) writeAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const updateCopy = (p: PlatformId, patch: Partial<PlatformCopy>) => {
    const next = copies.map((c) => (c.platform === p ? { ...c, ...patch } : c));
    setCopies(next);
    setVersions((vs) => (vs[writer] ? { ...vs, [writer]: { ...vs[writer]!, copies: next } } : vs));
  };
  const missing = platforms.filter((p) => !copies.some((c) => c.platform === p));

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

          <div className={cn("grid grid-cols-2 gap-2", showCurrent ? "sm:grid-cols-3 lg:grid-cols-5" : "lg:grid-cols-4")}>
            {showCurrent && (
              <VersionCard className="col-span-2 sm:col-span-1" label="Current" description="The copy saved with this video." selected={writer === "current"} onClick={() => choose("current")} preview={versions.current?.copies[0]?.description} />
            )}
            {WRITERS.map((w) => (
              <VersionCard key={w.id} label={w.label} description={w.description} selected={writer === w.id} onClick={() => choose(w.id)} preview={(versions[w.id]?.copies.find((c) => c.platform === "linkedin") ?? versions[w.id]?.copies[0])?.description} run={runs[w.id]} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {copies.length > 0 && <RequestLine items={[`${platforms.length} ${platforms.length === 1 ? "platform" : "platforms"}`, "From your script", "Your voice profile", `Disclosure ${activeDisclosure(profile)?.version ?? "not set"} (auto)`]} source={busy ? null : "claude"} />}
            <Button size="sm" variant="ghost" className="rounded-full" onClick={writeAll} disabled={busy}><RefreshCw className={cn(busy && "animate-spin")} /> Write four new versions</Button>
          </div>

          {!copies.length ? (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
              <Writing status={runs[writer as WriterId]?.status ?? Object.values(runs).find((r) => r && !r.error)?.status ?? "Writing…"} />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-24 w-full" />
              {Object.values(runs).some((r) => r?.error) && <p className="text-[13px] text-destructive">{Object.values(runs).find((r) => r?.error)?.error}</p>}
            </div>
          ) : (
            <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-soft", runs[writer as WriterId] && !runs[writer as WriterId]!.error && "opacity-60")}>
              <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
                <span className="font-serif text-[18px]">{writer === "current" ? "Current" : getWriter(writer).label}</span>
                {current?.note && <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{current.note}</span>}
              </div>
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

          {missing.length > 0 && copies.length > 0 && !busy && (
            <div className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              No copy yet for {missing.map((m) => getPlatform(m).label).join(", ")}.
              <Button size="sm" variant="outline" className="rounded-full" onClick={writeAll}><Sparkles /> Write all four again</Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" className="rounded-full" onClick={() => setSub(0)}><ArrowLeft /> Cover</Button>
            <Button className="rounded-full px-6" disabled={!copies.length || busy} onClick={() => setSub(2)}>Post <ArrowRight /></Button>
          </div>
          {copies.length > 0 && <AskBar busy={!!runs[writer as WriterId] && !runs[writer as WriterId]!.error} status={runs[writer as WriterId]?.status} note={null} onAsk={revise} suggestions={["Shorter LinkedIn post", "Add a question at the end", "More formal"]} />}
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
