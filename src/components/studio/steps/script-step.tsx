"use client";

import * as React from "react";
import { ArrowRight, AudioLines, Mic, Monitor, Paperclip, Smartphone, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, useWriter } from "@/lib/ai/writer";
import { estimateRuntime } from "@/lib/ai/content";
import type { Script, VideoFormat } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { AskBar, RequestLine, Writing } from "../ask-bar";
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

export function ScriptStep({ video, complete }: StepProps) {
  const { profile } = useStore();
  const [format, setFormat] = useDraft<VideoFormat>(video.id, "script.format", video.format);
  const [script, setScript] = useDraft<Script | null>(video.id, "script.value", video.script ?? null);
  const [context, setContext] = useDraft(video.id, "script.context", "");
  const [memo, setMemo] = useDraft<{ secs: number } | null>(video.id, "script.memo", null);
  const [files, setFiles] = useDraft<string[]>(video.id, "script.files", []);
  const [note, setNote] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [recSecs, setRecSecs] = React.useState(0);
  const { write, busy, status, source } = useWriter();

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const run = async (instruction?: string) => {
    try {
      const ctx = [context, memo ? "(The advisor recorded a voice memo; transcription arrives with the Captions integration.)" : "", files.length ? `Attached files: ${files.join(", ")}` : ""].filter(Boolean).join("\n");
      const out = await write({
        task: "script",
        profile: voiceProfileOf(profile),
        format,
        idea: { title: video.title, outline: video.outline.length ? video.outline : [video.title] },
        context: ctx || undefined,
        current: instruction && script ? script : undefined,
        instruction,
      });
      setScript({ hook: out.hook, body: out.body, cta: out.cta });
      setNote(out.note);
    } catch (e) {
      if (isAbort(e)) return;
      toast.error("Couldn’t write the script", { description: (e as Error).message });
    }
  };

  const runtime = script ? estimateRuntime(script) : 0;
  const target = format === "short" ? 60 : 600;
  const contextCount = (context ? 1 : 0) + (memo ? 1 : 0) + files.length;

  return (
    <div className="space-y-8 pb-28">
      <StepIntro title={video.title} subtitle={script ? `Click any line to edit it. Ask ${BRAND.name} for bigger changes.` : `${BRAND.name} writes it in your voice. You make it yours.`} />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)} className="rounded-full">
          <ToggleGroupItem value="short" className="rounded-full"><Smartphone /> Short · 9:16</ToggleGroupItem>
          <ToggleGroupItem value="long" className="rounded-full"><Monitor /> Long · 16:9</ToggleGroupItem>
        </ToggleGroup>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <Paperclip /> Add context {contextCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tnum">{contextCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-4">
            <div>
              <div className="mb-1.5 text-[12px] font-medium">Notes for {BRAND.name}</div>
              <Textarea rows={3} value={context} onChange={(e) => setContext(e.target.value)} placeholder="A story, a client question, a stat you trust…" className="text-[13px]" />
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium">Voice memo</div>
              {memo ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[13px]">
                  <AudioLines className="size-4 text-primary" /> Memo · <span className="tnum">{fmtDuration(memo.secs)}</span>
                  <button className="ml-auto cursor-pointer" onClick={() => setMemo(null)} aria-label="Remove memo"><X className="size-3.5" /></button>
                </div>
              ) : recording ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setRecording(false); setMemo({ secs: Math.max(1, recSecs) }); }}>
                  <Square className="size-3 text-destructive" /> Stop · <span className="tnum">{fmtDuration(recSecs)}</span>
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setRecSecs(0); setRecording(true); }}><Mic /> Record a memo</Button>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium">Files</div>
              {files.map((f) => (
                <div key={f} className="mb-1 flex items-center gap-2 text-[13px]"><Paperclip className="size-3.5 text-muted-foreground" />{f}<button className="ml-auto cursor-pointer" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove ${f}`}><X className="size-3.5" /></button></div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setFiles([...files, ["planning-notes.pdf", "client-faq.docx", "irs-notice.pdf"][files.length % 3]])}><Paperclip /> Attach a file</Button>
            </div>
          </PopoverContent>
        </Popover>
        {script && (
          <span className="ml-auto flex items-center gap-3 text-[13px] text-muted-foreground">
            <span className={cn("tnum", runtime > target && "text-destructive")}>{fmtDuration(runtime)} / {fmtDuration(target)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">Sounds like you · <span className="tnum">92%</span></span>
          </span>
        )}
      </div>

      {(busy || script) && (
        <RequestLine items={[format === "short" ? "Short-form" : "Long-form", `Idea: ${video.title.slice(0, 40)}${video.title.length > 40 ? "…" : ""}`, "Your voice profile", memo ? "Voice memo" : "No voice memo", files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "No files"]} source={busy ? null : source} />
      )}

      {busy && !script ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
          <Writing status={status} />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : !script ? (
        <div className="rounded-2xl border border-dashed border-border px-8 py-14 text-center">
          <p className="font-serif text-2xl">Ready when you are.</p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] text-muted-foreground">A hook that lands in three seconds, a body written for the ear, and a calm close.</p>
          <Button className="mt-6 rounded-full px-6" onClick={() => run()}><Sparkles /> Write the script</Button>
        </div>
      ) : (
        <article className={cn("rounded-2xl border border-border bg-card px-6 py-8 shadow-soft sm:px-12 sm:py-12", busy && "opacity-60")}>
          <div className="mb-2 text-[11px] font-medium tracking-[0.14em] text-primary uppercase">Hook</div>
          <Editable value={script.hook} onChange={(v) => setScript({ ...script, hook: v })} className="font-serif text-[24px] leading-snug" />
          <div className="mt-8 mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Body</div>
          <div className="space-y-3">
            {script.body.map((b, i) => (
              <Editable key={i} value={b} onChange={(v) => setScript({ ...script, body: script.body.map((x, j) => (j === i ? v : x)) })} className="text-[17px] leading-relaxed" />
            ))}
          </div>
          <div className="mt-8 mb-2 text-[11px] font-medium tracking-[0.14em] text-success uppercase">Close</div>
          <Editable value={script.cta} onChange={(v) => setScript({ ...script, cta: v })} className="text-[17px] leading-relaxed italic" />
        </article>
      )}

      {script && (
        <div className="flex justify-end">
          <Button className="rounded-full px-6" onClick={() => complete({ script, format, runtimeSec: runtime })}>Record it <ArrowRight /></Button>
        </div>
      )}

      {script && <AskBar busy={busy} status={status} note={note} onAsk={(t) => run(t)} suggestions={["Shorter", "Punchier hook", "More formal", "Add a reframe"]} />}
    </div>
  );
}
