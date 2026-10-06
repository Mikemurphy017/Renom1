"use client";

import * as React from "react";
import { ArrowRight, AudioLines, FileText, Mic, Paperclip, ScrollText, Sparkles, Square, Upload, X, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/page";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useAgentSession } from "@/components/agent/use-agent";
import { useStore } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { estimateRuntime, generateScript } from "@/lib/ai/content";
import type { Script, VideoFormat } from "@/lib/types";
import { cn, fmtDuration } from "@/lib/utils";
import { StepLayout, StepSection, FieldLabel } from "../step-layout";
import type { StepProps } from "../studio-view";

function AutoTextarea({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
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
      className={cn("block w-full resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[14px] leading-relaxed outline-none hover:border-border focus:border-ring focus:bg-card", className)}
    />
  );
}

function ScriptSection({ label, tone, children }: { label: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 border-b border-border py-4 last:border-0">
      <div className="pt-2">
        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase", tone)}>{label}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function ScriptStep({ video, complete }: StepProps) {
  const { videos } = useStore();
  const [format, setFormat] = useDraft<VideoFormat>(video.id, "script.format", video.format);
  const [source, setSource] = useDraft(video.id, "script.source", video.id);
  const [custom, setCustom] = useDraft(video.id, "script.custom", "");
  const [memo, setMemo] = useDraft<{ name: string; secs: number } | null>(video.id, "script.memo", null);
  const [files, setFiles] = useDraft<string[]>(video.id, "script.files", []);
  const [script, setScript] = useDraft<Script | null>(video.id, "script.value", video.script ?? null);
  const [recording, setRecording] = React.useState(false);
  const [recSecs, setRecSecs] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const { turns, busy, run } = useAgentSession();

  React.useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const ideaOptions = videos.filter((v) => v.status !== "published" && v.outline.length);
  const ideaTitle = source === "custom" ? custom : videos.find((v) => v.id === source)?.title ?? video.title;

  const generate = () => {
    if (!ideaTitle.trim()) return toast.error("Add an idea first");
    setPending(true);
    run(
      {
        task: "script",
        summary: {
          "Content Type": format === "short" ? "Short-form" : "Long-form",
          "Video Idea": ideaTitle,
          "Use Profile": "Yes",
          "Voice Memo": memo ? `${memo.name} (${fmtDuration(memo.secs)})` : "None",
          "Files Uploaded": files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : "None",
        },
      },
      {
        onDone: () => {
          setScript(generateScript(ideaTitle, format));
          setPending(false);
        },
      }
    );
  };

  const runtime = script ? estimateRuntime(script) : 0;
  const target = format === "short" ? 60 : 600;

  return (
    <StepLayout
      panel={
        <AgentPanel
          turns={turns}
          busy={busy}
          onSend={(t) => run({ task: "chat", summary: {}, prompt: t, context: { step: "script" } })}
          suggestions={script ? ["Make it shorter", "Punchier hook", "More formal"] : []}
          emptyHint="Choose a format and idea, add a voice memo if you like, then generate."
        />
      }
    >
      <StepSection title="Script brief">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <FieldLabel>Format</FieldLabel>
            <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)}>
              <ToggleGroupItem value="short"><Smartphone /> Short-form · 9:16</ToggleGroupItem>
              <ToggleGroupItem value="long"><Monitor /> Long-form · 16:9</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <FieldLabel>Idea</FieldLabel>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ideaOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.id === video.id ? `This video — ${v.title}` : v.title}</SelectItem>
                ))}
                <SelectItem value="custom">Type a new idea…</SelectItem>
              </SelectContent>
            </Select>
            {source === "custom" && <Input className="mt-2" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What should this video cover?" />}
          </div>
          <div>
            <FieldLabel hint="Optional">Voice memo</FieldLabel>
            {memo ? (
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 text-[13px]">
                <AudioLines className="size-4 text-primary" />
                <span className="flex-1 truncate">{memo.name}</span>
                <span className="text-muted-foreground tnum">{fmtDuration(memo.secs)}</span>
                <button className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setMemo(null)} aria-label="Remove memo"><X className="size-3.5" /></button>
              </div>
            ) : recording ? (
              <div className="flex h-9 items-center gap-3 rounded-md border border-destructive/30 bg-warning-soft px-3 text-[13px]">
                <span className="size-2 animate-pulse rounded-full bg-[#B3261E]" />
                <span className="text-destructive tnum">Recording {fmtDuration(recSecs)}</span>
                <Button size="xs" variant="outline" className="ml-auto" onClick={() => { setRecording(false); setMemo({ name: "Voice memo", secs: Math.max(recSecs, 1) }); }}>
                  <Square className="size-3" /> Stop
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setRecSecs(0); setRecording(true); }}><Mic /> Record</Button>
                <Button variant="outline" size="sm" onClick={() => setMemo({ name: "memo-oct-06.m4a", secs: 94 })}><Upload /> Upload</Button>
              </div>
            )}
          </div>
          <div>
            <FieldLabel hint="Optional · PDFs, notes, articles">Files</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              {files.map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-[12px]">
                  <FileText className="size-3.5 text-muted-foreground" /> {f}
                  <button className="cursor-pointer" onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} aria-label={`Remove ${f}`}><X className="size-3" /></button>
                </span>
              ))}
              <Button variant="outline" size="sm" onClick={() => setFiles((fs) => [...fs, ["2026-planning-notes.pdf", "client-faq.docx", "irs-notice-2026-41.pdf"][fs.length % 3]])}>
                <Paperclip /> Attach
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <Button onClick={generate} disabled={busy}><Sparkles /> {script ? "Rewrite script" : "Write script"}</Button>
        </div>
      </StepSection>

      <StepSection
        title="Script"
        action={
          script && (
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("text-[12px] tnum", runtime > target ? "text-destructive" : "text-muted-foreground")}>
                Est. runtime <span className="font-medium text-foreground">{fmtDuration(runtime)}</span> / {fmtDuration(target)}
              </span>
              <VoiceMatch score={92} />
            </div>
          )
        }
      >
        {pending ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[72px_1fr] gap-3">
                <Skeleton className="h-4 w-12" />
                <div className="space-y-2"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-5/6" /></div>
              </div>
            ))}
          </div>
        ) : !script ? (
          <EmptyState icon={ScrollText} title="No script yet" description="Renom writes a hook, body and call to action in your voice — then you edit inline." action={<Button onClick={generate}><Sparkles /> Write script</Button>} />
        ) : (
          <>
            <ScriptSection label="Hook" tone="bg-brass-soft text-[#7d6238] dark:text-primary">
              <AutoTextarea value={script.hook} onChange={(v) => setScript({ ...script, hook: v })} className="font-serif text-[17px]" />
            </ScriptSection>
            <ScriptSection label="Body" tone="bg-secondary text-secondary-foreground">
              {script.body.map((b, i) => (
                <AutoTextarea key={i} value={b} onChange={(v) => setScript({ ...script, body: script.body.map((x, j) => (j === i ? v : x)) })} />
              ))}
            </ScriptSection>
            <ScriptSection label="CTA" tone="bg-success-soft text-success">
              <AutoTextarea value={script.cta} onChange={(v) => setScript({ ...script, cta: v })} />
            </ScriptSection>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => toast.success("Script saved")}>Save draft</Button>
              <Button onClick={() => complete({ script, format, runtimeSec: runtime })}>Continue to Descriptions <ArrowRight /></Button>
            </div>
          </>
        )}
      </StepSection>
    </StepLayout>
  );
}

function VoiceMatch({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success" title="Compared against your sample writing and past transcripts">
      <span className="flex items-end gap-px">
        {[3, 5, 7, 9, 11].map((h, i) => (
          <span key={i} className={cn("w-[3px] rounded-sm", i < Math.round(score / 20) ? "bg-success" : "bg-success/25")} style={{ height: h }} />
        ))}
      </span>
      Sounds like you · <span className="tnum">{score}%</span>
    </span>
  );
}
