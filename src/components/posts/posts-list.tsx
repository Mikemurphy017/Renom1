"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own pictures */
import { ProUpsell } from "@/components/shared/pro";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, MoreHorizontal, Sparkles, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { usePro, useStore } from "@/lib/store";
import { POST_PLATFORMS, type PostDraft, type PostKind, type PostPlatform } from "@/lib/types";
import { getPlatform } from "@/lib/mock/platforms";
import { cn, fmtDateTime, relativeTime } from "@/lib/utils";

export function useStartPost() {
  const { addPost } = useStore();
  const router = useRouter();
  return React.useCallback(
    (kind: PostKind, topic = "") => {
      const p = addPost({ kind, topic, platforms: kind === "image" ? ["linkedin", "facebook", "instagram"] : ["linkedin", "facebook"] });
      router.push(`/posts/${p.id}`);
    },
    [addPost, router]
  );
}

/** The top of the Posts page: say what it's about, pick the kind and platforms, and it's written. */
function NewPostBox() {
  const { addPost } = useStore();
  const router = useRouter();
  const [topic, setTopic] = React.useState("");
  const [kind, setKind] = React.useState<PostKind>("image");
  const [platforms, setPlatforms] = React.useState<PostPlatform[]>(["linkedin", "facebook", "instagram"]);
  const allowed = POST_PLATFORMS.filter((p) => kind === "image" || p !== "instagram");
  const chosen = platforms.filter((p) => allowed.includes(p));
  const write = () => {
    if (!topic.trim()) return toast.error("Say what the post is about first.");
    if (!chosen.length) return toast.error("Pick at least one platform.");
    const p = addPost({ kind, topic: topic.trim(), platforms: chosen });
    router.push(`/posts/${p.id}?write=1`);
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-3 flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-navy-foreground dark:bg-primary dark:text-primary-foreground">1</span><h2 className="text-[16px] font-semibold">What’s it about?</h2></div>
      <Textarea
        rows={2}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            write();
          }
        }}
        placeholder="e.g. Why a Roth conversion in your early 60s can save you thousands"
        className="font-serif text-[18px]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={kind} onValueChange={(v) => { if (!v) return; setKind(v as PostKind); if (v === "image" && !platforms.includes("instagram")) setPlatforms((ps) => [...ps, "instagram"]); }} className="rounded-full">
          <ToggleGroupItem value="text" className="rounded-full"><Type /> Text only</ToggleGroupItem>
          <ToggleGroupItem value="image" className="rounded-full"><ImageIcon /> Text + image</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-wrap gap-1.5">
          {POST_PLATFORMS.map((p) => {
            const on = chosen.includes(p);
            const off = !allowed.includes(p);
            return (
              <button
                key={p}
                type="button"
                disabled={off}
                title={off ? "Instagram posts need a picture: switch to Text + image" : undefined}
                onClick={() => setPlatforms((ps) => (on ? ps.filter((x) => x !== p) : [...ps, p]))}
                className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                <PlatformIcon id={p} className="size-3.5" /> {getPlatform(p).short}
              </button>
            );
          })}
        </div>
        <Button className="ml-auto rounded-full px-5" onClick={write}><Sparkles /> Write the post</Button>
      </div>
    </section>
  );
}

const STATUS: Record<PostDraft["status"], string> = { draft: "Draft", scheduled: "Scheduled", published: "Posted" };

/** Text and image posts: start one, or pick up where you left off. */
export function PostsList() {
  const { posts, deletePost, addPost } = useStore();
  const { isPro } = usePro();
  if (!isPro)
    return (
      <PageContainer className="max-w-[1100px] pt-16">
        <ProUpsell title="Text and image posts" body="Posts in your voice for LinkedIn, Facebook, Instagram and X, with AI photos of you made from your headshots, for the days you’re not filming." />
      </PageContainer>
    );

  const remove = (p: PostDraft) => {
    deletePost(p.id);
    toast.success("Post deleted", { action: { label: "Undo", onClick: () => addPost(p) } });
  };

  return (
    <PageContainer className="max-w-[1100px] pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] leading-tight tracking-tight sm:text-[40px]">Posts</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Words only, or words with a picture: for the days you’re not filming.</p>
        </div>
      </div>

      <div className="mt-6"><NewPostBox /></div>

      {posts.length > 0 && <h2 className="mt-10 font-serif text-2xl">Your posts</h2>}
      {!posts.length ? (
        <p className="mt-8 text-center text-[13px] text-muted-foreground">Your posts will show up here. Text + image posts get an AI photo of you made from your headshots, or one of your own.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <Link href={`/posts/${p.id}`} className="block">
                {p.image ? (
                  <div className="relative aspect-video bg-muted"><img src={p.image.url} alt="" className="absolute inset-0 h-full w-full object-cover" /></div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-[#F3ECDF] to-[#E8DCC6] p-5 dark:from-[#1B2A40] dark:to-[#0E1A2E]">
                    <p className="line-clamp-4 font-serif text-[15px] leading-snug text-[#0B1F3A] dark:text-white/90">{p.copy[0]?.text.split("\n")[0] || p.topic || "New post"}</p>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className={cn("rounded-full px-2 py-0.5 font-medium", p.status === "published" ? "bg-success-soft text-success" : p.status === "scheduled" ? "bg-brass-soft text-primary" : "bg-muted")}>{STATUS[p.status]}</span>
                    {p.kind === "image" ? "Text + image" : "Text"}
                    <span className="ml-auto flex gap-1">{p.platforms.map((x) => <PlatformIcon key={x} id={x} className="size-3" />)}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-[14px] font-medium">{p.topic || "Untitled post"}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{p.status === "scheduled" && p.scheduledFor ? `Goes out ${fmtDateTime(p.scheduledFor)}` : `Edited ${relativeTime(p.updatedAt)}`}</div>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Post options">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onClick={() => remove(p)}><Trash2 /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
