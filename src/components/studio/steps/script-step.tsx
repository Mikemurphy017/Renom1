"use client";

import * as React from "react";
import { ArrowRight, Check, LoaderCircle, Monitor, Paperclip, RefreshCw, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, streamWrite } from "@/lib/ai/writer";
import { WRITERS, getWriter, type WriterId } from "@/lib/ai/writers";
import { estimateRuntime } from "@/lib/ai/content";
import type { Script, VideoFormat } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { AskBar, Writing } from "../ask-bar";
import { StepIntro } from "../step-layout";
import type { StepProps } from "../studio-view";
import { BRAND } from "@/lib/brand";

function Editable({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={cn("block w-full resize-none overflow-hidden rounded-lg bg-transparent px-2 py-1 -mx-2 outline-none transition-colors hover:bg-muted/50 focus:bg-muted/60", className)}
    />
  );
}

type Drafts = Partial<Record<WriterId | "current", Script>>;
type Run = { status: string; error?: string };

export function ScriptStep({ video, complete }: StepProps) {
  const { profile } = useStore();
  const [format, setFormat] = useDraft<VideoFormat>(video.id, "script.format", video.format);
  // Four versions, one per writer. A script saved before versions existed shows as "Current".
  const [drafts, setDrafts] = useDraft<Drafts>(video.id, "script.drafts", () => (video.script ? { current: video.script } : {}));
  const [chosen, setChosen] = useDraft<WriterId | "current">(video.id, "script.writer", video.script ? "current" : "story");
  const [context, setContext] = useDraft(video.id, "script.context", "");
  const [notes, setNotes] = React.useState<Partial<Record<WriterId, string>>>({});
  const [runs, setRuns] = React.useState<Partial<Record<WriterId, Run>>>({});
  const ctrl = React.useRef<AbortController | null>(null);
  const draftsRef = React.useRef(drafts);
  draftsRef.current = drafts;
  React.useEffect(() => () => ctrl.current?.abort(), []);

  const busyIds = (Object.keys(runs) as WriterId[]).filter((id) => runs[id] && !runs[id]!.error);
  const busy = busyIds.length > 0;
  const script = drafts[chosen] ?? null;

  const writeOne = async (id: WriterId, signal: AbortSignal, instruction?: string, current?: Script) => {
    setRuns((r) => ({ ...r, [id]: { status: "Starting…" } }));
    try {
      const ctx = context.trim();
      const out = await streamWrite(
        {
          task: "script",
          profile: voiceProfileOf(profile),
          format,
          writer: id,
          idea: { title: video.title, outline: video.outline.length ? video.outline : [video.title] },
          context: ctx || undefined,
          current: instruction && current ? current : undefined,
          instruction,
        },
        { signal, onStatus: (status) => setRuns((r) => ({ ...r, [id]: { status } })) }
      );
      setDrafts((d) => ({ ...d, [id]: { hook: out.hook, body: out.body, cta: out.cta } }));
      setNotes((n) => ({ ...n, [id]: out.note }));
      setRuns((r) => {
        const next = { ...r };
        delete next[id];
        return next;
      });
      // Show the first version that arrives if nothing is open yet.
      setChosen((c) => (draftsRef.current[c] ? c : id));
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
    if (!script) return;
    const id: WriterId = chosen === "current" ? "story" : chosen;
    const c = new AbortController();
    ctrl.current = c;
    void writeOne(id, c.signal, instruction, script).then(() => setChosen(id));
  };

  const setScript = (next: Script) => setDrafts((d) => ({ ...d, [chosen]: next }));
  const runtime = script ? estimateRuntime(script) : 0;
  const target = format === "short" ? 90 : 600;
  const contextCount = context.trim() ? 1 : 0;
  const anyDraft = WRITERS.some((w) => drafts[w.id]) || !!drafts.current;
  const failed = (Object.values(runs) as Run[]).find((r) => r?.error);

  return (
    <div className="space-y-8 pb-28">
      <StepIntro title={video.title} subtitle={anyDraft ? "Four writers, four takes on the same idea. Pick the one that sounds like you, then make it yours." : `${BRAND.name} writes four versions in your voice, each with its own approach.`} />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)} className="rounded-full">
          <ToggleGroupItem value="short" className="rounded-full"><Smartphone /> Short · 9:16</ToggleGroupItem>
          <ToggleGroupItem value="long" className="rounded-full"><Monitor /> Long · 16:9</ToggleGroupItem>
        </ToggleGroup>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <Paperclip /> Add notes {contextCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tnum">{contextCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-4">
            <div>
              <div className="mb-1.5 text-[12px] font-medium">Notes for {BRAND.name}</div>
              <Textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder="A story, a client question, a stat you trust…" className="text-[13px]" />
            </div>
          </PopoverContent>
        </Popover>
        {anyDraft && (
          <Button variant="ghost" size="sm" className="rounded-full" disabled={busy} onClick={writeAll}>
            <RefreshCw className={cn(busy && "animate-spin")} /> Write four new versions
          </Button>
        )}
      </div>

      {!anyDraft && !busy ? (
        <div className="rounded-2xl border border-dashed border-border px-8 py-14 text-center">
          <p className="font-serif text-2xl">Ready when you are.</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">Four complete scripts, each from a different writer: a story, an insight, a case and a reframe. Each one reads as a single, connected narrative.</p>
          <Button className="mt-6 rounded-full px-6" onClick={writeAll}><Sparkles /> Write the scripts</Button>
          {failed?.error && <p className="mt-3 text-[13px] text-destructive">{failed.error}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {drafts.current && !WRITERS.some((w) => drafts[w.id]) && (
              <VersionCard label="Current" description="The script saved with this video." selected={chosen === "current"} onClick={() => setChosen("current")} script={drafts.current} />
            )}
            {WRITERS.map((w) => (
              <VersionCard key={w.id} label={w.label} description={w.description} selected={chosen === w.id} onClick={() => drafts[w.id] && setChosen(w.id)} script={drafts[w.id]} run={runs[w.id]} />
            ))}
          </div>

          {script ? (
            <article className={cn("rounded-2xl border border-border bg-card px-5 py-7 shadow-soft sm:px-12 sm:py-12", runs[chosen as WriterId] && "opacity-60")}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <span className="font-serif text-[18px]">{chosen === "current" ? "Current" : getWriter(chosen).label}</span>
                <span className={cn("text-[13px] tnum", runtime > target * 1.15 ? "text-destructive" : "text-muted-foreground")}>{fmtDuration(runtime)} of about {fmtDuration(target)}</span>
              </div>
              {chosen !== "current" && notes[chosen] && <p className="-mt-3 mb-6 text-[13px] text-muted-foreground">{notes[chosen]}</p>}
              <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-primary uppercase">Opening</div>
              <Editable value={script.hook} onChange={(v) => setScript({ ...script, hook: v })} className="font-serif text-[22px] leading-snug sm:text-[24px]" />
              <div className="mt-8 space-y-4">
                {script.body.map((b, i) => (
                  <Editable key={i} value={b} onChange={(v) => setScript({ ...script, body: script.body.map((x, j) => (j === i ? v : x)) })} className="text-[17px] leading-relaxed" />
                ))}
              </div>
              <div className="mt-8 mb-2 text-[11px] font-medium tracking-[0.14em] text-success uppercase">Close</div>
              <Editable value={script.cta} onChange={(v) => setScript({ ...script, cta: v })} className="text-[17px] leading-relaxed italic" />
            </article>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
              <Writing status={runs[chosen as WriterId]?.status ?? "Writing…"} />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {script && (
            <div className="flex justify-end">
              <Button className="rounded-full px-6" onClick={() => complete({ script, format, runtimeSec: runtime })}>Record this one <ArrowRight /></Button>
            </div>
          )}
        </>
      )}

      {script && <AskBar busy={!!runs[chosen as WriterId]} status={runs[chosen as WriterId]?.status} note={null} onAsk={revise} suggestions={["Tighter", "Warmer", "More formal", "Clearer close"]} />}
    </div>
  );
}

function VersionCard({ label, description, selected, onClick, script, run }: { label: string; description: string; selected: boolean; onClick: () => void; script?: Script; run?: Run }) {
  const ready = !!script && !run;
  return (
    <button
      onClick={onClick}
      disabled={!script}
      className={cn(
        "flex min-h-[112px] flex-col rounded-2xl border p-3.5 text-left transition-colors sm:p-4",
        selected && script ? "border-primary bg-brass-soft/60 shadow-soft" : "border-border bg-card",
        script ? "cursor-pointer hover:border-primary/50" : "cursor-default"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-serif text-[16px]">{label}</span>
        {selected && ready && <Check className="size-4 text-primary" />}
      </span>
      <span className="mt-1 text-[12px] leading-snug text-muted-foreground">{description}</span>
      <span className="mt-auto pt-2 text-[11px] text-muted-foreground tnum">
        {run?.error ? <span className="text-destructive">Couldn’t write this one</span> : run ? <span className="inline-flex items-center gap-1"><LoaderCircle className="size-3 animate-spin text-primary" /> {run.status}</span> : script ? `${fmtDuration(estimateRuntime(script))} · ${script.body.length + 2} paragraphs` : "Waiting…"}
      </span>
    </button>
  );
}
