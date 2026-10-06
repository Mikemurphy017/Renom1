"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Download, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { Headshot } from "@/components/shared/headshot";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useAgentSession } from "@/components/agent/use-agent";
import { useDraft } from "@/lib/drafts";
import { generateThumbnails } from "@/lib/ai/content";
import { ADVISOR } from "@/lib/mock/advisor";
import type { Pose, ThumbStyle, ThumbnailSpec } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StepLayout, StepSection, FieldLabel } from "../step-layout";
import type { StepProps } from "../studio-view";

type Thumb = ThumbnailSpec & { id: string; size: string };
const STYLES: ThumbStyle[] = ["navy", "ivory", "brass", "slate"];
const POSES: Pose[] = ["point", "crossed", "think", "center", "left", "right"];

export function ThumbnailStep({ video, complete }: StepProps) {
  const vertical = video.format === "short";
  const [theme, setTheme] = useDraft(video.id, "thumb.theme", "auto");
  const [title, setTitle] = useDraft(video.id, "thumb.title", video.thumbnail?.headline ?? video.title);
  const [platform, setPlatform] = useDraft(video.id, "thumb.platform", vertical ? "Instagram Reels" : "YouTube");
  const [count, setCount] = useDraft(video.id, "thumb.count", "4");
  const [headshot, setHeadshot] = useDraft(video.id, "thumb.headshot", ADVISOR.headshots[0].id);
  const [thumbs, setThumbs] = useDraft<Thumb[]>(video.id, "thumb.list", () =>
    video.thumbnail ? [{ ...video.thumbnail, id: "current", size: vertical ? "768×1376" : "1376×768" }] : []
  );
  const [selected, setSelected] = useDraft<string | null>(video.id, "thumb.selected", video.thumbnail ? "current" : null);
  const [pending, setPending] = React.useState(false);
  const { turns, busy, run } = useAgentSession();

  const generate = () => {
    setPending(true);
    run(
      {
        task: "thumbnails",
        summary: { Theme: theme === "auto" ? "Auto" : theme, "Video Title": title, Platform: platform, Versions: count, Headshot: ADVISOR.headshots.find((h) => h.id === headshot)!.label },
      },
      {
        onDone: () => {
          let out = generateThumbnails(title, Number(count), platform);
          if (theme !== "auto") out = out.map((t) => ({ ...t, style: theme as ThumbStyle }));
          if (!vertical) out = out.map((t) => ({ ...t, size: "1376×768" }));
          else out = out.map((t) => ({ ...t, size: "768×1376" }));
          setThumbs(out);
          setSelected(out[0].id);
          setPending(false);
        },
      }
    );
  };

  const refine = (text: string) => {
    run(
      { task: "chat", summary: {}, prompt: text, context: { step: "thumbnails" } },
      {
        onDone: () => {
          if (!selected) return;
          setThumbs((ts) =>
            ts.map((t) =>
              t.id === selected
                ? { ...t, pose: POSES[(POSES.indexOf(t.pose) + 1) % POSES.length], style: /color|brass|navy|ivory|dark|light/i.test(text) ? STYLES[(STYLES.indexOf(t.style) + 1) % STYLES.length] : t.style }
                : t
            )
          );
        },
      }
    );
  };

  const chosen = thumbs.find((t) => t.id === selected);

  return (
    <StepLayout
      panel={
        <AgentPanel
          turns={turns}
          busy={busy}
          onSend={refine}
          subtitle={chosen ? "Refining the selected thumbnail" : "Select a thumbnail to refine it"}
          suggestions={chosen ? ["Different pose", "Try a brass background", "Bigger headline"] : []}
          emptyHint="Generate versions, select one, then tell me what to change."
        />
      }
    >
      <StepSection title="Thumbnail settings">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FieldLabel>Theme</FieldLabel>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (brand palette)</SelectItem>
                <SelectItem value="navy">Navy</SelectItem>
                <SelectItem value="ivory">Ivory</SelectItem>
                <SelectItem value="brass">Brass</SelectItem>
                <SelectItem value="slate">Slate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <FieldLabel hint={`${title.length}/40`}>Video title (overlay)</FieldLabel>
            <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Platform</FieldLabel>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(vertical ? ["Instagram Reels", "TikTok", "YouTube Shorts", "Facebook Reels"] : ["YouTube", "LinkedIn", "Facebook"]).map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Number of versions</FieldLabel>
            <ToggleGroup type="single" value={count} onValueChange={(v) => v && setCount(v)} className="w-full">
              {["1", "2", "3", "4"].map((n) => (
                <ToggleGroupItem key={n} value={n} className="flex-1 tnum">{n}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            <FieldLabel hint="One headshot, endless poses.">Headshot</FieldLabel>
            <div className="flex gap-2">
              {ADVISOR.headshots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setHeadshot(h.id)}
                  title={h.label}
                  className={cn(
                    "relative size-14 cursor-pointer overflow-hidden rounded-md border bg-gradient-to-b from-[#E9E4D9] to-[#D8D1C2] transition-all",
                    headshot === h.id ? "border-primary ring-2 ring-primary/30" : "border-border opacity-70 hover:opacity-100"
                  )}
                >
                  <Headshot pose={h.pose} className="absolute inset-x-0 bottom-0 h-full w-full" />
                  {headshot === h.id && <Check className="absolute top-1 right-1 size-3 rounded-full bg-primary p-0.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={generate} disabled={busy}>
            <Sparkles /> {thumbs.length ? "Regenerate" : "Generate thumbnails"}
          </Button>
        </div>
      </StepSection>

      <StepSection
        title={`Versions · ${vertical ? "9:16" : "16:9"}`}
        action={
          chosen && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => toast("Downloaded", { description: `${chosen.size} PNG saved.` })}>
                <Download /> Download
              </Button>
              <Button size="sm" onClick={() => complete({ thumbnail: { style: chosen.style, pose: chosen.pose, headline: chosen.headline, accent: chosen.accent } })}>
                Use this thumbnail <ArrowRight />
              </Button>
            </div>
          )
        }
      >
        {pending ? (
          <div className={cn("grid gap-4", vertical ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2")}>
            {Array.from({ length: Number(count) }).map((_, i) => (
              <Skeleton key={i} className={vertical ? "aspect-[9/16]" : "aspect-video"} />
            ))}
          </div>
        ) : thumbs.length === 0 ? (
          <EmptyState icon={ImageIcon} title="No thumbnails yet" description="Renom composes your headshot with bold, readable overlay text in your brand colors." action={<Button onClick={generate}><Sparkles /> Generate thumbnails</Button>} />
        ) : (
          <div className={cn("grid gap-4", vertical ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2")}>
            {thumbs.map((t, i) => (
              <motion.button
                key={t.id + t.pose + t.style}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.05 } }}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "group relative cursor-pointer rounded-lg p-1 text-left transition-all",
                  selected === t.id ? "bg-brass-soft ring-2 ring-primary" : "hover:bg-muted"
                )}
              >
                <VideoThumb spec={t} format={video.format} size={vertical ? "md" : "lg"} label={t.size} />
                <div className="flex items-center justify-between px-1 pt-2 pb-0.5 text-[11px] text-muted-foreground">
                  <span>Version {i + 1}{t.id === "current" && " · current"}</span>
                  {selected === t.id && <span className="inline-flex items-center gap-1 font-medium text-primary"><Check className="size-3" /> Selected</span>}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </StepSection>
    </StepLayout>
  );
}
