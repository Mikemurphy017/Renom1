"use client";

import { UploadFinishedButton } from "@/components/layout/upload-finished";
import * as React from "react";
import Link from "next/link";
import { Bookmark, Check, CircleCheck, Clapperboard, Clock, Eye, Lightbulb, ListChecks, MoreHorizontal, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteVideosDialog } from "@/components/shared/delete-videos-dialog";
import { deleteBlocker, isIdea, useDeleteVideos } from "@/lib/delete-videos";
import { PageContainer, EmptyState } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { StepDots } from "@/components/shared/step-dots";
import { useShell } from "@/components/layout/shell-context";
import { useStore } from "@/lib/store";
import { getStage } from "@/lib/stages";
import { videoTotals } from "@/lib/selectors";
import type { Video } from "@/lib/types";
import { cn, fmtCompact, fmtDate, fmtDateTime, relativeTime } from "@/lib/utils";

type Filter = "all" | "ideas" | "progress" | "drafts" | "approval" | "scheduled" | "published";

const matches: Record<Filter, (v: Video) => boolean> = {
  all: () => true,
  ideas: isIdea,
  progress: (v) => v.status === "in_progress",
  drafts: (v) => v.status === "draft",
  approval: (v) => v.status !== "published" && (v.compliance === "submitted" || v.compliance === "changes_requested"),
  scheduled: (v) => v.status === "scheduled",
  published: (v) => v.status === "published",
};

function statusLine(v: Video) {
  if (v.status === "published") {
    // Views only once there are numbers to show; "0" reads as a flop.
    const views = v.metrics?.length ? videoTotals(v).views : null;
    const when = v.publishedAt ? fmtDate(v.publishedAt) : "";
    return views !== null ? (
      <span className="inline-flex items-center gap-1 tnum"><Eye className="size-3.5" /> {fmtCompact(views)}{when && ` · ${when}`}</span>
    ) : (
      <span className="inline-flex items-center gap-1 tnum"><CircleCheck className="size-3.5" /> Posted{when && ` ${when}`}</span>
    );
  }
  if (v.status === "scheduled" && v.scheduledFor) return <span className="inline-flex items-center gap-1 tnum"><Clock className="size-3.5" /> Scheduled {fmtDateTime(v.scheduledFor)}</span>;
  if (v.teamPost?.status === "returned") return <span className="text-destructive">Sent back by your team</span>;
  if (v.teamPost && ["submitted", "in_buffer"].includes(v.teamPost.status)) return <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> With your team</span>;
  if (v.status === "draft") return <span className="inline-flex items-center gap-1"><Bookmark className="size-3.5" /> Draft · not posted</span>;
  if (v.compliance === "changes_requested") return <span className="text-destructive">Changes requested</span>;
  if (v.compliance === "submitted") return <span>Waiting on approval</span>;
  return <span>{getStage(v.stage).label} · {relativeTime(v.lastEdited)}</span>;
}

export default function VideosPage() {
  const { videos, requireApproval } = useStore();
  const { openNewVideo } = useShell();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [q, setQ] = React.useState("");
  // Deep link from "Save as draft": /videos?filter=drafts
  React.useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f && f in matches) setFilter(f as Filter);
  }, []);
  const list = videos
    .filter(matches[filter])
    .filter((v) => !q || v.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
  const count = (f: Filter) => videos.filter(matches[f]).length;

  // ── deleting ──
  const removeVideos = useDeleteVideos();
  const [selecting, setSelecting] = React.useState(false);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState<Video[]>([]);
  const deletable = list.filter((v) => !deleteBlocker(v));
  const toggle = (v: Video) => {
    const why = deleteBlocker(v);
    if (why) return toast(why);
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(v.id)) n.delete(v.id);
      else n.add(v.id);
      return n;
    });
  };
  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const askDelete = (vs: Video[]) => setConfirm(vs.filter((v) => !deleteBlocker(v)));
  const doDelete = () => {
    removeVideos(confirm.map((v) => v.id));
    setConfirm([]);
    stopSelecting();
  };
  const allPicked = deletable.length > 0 && deletable.every((v) => picked.has(v.id));

  return (
    <PageContainer className="max-w-[1200px] space-y-8 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-[40px] leading-tight tracking-tight">Videos</h1>
          <UploadFinishedButton className="h-9 rounded-full" />
        </div>
        {videos.length > 0 && <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60 sm:flex-none">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos" aria-label="Search videos" className="h-9 rounded-full pl-9" />
          </div>
          <Button variant={selecting ? "secondary" : "outline"} className="h-9 rounded-full" onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
            {selecting ? <><X /> Cancel</> : <><ListChecks /> Select</>}
          </Button>
        </div>}
      </div>

      {/* Phones: the filters scroll sideways instead of wrapping out of their pill. */}
      {videos.length > 0 && <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} className="h-9 w-max rounded-full">
        {([
          ["all", "All"],
          ["ideas", "Ideas"],
          ["progress", "In progress"],
          ["drafts", "Drafts"],
          ["approval", "Approval"],
          ["scheduled", "Scheduled"],
          ["published", "Published"],
        ] as const).filter(([f]) => (f !== "approval" || requireApproval || count("approval") > 0) && (f !== "ideas" || count("ideas") > 0)).map(([f, label]) => (
          <ToggleGroupItem key={f} value={f} className="rounded-full px-3.5">
            {label} <span className="text-[11px] text-muted-foreground tnum">{count(f)}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      </div>}

      {list.length === 0 && videos.length > 0 ? (
        <EmptyState
          icon={SearchX}
          title={q ? "No videos match your search" : "No videos here yet"}
          description={q ? `Nothing titled “${q}”${filter !== "all" ? " in this list" : ""}.` : filter === "ideas" ? "Ideas you haven’t recorded yet show up here." : "Videos show up here as they reach this stage."}
          action={<Button variant="outline" className="rounded-full" onClick={() => { setQ(""); setFilter("all"); }}>Show all videos</Button>}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={Clapperboard} title="Nothing here yet" description="When you start a video it shows up here." action={<Button className="rounded-full" onClick={openNewVideo}><Plus /> New video</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((v) => {
            const on = picked.has(v.id);
            const blocked = deleteBlocker(v);
            const body = (
              <>
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-muted/70 sm:aspect-[4/3]">
                  {isIdea(v) && !v.covers ? (
                    <div className="flex flex-col items-center gap-2 px-6 text-center text-muted-foreground"><Lightbulb className="size-6 text-primary" /><span className="text-[12px]">Idea · not recorded yet</span></div>
                  ) : (
                    <VideoThumb spec={v.thumbnail} image={v.covers?.[v.format]?.url} format={v.format} size="sm" className={v.format === "short" ? "h-[86%] w-auto" : "w-[90%]"} />
                  )}
                  {selecting && (
                    <span className={cn("absolute top-2 left-2 flex size-6 items-center justify-center rounded-full border-2 shadow-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/25", blocked && "opacity-40")}>
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                  )}
                </div>
                <div className="px-1 pt-3 pb-1">
                  <div className="line-clamp-2 min-h-[2.5em] text-[14px] leading-snug font-medium">{v.title}</div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                    {statusLine(v)}
                    <StepDots stage={v.stage} done={v.status !== "in_progress"} />
                  </div>
                </div>
              </>
            );
            const card = cn("group block w-full rounded-2xl border bg-card p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg", on ? "border-primary ring-2 ring-primary/30" : "border-border");
            return (
              <div key={v.id} className="group/card relative">
                {selecting ? (
                  <button type="button" onClick={() => toggle(v)} className={cn(card, "cursor-pointer", blocked && "opacity-60")} aria-pressed={on} title={blocked ?? undefined}>{body}</button>
                ) : (
                  <Link href={`/studio/${v.id}/${v.stage}`} className={card}>{body}</Link>
                )}
                {!selecting && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`More for ${v.title}`} className="absolute top-5 right-5 flex size-8 cursor-pointer items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur transition-opacity hover:bg-card focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild><Link href={`/studio/${v.id}/${v.stage}`}>Open</Link></DropdownMenuItem>
                      <DropdownMenuItem disabled={!!blocked} onSelect={() => askDelete([v])} className="text-destructive focus:text-destructive">
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                      {blocked && <p className="px-2 pb-1.5 text-[11px] leading-snug text-muted-foreground">{blocked}</p>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selecting && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-card/95 py-1.5 pr-1.5 pl-4 shadow-lg backdrop-blur md:bottom-6">
          <span className="text-[13px] tnum">{picked.size ? `${picked.size} selected` : "Tap videos to select"}</span>
          {deletable.length > 0 && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setPicked(allPicked ? new Set() : new Set(deletable.map((v) => v.id)))}>
              {allPicked ? "Clear" : filter === "ideas" ? "All ideas" : "Select all"}
            </Button>
          )}
          <Button size="sm" variant="destructive" className="rounded-full" disabled={!picked.size} onClick={() => askDelete(videos.filter((v) => picked.has(v.id)))}>
            <Trash2 /> Delete
          </Button>
        </div>
      )}

      <DeleteVideosDialog videos={confirm} onCancel={() => setConfirm([])} onConfirm={doDelete} />
    </PageContainer>
  );
}
