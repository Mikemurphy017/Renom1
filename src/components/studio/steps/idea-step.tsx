"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Leaf, Newspaper, Plus, RefreshCw, ScrollText, Sparkles, TriangleAlert, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/page";
import { CategoryTag } from "@/components/shared/badges";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useAgentSession } from "@/components/agent/use-agent";
import { useStore } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { findDuplicate, generateIdeas, regenerateIdea, type GeneratedIdea } from "@/lib/ai/content";
import { StepLayout, StepSection } from "../step-layout";
import type { StepProps } from "../studio-view";

export function IdeaStep({ video, complete }: StepProps) {
  const { videos, addVideo } = useStore();
  const [mode, setMode] = useDraft<"evergreen" | "timely">(video.id, "idea.mode", video.mode);
  const [topic, setTopic] = useDraft(video.id, "idea.topic", "");
  const [ideas, setIdeas] = useDraft<GeneratedIdea[]>(video.id, "idea.list", []);
  const [round, setRound] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const { turns, busy, run } = useAgentSession();
  const others = videos.filter((v) => v.id !== video.id);

  const generate = () => {
    setPending(true);
    const next = round + 1;
    setRound(next);
    run(
      {
        task: "ideas",
        summary: {
          "Content Type": video.format === "short" ? "Short-form" : "Long-form",
          Mode: mode === "timely" ? "Timely" : "Evergreen",
          "Video Idea": topic || "Open — suggest ideas",
          "Use Profile": "Yes",
          "Voice Memo": "None",
          "Files Uploaded": "None",
        },
      },
      {
        onDone: () => {
          setIdeas(generateIdeas(mode, 3, next * 2 + (mode === "timely" ? 0 : 1)));
          setPending(false);
        },
      }
    );
  };

  const hasCurrent = video.outline.length > 0;

  return (
    <StepLayout
      panel={
        <AgentPanel
          turns={turns}
          busy={busy}
          onSend={(t) => run({ task: "chat", summary: {}, prompt: t, context: { step: "ideas" } })}
          suggestions={["More contrarian", "Aim at pre-retirees", "Tie to year-end"]}
          emptyHint="Pick Evergreen or Timely, then generate. I'll check your board for duplicates."
        />
      }
    >
      {hasCurrent && (
        <StepSection
          title="This video"
          action={
            <Button size="sm" onClick={() => complete()}>
              Continue to Thumbnail <ArrowRight />
            </Button>
          }
        >
          <h3 className="font-serif text-xl">{video.title}</h3>
          <div className="mt-1"><CategoryTag category={video.category} /></div>
          <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
            {video.outline.map((o) => (
              <li key={o} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{o}</li>
            ))}
          </ul>
        </StepSection>
      )}

      <StepSection title="Idea generator">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1.5 text-[12px] font-medium">Source</div>
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "evergreen" | "timely")}>
              <ToggleGroupItem value="evergreen"><Leaf /> Evergreen</ToggleGroupItem>
              <ToggleGroupItem value="timely"><Newspaper /> Timely</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="min-w-56 flex-1">
            <div className="mb-1.5 text-[12px] font-medium">Steer it <span className="font-normal text-muted-foreground">(optional)</span></div>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
              placeholder={mode === "timely" ? "e.g. this week's Fed decision" : "e.g. Roth conversions for early retirees"}
            />
          </div>
          <Button onClick={generate} disabled={busy}>
            <Sparkles /> {ideas.length ? "Generate more" : "Generate ideas"}
          </Button>
        </div>
        {mode === "timely" && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Timely mode pulls from market events and trending financial news (mocked for now). Timely videos are fast-tracked in the compliance queue.
          </p>
        )}
      </StepSection>

      {pending ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-5">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <EmptyState
            icon={Lightbulb}
            title="No ideas yet"
            description="Renom drafts ideas from your niche, opinions and ideal client — and checks your board for duplicates."
            action={<Button onClick={generate}><Sparkles /> Generate ideas</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {ideas.map((idea, i) => {
              const dup = findDuplicate(idea.title, others);
              return (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-soft"
                >
                  {idea.source && <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Newspaper className="size-3" />{idea.source}</div>}
                  <h3 className="font-serif text-[19px] leading-snug">{idea.title}</h3>
                  <div className="mt-1 text-[12px] text-muted-foreground">({idea.angle})</div>
                  <div className="mt-2"><CategoryTag category={idea.category} /></div>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[13px]">
                    {idea.outline.map((o) => (
                      <li key={o} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{o}</li>
                    ))}
                  </ul>
                  {dup && (
                    <div className="mt-4 flex gap-2 rounded-md border border-destructive/20 bg-warning-soft px-3 py-2 text-[12px] text-destructive">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Possible duplicate of:{" "}
                        <Link href={`/studio/${dup.id}/${dup.stage}`} className="font-medium underline underline-offset-2">{dup.title}</Link>
                      </span>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        addVideo({ title: idea.title, category: idea.category, outline: idea.outline, mode, format: video.format });
                        setIdeas((xs) => xs.filter((x) => x.id !== idea.id));
                        toast.success("Added to board", { description: "You'll find it in the Idea column." });
                      }}
                    >
                      <Plus /> Add to Board
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setIdeas((xs) => xs.map((x) => (x.id === idea.id ? regenerateIdea(idea, mode) : x)))}>
                      <RefreshCw /> Regenerate
                    </Button>
                    <Button
                      size="xs"
                      className="ml-auto"
                      onClick={() => complete({ title: idea.title, category: idea.category, outline: idea.outline, mode }, "script")}
                    >
                      <ScrollText /> Start Script
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </StepLayout>
  );
}
