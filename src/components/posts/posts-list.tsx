"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own pictures */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, MoreHorizontal, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import type { PostDraft, PostKind } from "@/lib/types";
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

const STATUS: Record<PostDraft["status"], string> = { draft: "Draft", scheduled: "Scheduled", published: "Posted" };

/** Text and image posts: start one, or pick up where you left off. */
export function PostsList() {
  const { posts, deletePost, addPost } = useStore();
  const start = useStartPost();

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
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => start("text")}><Type /> Text post</Button>
          <Button className="rounded-full" onClick={() => start("image")}><ImageIcon /> Text + image post</Button>
        </div>
      </div>

      {!posts.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            { kind: "text" as const, icon: Type, title: "Text post", body: "A LinkedIn-style post in your voice, written natively for each platform, with your disclosure added." },
            { kind: "image" as const, icon: ImageIcon, title: "Text + image post", body: "The same, with a picture: an AI photo of you made from your headshots (presenting, meeting clients…) or one of your own." },
          ].map((x) => (
            <button key={x.kind} type="button" onClick={() => start(x.kind)} className="cursor-pointer rounded-2xl border border-border bg-card p-6 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brass-soft text-primary"><x.icon className="size-5" /></span>
              <div className="mt-3 text-[16px] font-medium">{x.title}</div>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{x.body}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
