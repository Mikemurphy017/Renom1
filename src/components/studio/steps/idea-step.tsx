"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bookmark, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStore, voiceProfileOf } from "@/lib/store";
import { useDraft } from "@/lib/drafts";
import { isAbort, useWriter } from "@/lib/ai/writer";
import { findDuplicate } from "@/lib/ai/content";
import type { IdeasOutput } from "@/lib/ai/schemas";
import type { Category } from "@/lib/types";
import { AskBar, RequestLine, Writing } from "../ask-bar";
import { StepIntro } from "../step-layout";
import type { StepProps } from "../studio-view";
import { BRAND } from "@/lib/brand";
import { createBufferIdea, useAdvisorChannels, useBuffer } from "@/lib/buffer/use-buffer";
import type { BufferService } from "@/lib/buffer/types";
import { TEAM } from "@/lib/mock/advisor";

type Idea = IdeasOutput["ideas"][number] & { id: string };
let n = 0;
const withIds = (ideas: IdeasOutput["ideas"]): Idea[] => ideas.map((i) => ({ ...i, id: `i${Date.now()}${n++}` }));

export function IdeaStep({ video, complete }: StepProps) {
  const { videos, addVideo, profile } = useStore();
  const [mode, setMode] = useDraft<"evergreen" | "timely">(video.id, "idea.mode", video.mode);
  const [topic, setTopic] = useDraft(video.id, "idea.topic", "");
  const [ideas, setIdeas] = useDraft<Idea[]>(video.id, "idea.list", []);
  const [autostart, setAutostart] = useDraft(video.id, "idea.autostart", false);
  const { write, busy, status, source } = useWriter();
  const others = videos.filter((v) => v.id !== video.id);
  const hasCurrent = video.outline.length > 0;
  const buffer = useBuffer();
  const [mine] = useAdvisorChannels(TEAM[0].id);

  /** Copy an idea into Buffer's Ideas board (title + outline), tagged for the advisor's channels. */
  const sendToBuffer = async (idea: Idea) => {
    const channels = buffer.status && "channels" in buffer.status ? buffer.status.channels : [];
    const services = [...new Set(channels.filter((c) => mine.includes(c.id)).map((c) => c.service))] as BufferService[];
    const r = await createBufferIdea({
      title: idea.title.replace(/^[“"]|[”"]$/g, ""),
      text: [...idea.outline.map((o) => `• ${o}`), idea.why ? `\n${idea.why}` : ""].filter(Boolean).join("\n"),
      services: services.length ? services : undefined,
      aiAssisted: true,
    });
    if (r.ok) toast.success("Sent to Buffer Ideas");
    else toast.error("Couldn’t send to Buffer", { description: r.error });
  };

  const generate = React.useCallback(
    async (instruction?: string) => {
      try {
        const out = await write({
          task: "ideas",
          profile: voiceProfileOf(profile),
          mode,
          format: video.format,
          topic: topic || undefined,
          existingTitles: others.map((v) => v.title),
          instruction,
        });
        setIdeas(withIds(out.ideas));
      } catch (e) {
        if (isAbort(e)) return;
        toast.error("Couldn’t write ideas", { description: (e as Error).message });
      }
    },
    [write, profile, mode, video.format, topic, others, setIdeas]
  );

  React.useEffect(() => {
    if (autostart && !ideas.length) {
      setAutostart(false);
      generate();
    }
  }, [autostart, ideas.length, setAutostart, generate]);

  const choose = (idea: Idea) =>
    complete({ title: idea.title.replace(/^[“"]|[”"]$/g, ""), category: idea.category as Category, outline: idea.outline, mode });

  return (
    <div className="space-y-10 pb-28">
      <StepIntro title="What do you want to talk about?" subtitle={`A sentence is plenty. ${BRAND.name} turns it into ideas in your voice.`} />

      <div className="rounded-2xl border border-border bg-card p-2 shadow-soft">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              generate();
            }
          }}
          rows={2}
          placeholder="e.g. Why executives wait too long to sell company stock"
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 font-serif text-xl outline-none placeholder:text-muted-foreground/60"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "evergreen" | "timely")} className="rounded-full">
            <ToggleGroupItem value="evergreen" className="rounded-full">Evergreen</ToggleGroupItem>
            <ToggleGroupItem value="timely" className="rounded-full">Timely</ToggleGroupItem>
          </ToggleGroup>
          <Button className="rounded-full px-5" onClick={() => generate()} disabled={busy}>
            <Sparkles /> {ideas.length ? "New ideas" : "Suggest ideas"}
          </Button>
        </div>
      </div>

      {hasCurrent && !ideas.length && !busy && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-[12px] text-muted-foreground">This video</div>
          <h2 className="mt-1 font-serif text-2xl">{video.title}</h2>
          <ul className="mt-3 space-y-1.5 text-[14px] text-muted-foreground">
            {video.outline.map((o) => <li key={o} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{o}</li>)}
          </ul>
          <Button className="mt-5 rounded-full px-5" onClick={() => complete()}>Write the script <ArrowRight /></Button>
        </div>
      )}

      {(busy || ideas.length > 0) && (
        <div className="space-y-4">
          <RequestLine
            items={[video.format === "short" ? "Short-form" : "Long-form", mode === "timely" ? "Timely" : "Evergreen", topic ? `“${topic.slice(0, 40)}${topic.length > 40 ? "…" : ""}”` : "Open topic", "Your voice profile", "No voice memo", "No files"]}
            source={busy ? null : source}
          />
          {busy && <Writing status={status} />}
          {busy
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-6">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-4/5" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            : (
              <AnimatePresence mode="popLayout">
                {ideas.map((idea, i) => {
                  const dup = findDuplicate(idea.title, others);
                  return (
                    <motion.article
                      key={idea.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl border border-border bg-card p-6 shadow-soft"
                    >
                      <div className="text-[12px] text-muted-foreground">({idea.angle}) · {idea.category}</div>
                      <h2 className="mt-1.5 font-serif text-[24px] leading-snug">{idea.title}</h2>
                      <ul className="mt-3 space-y-1.5 text-[14px]">
                        {idea.outline.map((o) => <li key={o} className="flex gap-2.5"><span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />{o}</li>)}
                      </ul>
                      {idea.why && <p className="mt-3 text-[13px] text-muted-foreground italic">{idea.why}</p>}
                      {dup && (
                        <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-destructive">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                          <span>Possible duplicate of: <Link href={`/studio/${dup.id}/${dup.stage}`} className="font-medium underline underline-offset-2">{dup.title}</Link></span>
                        </p>
                      )}
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <Button className="rounded-full px-5" onClick={() => choose(idea)}>Use this idea <ArrowRight /></Button>
                        <Button
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => {
                            addVideo({ title: idea.title.replace(/^[“"]|[”"]$/g, ""), category: idea.category as Category, outline: idea.outline, mode, format: video.format });
                            setIdeas((xs) => xs.filter((x) => x.id !== idea.id));
                            toast.success("Saved to Videos", buffer.connected ? { duration: 10000, action: { label: "Send to Buffer Ideas", onClick: () => sendToBuffer(idea) } } : undefined);
                          }}
                        >
                          <Bookmark /> Save for later
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto rounded-full text-muted-foreground"
                          aria-label="Replace this idea"
                          onClick={async () => {
                            try {
                              const out = await write({ task: "ideas", profile: voiceProfileOf(profile), mode, format: video.format, topic: topic || undefined, existingTitles: [...others.map((v) => v.title), ...ideas.map((x) => x.title)], instruction: `Give a different idea to replace: "${idea.title}"` });
                              const fresh = withIds(out.ideas)[0];
                              if (fresh) setIdeas((xs) => xs.map((x) => (x.id === idea.id ? fresh : x)));
                            } catch (e) {
                              if (isAbort(e)) return;
                              toast.error("Couldn’t replace it", { description: (e as Error).message });
                            }
                          }}
                        >
                          <RefreshCw />
                        </Button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            )}
        </div>
      )}

      {ideas.length > 0 && (
        <AskBar busy={busy} status={status} onAsk={(t) => generate(t)} suggestions={["More contrarian", "Aim at pre-retirees", "Tie to year-end"]} placeholder="Steer the ideas…" />
      )}
    </div>
  );
}
