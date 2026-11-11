"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clapperboard, Image as ImageIcon, Layers, Lightbulb, Monitor, PenLine, Smartphone, Sparkles, Type, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ProBadge } from "@/components/shared/pro";
import { useStartVideo } from "@/components/layout/use-start-video";
import { usePro, useStore, voiceProfileOf } from "@/lib/store";
import { streamWrite } from "@/lib/ai/writer";
import { getStage } from "@/lib/stages";
import { postableVideos } from "@/lib/posts/from-video";
import type { PostKind, PostPlatform, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The one place to start: a new idea, or one of the advisor's videos, and
 * what to turn it into: a video, posts, or both.
 */

type From = "idea" | "video";
type Make = "video" | "posts" | "both";

const MAKES: { id: Make; icon: typeof VideoIcon; title: string; body: string }[] = [
  { id: "video", icon: Clapperboard, title: "A video", body: "Ideas, a script, then record and edit." },
  { id: "posts", icon: PenLine, title: "Posts", body: "LinkedIn, Facebook and more, in your voice." },
  { id: "both", icon: Layers, title: "Both", body: "Start the video; posts are written alongside." },
];

const platformsFor = (kind: PostKind): PostPlatform[] => (kind === "image" ? ["linkedin", "facebook", "instagram"] : ["linkedin", "facebook"]);

export function StartBox() {
  const router = useRouter();
  const start = useStartVideo();
  const { videos, posts, profile, addPost, updatePost } = useStore();
  const { isPro } = usePro();
  const [from, setFrom] = React.useState<From>("idea");
  const [topic, setTopic] = React.useState("");
  const [make, setMake] = React.useState<Make>("video");
  const [format, setFormat] = React.useState<VideoFormat>("short");
  const [kind, setKind] = React.useState<PostKind>("image");
  const scripted = React.useMemo(() => postableVideos(videos), [videos]);
  const [videoId, setVideoId] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const picked = scripted.find((v) => v.id === videoId) ?? scripted[0];
  // A video is already a video: from one, the choice is posts.
  const out: Make = from === "video" ? "posts" : make;
  const wantsPosts = out !== "video";
  const wantsVideo = out !== "posts";

  /** Writes a post without opening it (for "Both"), and says when it's ready. */
  const writeInBackground = async (id: string, about: string) => {
    const open = { label: "Open", onClick: () => router.push(`/posts/${id}`) };
    try {
      const others = posts.filter((p) => p.copy[0]?.text).slice(0, 15).map((p) => p.copy[0].text.split("\n")[0].slice(0, 200));
      const platforms = platformsFor(kind);
      const res = await streamWrite({ task: "post", profile: voiceProfileOf(profile), topic: about, kind, platforms, others });
      const copy = res.posts.filter((p) => platforms.includes(p.platform)).map((p) => ({ platform: p.platform, text: p.text, hashtags: p.hashtags.map((h) => h.replace(/^#/, "")) }));
      updatePost(id, { copy, imageIdea: res.imageScene, graphicHeadline: res.imageHeadline?.trim() || undefined });
      toast.success("Your post is written", { description: "It’s in Posts, ready for a picture and a read-through.", action: open });
    } catch (e) {
      toast.error("The post wasn’t written", { description: `${(e as Error).message} Open it in Posts to try again.`, action: open });
    }
  };

  const go = (suggest = false) => {
    const about = topic.trim();
    if (from === "video") {
      if (!picked) return;
      if (!isPro) return router.push("/billing");
      const p = addPost({ kind, topic: picked.title, platforms: platformsFor(kind), fromVideoId: picked.id });
      return router.push(`/posts/${p.id}?write=1`);
    }
    if (out === "posts") {
      if (!about) return toast.error("Say what the posts are about first.");
      if (!isPro) return router.push("/billing");
      const p = addPost({ kind, topic: about, platforms: platformsFor(kind) });
      return router.push(`/posts/${p.id}?write=1`);
    }
    if (out === "both") {
      if (!isPro) return router.push("/billing");
      if (!about) return toast.error("Say what it’s about first: the posts are written from it.");
      const p = addPost({ kind, topic: about, platforms: platformsFor(kind) });
      void writeInBackground(p.id, about);
      toast("Writing your posts alongside", { description: "You’ll get a note when they’re ready in Posts." });
    }
    start(suggest ? "" : about, format);
  };

  const label = wantsPosts && !isPro ? "See plans" : out === "posts" ? "Write the posts" : out === "both" ? "Start both" : "Start the video";

  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(11,31,58,.04),0_12px_32px_-12px_rgba(11,31,58,.12)]">
      <div className="flex items-center gap-1 px-2 pt-2" role="tablist" aria-label="Start from">
        {(
          [
            ["idea", Lightbulb, "A new idea"],
            ["video", VideoIcon, "One of your videos"],
          ] as const
        ).map(([id, Icon, text]) => (
          <button key={id} type="button" role="tab" aria-selected={from === id} onClick={() => setFrom(id)} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[13px] transition-colors", from === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-3.5" /> {text}
          </button>
        ))}
      </div>

      {from === "idea" ? (
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go();
            }
          }}
          rows={2}
          aria-label="Your idea"
          placeholder="What do you want to talk about this week?"
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-2 font-serif text-xl outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
        />
      ) : picked ? (
        <div className="px-2 pt-2 pb-2">
          <ul className={cn("space-y-1", showAll && "max-h-[264px] overflow-y-auto pr-1")} role="radiogroup" aria-label="Video">
            {(showAll ? scripted.slice(0, 40) : scripted.slice(0, 3)).map((v) => {
              const on = v.id === picked.id;
              return (
                <li key={v.id}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => setVideoId(v.id)} className={cn("flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", on ? "bg-brass-soft/60" : "hover:bg-muted/60")}>
                    <span className={cn("mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="size-2.5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{v.title}</span>
                      {on && v.script?.hook && v.script.hook.trim() !== v.title.trim() && <span className="mt-0.5 block truncate font-serif text-[14px] text-muted-foreground">“{v.script.hook}”</span>}
                    </span>
                    <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{getStage(v.stage).label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {scripted.length > 3 && (
            <button type="button" onClick={() => setShowAll((x) => !x)} className="mt-1 ml-3 cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              {showAll ? "Show fewer" : `Show all ${scripted.length} videos`}
            </button>
          )}
        </div>
      ) : (
        <p className="px-4 pt-4 pb-3 text-[14px] text-muted-foreground">Once one of your videos has a script, you can turn it into posts from here.</p>
      )}

      <div className="mt-1 border-t border-border px-2 pt-3 pb-2">
        {from === "idea" && <><div className="mb-2 px-1 text-[12px] font-medium text-muted-foreground">Turn it into</div>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Turn it into">
          {MAKES.map((m) => {
            const on = out === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMake(m.id)}
                className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-left transition", on ? "border-primary bg-brass-soft/50" : "border-border hover:bg-muted/50", "cursor-pointer")}
              >
                <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <Check className="size-2.5" />}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[14px] font-medium">
                    <m.icon className="size-3.5 text-muted-foreground" /> {m.title} {m.id !== "video" && !isPro && <ProBadge />}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{m.body}</span>
                </span>
              </button>
            );
          })}
        </div></>}

        <div className={cn("flex flex-wrap items-center gap-2", from === "idea" && "mt-3")}>
          {from === "video" && <span className="px-1 text-[13px] text-muted-foreground">Turn it into posts {!isPro && <ProBadge />}</span>}
          {wantsVideo && (
            <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)} className="rounded-full" aria-label="Video shape">
              <ToggleGroupItem value="short" className="rounded-full"><Smartphone /> Short</ToggleGroupItem>
              <ToggleGroupItem value="long" className="rounded-full"><Monitor /> Long</ToggleGroupItem>
            </ToggleGroup>
          )}
          {wantsPosts && (
            <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as PostKind)} className="rounded-full" aria-label="Kind of post">
              <ToggleGroupItem value="image" className="rounded-full"><ImageIcon /> Text + image</ToggleGroupItem>
              <ToggleGroupItem value="text" className="rounded-full"><Type /> Text only</ToggleGroupItem>
            </ToggleGroup>
          )}
          <div className="ml-auto flex items-center gap-2">
            {from === "idea" && out === "video" && (
              <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => go(true)}>
                <Sparkles /> Suggest ideas
              </Button>
            )}
            <Button className="rounded-full px-5" onClick={() => go()} disabled={from === "video" && !picked}>
              {label} <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
