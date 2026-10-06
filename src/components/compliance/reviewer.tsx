"use client";

import * as React from "react";
import { Check, Clock, MessageSquare, Pin, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoThumb } from "@/components/shared/video-thumb";
import { ComplianceBadge, CategoryTag, FormatBadge } from "@/components/shared/badges";
import { useStore } from "@/lib/store";
import { initials } from "@/lib/profile";
import { generateScript } from "@/lib/ai/content";
import type { ReviewComment, ReviewItem } from "@/lib/compliance";
import { cn, fmtDuration, relativeTime } from "@/lib/utils";

type Section = "hook" | "body" | "cta";

export function Reviewer({ review }: { review: ReviewItem }) {
  const { getVideo, setReviewStatus, resolveComment, addComment } = useStore();
  const video = getVideo(review.videoId)!;
  const script = video.script ?? generateScript(video.title, video.format);
  const lines: { section: Section; index: number; text: string }[] = [
    { section: "hook", index: 0, text: script.hook },
    ...script.body.map((text, index) => ({ section: "body" as const, index, text })),
    { section: "cta", index: 0, text: script.cta },
  ];
  const [anchor, setAnchor] = React.useState("line:hook:0");
  const [text, setText] = React.useState("");
  const [hoverLine, setHoverLine] = React.useState<string | null>(null);

  const lineComments = (s: Section, i: number) => review.comments.filter((c) => c.anchor.kind === "line" && c.anchor.section === s && c.anchor.index === i);
  const timeComments = review.comments.filter((c) => c.anchor.kind === "time");
  const open = review.comments.filter((c) => !c.resolved).length;

  const submit = () => {
    if (!text.trim()) return;
    const [kind, a, b] = anchor.split(":");
    const anc: ReviewComment["anchor"] = kind === "time" ? { kind: "time", seconds: Number(a) } : { kind: "line", section: a as Section, index: Number(b) };
    addComment(review.id, { author: review.reviewer, initials: initials(review.reviewer), role: "Compliance Reviewer", anchor: anc, text: text.trim() });
    setText("");
    toast.success("Comment pinned");
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-start gap-4 border-b border-border p-5">
        <VideoThumb spec={video.thumbnail} image={video.covers?.[video.format]?.url} format={video.format} size="xs" className={video.format === "short" ? "w-12" : "w-24"} />
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{review.kind} · submitted by {review.submittedBy} {relativeTime(review.submittedAt)}</div>
          <h3 className="mt-1 font-serif text-xl">{video.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2.5"><ComplianceBadge status={review.status} /><FormatBadge format={video.format} /><CategoryTag category={video.category} /></div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-warning-soft"
            onClick={() => { setReviewStatus(review.id, "changes_requested"); toast("Changes requested", { description: `${open} open comment${open === 1 ? "" : "s"} sent to ${review.submittedBy}.` }); }}
          >
            <TriangleAlert /> Request changes
          </Button>
          <Button
            size="sm"
            className="bg-success text-white hover:bg-success/90"
            onClick={() => { setReviewStatus(review.id, "approved"); toast.success("Approved", { description: "Cleared to publish. Logged to the archive." }); }}
          >
            <Check /> Approve
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5">
          <div className="eyebrow mb-3">Script · comments pinned to lines</div>
          <ol className="space-y-1">
            {lines.map((l, n) => {
              const key = `line:${l.section}:${l.index}`;
              const cs = lineComments(l.section, l.index);
              return (
                <li key={key} onMouseEnter={() => setHoverLine(key)} onMouseLeave={() => setHoverLine(null)}>
                  <div className={cn("group grid grid-cols-[28px_52px_1fr_24px] gap-2 rounded-md px-2 py-2", cs.some((c) => !c.resolved) && "bg-brass-soft/50", hoverLine === key && "bg-muted/60")}>
                    <span className="pt-0.5 text-right text-[11px] text-muted-foreground tnum">{n + 1}</span>
                    <span className="pt-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{l.section}</span>
                    <p className="text-[14px] leading-relaxed">{l.text}</p>
                    <button onClick={() => setAnchor(key)} className={cn("cursor-pointer pt-1 text-muted-foreground touch-show opacity-0 transition-opacity group-hover:opacity-100", anchor === key && "text-primary opacity-100")} aria-label="Comment on this line">
                      <Pin className="size-3.5" />
                    </button>
                  </div>
                  {cs.map((c) => <CommentCard key={c.id} c={c} onResolve={() => resolveComment(review.id, c.id)} indent />)}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="border-t border-border p-5 lg:border-t-0 lg:border-l">
          <div className="eyebrow mb-3">Video · timestamped</div>
          <div className="relative mb-3 h-2 rounded-full bg-muted">
            {timeComments.map((c) => c.anchor.kind === "time" && (
              <span key={c.id} className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card", c.resolved ? "bg-success" : "bg-primary")} style={{ left: `${Math.min(98, (c.anchor.seconds / Math.max(video.runtimeSec, 1)) * 100)}%` }} />
            ))}
          </div>
          <div className="mb-4 flex justify-between text-[11px] text-muted-foreground tnum"><span>0:00</span><span>{fmtDuration(video.runtimeSec)}</span></div>
          {timeComments.length === 0 && <p className="mb-4 text-[12px] text-muted-foreground">No timestamp comments.</p>}
          {timeComments.map((c) => <CommentCard key={c.id} c={c} onResolve={() => resolveComment(review.id, c.id)} />)}

          <div className="mt-4 rounded-md border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium"><MessageSquare className="size-3.5" /> Add comment</div>
            <Select value={anchor} onValueChange={setAnchor}>
              <SelectTrigger size="sm" className="mb-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {lines.map((l, n) => <SelectItem key={n} value={`line:${l.section}:${l.index}`}>Line {n + 1} · {l.section}</SelectItem>)}
                {[0, 0.25, 0.5, 0.75].map((f) => {
                  const s = Math.round(video.runtimeSec * f);
                  return <SelectItem key={f} value={`time:${s}`}>At {fmtDuration(s)}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Add “for many investors” — reads as a recommendation." className="text-[13px]" />
            <div className="mt-2 flex justify-end"><Button size="sm" onClick={submit} disabled={!text.trim()}>Pin comment</Button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentCard({ c, onResolve, indent }: { c: ReviewComment; onResolve: () => void; indent?: boolean }) {
  return (
    <div className={cn("mb-2 rounded-md border bg-card p-3 text-[13px]", c.resolved ? "border-border opacity-60" : "border-primary/40", indent && "mr-8 ml-[90px]")}>
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[9px] font-semibold text-navy-foreground dark:bg-secondary">{c.initials}</span>
        <span className="text-[12px] font-medium">{c.author}</span>
        {c.anchor.kind === "time" && <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 text-[11px] tnum"><Clock className="size-3" />{fmtDuration(c.anchor.seconds)}</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(c.at)}</span>
      </div>
      <p className={cn("leading-relaxed", c.resolved && "line-through")}>{c.text}</p>
      <button onClick={onResolve} className="mt-1.5 cursor-pointer text-[11px] font-medium text-primary hover:underline">{c.resolved ? "Reopen" : "Mark resolved"}</button>
    </div>
  );
}
