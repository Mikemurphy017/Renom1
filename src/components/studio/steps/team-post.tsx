"use client";

import * as React from "react";
import { CalendarClock, CircleCheck, Clock, LoaderCircle, MessageSquareWarning, Send, Undo2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import { activeDisclosure, composeCaption } from "@/lib/compose";
import type { PlatformCopy } from "@/lib/ai/content";
import { getPlatform } from "@/lib/mock/platforms";
import { cancelPostRequest, submitPostRequest, usePostRequests, videoPatchFor } from "@/lib/posting/use-posting";
import type { AdvisorPostRequest } from "@/lib/posting/types";
import type { PlatformId, Video } from "@/lib/types";
import { cn, fmtDateTime } from "@/lib/utils";

/** "Have our team post it": the advisor hands the finished video and captions to the team. */
export function TeamPost({ video, platforms, copies, tagline }: { video: Video; platforms: PlatformId[]; copies: PlatformCopy[]; tagline?: string }) {
  const { requests, refresh } = usePostRequests(video.id);
  const latest = requests?.filter((r) => r.status !== "cancelled").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const [editing, setEditing] = React.useState(false);
  const { updateVideo } = useStore();

  const apply = (r: AdvisorPostRequest) => {
    const patch = videoPatchFor(video, r);
    updateVideo(video.id, { ...(patch ?? {}), ...(video.status === "in_progress" ? { status: "draft" as const } : {}) });
  };

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-soft sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brass-soft text-primary"><UsersRound className="size-5" /></span>
        <div>
          <h2 className="font-serif text-2xl leading-tight">Have our team post it.</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Send the video and captions over. We post it to your accounts and you’ll see it here once it’s scheduled.</p>
        </div>
      </div>
      <div className="mt-5">
        {requests === null ? (
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        ) : latest && !editing && latest.status !== "returned" ? (
          <RequestStatus r={latest} onEdit={() => setEditing(true)} onWithdrawn={() => { updateVideo(video.id, { teamPost: undefined }); void refresh(); }} />
        ) : (
          <>
            {latest?.status === "returned" && latest.teamNote && (
              <div className="mb-5 flex gap-3 rounded-xl bg-warning-soft p-4 text-[14px]">
                <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div><div className="font-medium">The team sent this back</div><p className="mt-1 whitespace-pre-line text-muted-foreground">{latest.teamNote}</p></div>
              </div>
            )}
            <RequestForm
              video={video}
              platforms={platforms}
              copies={copies}
              tagline={tagline}
              previous={latest}
              onCancel={editing ? () => setEditing(false) : undefined}
              onDone={(r) => { apply(r); setEditing(false); void refresh(); }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function RequestStatus({ r, onEdit, onWithdrawn }: { r: AdvisorPostRequest; onEdit: () => void; onWithdrawn: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const withdraw = async () => {
    if (!window.confirm("Withdraw this request? The team won’t post it.")) return;
    setBusy(true);
    try {
      await cancelPostRequest(r.id);
      toast.success("Request withdrawn");
      onWithdrawn();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const view = {
    submitted: { icon: Clock, title: "With the team", body: `Sent ${fmtDateTime(r.updatedAt)}. ${r.timing.kind === "at" ? `You asked for ${fmtDateTime(r.timing.at!)}.` : "You asked for it as soon as possible."}` },
    in_buffer: { icon: CalendarClock, title: "The team is preparing it", body: "It’s lined up and will be scheduled shortly." },
    scheduled: { icon: CalendarClock, title: r.scheduledFor ? `Scheduled for ${fmtDateTime(r.scheduledFor)}` : "Scheduled", body: "It goes out automatically. Nothing else to do." },
    posted: { icon: CircleCheck, title: "Posted", body: `${r.postedAt ? `Went out ${fmtDateTime(r.postedAt)}. ` : ""}The captions and disclosure are in your archive.` },
    returned: { icon: MessageSquareWarning, title: "Sent back", body: r.teamNote ?? "" },
    cancelled: { icon: Undo2, title: "Withdrawn", body: "" },
  }[r.status];
  return (
    <div className={cn("rounded-xl p-4", r.status === "posted" ? "bg-success-soft" : "bg-muted/60")}>
      <div className="flex items-start gap-3">
        <view.icon className={cn("mt-0.5 size-5 shrink-0", r.status === "posted" ? "text-success" : "text-primary")} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{view.title}</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{view.body}</p>
          {r.teamNote && r.status !== "returned" && <p className="mt-2 text-[13px]"><span className="font-medium">From the team:</span> {r.teamNote}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5" style={{ ["--pi-bg" as string]: "var(--card)" }}>
            {r.platforms.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[12px]"><PlatformIcon id={p} className="size-3" /> {getPlatform(p).label}</span>
            ))}
          </div>
        </div>
      </div>
      {r.status === "submitted" && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="outline" className="rounded-full" onClick={onEdit}>Change request</Button>
          <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => void withdraw()} disabled={busy}>Withdraw</Button>
        </div>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (iso: string) => {
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

function RequestForm({ video, platforms, copies, tagline, previous, onDone, onCancel }: { video: Video; platforms: PlatformId[]; copies: PlatformCopy[]; tagline?: string; previous?: AdvisorPostRequest; onDone: (r: AdvisorPostRequest) => void; onCancel?: () => void }) {
  const { profile, account } = useStore();
  const tomorrow = localParts(new Date(Date.now() + 86400000).toISOString());
  const prevAt = previous?.timing.kind === "at" && previous.timing.at ? localParts(previous.timing.at) : null;
  const [when, setWhen] = React.useState<"asap" | "at">(previous?.timing.kind ?? "asap");
  const [date, setDate] = React.useState(prevAt?.date ?? tomorrow.date);
  const [time, setTime] = React.useState(prevAt?.time ?? "08:30");
  const [note, setNote] = React.useState(previous?.note ?? "");
  const [busy, setBusy] = React.useState(false);

  const out = video.output;
  const ready = platforms.filter((p) => copies.some((c) => c.platform === p));
  const blocker = !out ? "Finish the edit first so there’s a video to post." : !ready.length ? "Write the captions first (the Caption step)." : null;

  const submit = async () => {
    if (!out) return;
    setBusy(true);
    try {
      const r = await submitPostRequest({
        advisorName: profile.name || account?.name || "",
        videoId: video.id,
        title: video.title,
        format: video.format,
        output: { id: out.id, url: out.url, aspect: out.aspect, durationSec: out.durationSec },
        covers: (["short", "long"] as const).flatMap((shape) => (video.covers?.[shape] ? [{ shape, url: video.covers[shape]!.url, frameMs: video.covers[shape]!.frameMs }] : [])),
        platforms: ready,
        captions: ready.map((p) => {
          const c = copies.find((x) => x.platform === p)!;
          return { platform: p, text: composeCaption(c, p, profile), title: c.title };
        }),
        disclosureVersion: activeDisclosure(profile)?.version ?? "none",
        tagline: tagline || undefined,
        timing: when === "at" ? { kind: "at", at: new Date(`${date}T${time}`).toISOString() } : { kind: "asap" },
        note: note.trim() || undefined,
      });
      toast.success("Sent to the team", { description: "You’ll see it here once it’s scheduled." });
      onDone(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[13px] font-medium">Where</div>
        <div className="flex flex-wrap gap-1.5" style={{ ["--pi-bg" as string]: "var(--muted)" }}>
          {ready.length ? ready.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px]"><PlatformIcon id={p} className="size-3" /> {getPlatform(p).label}</span>
          )) : <span className="text-[13px] text-muted-foreground">No captions yet.</span>}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium">When</div>
        <div className="flex flex-wrap gap-2">
          {([["asap", "As soon as possible"], ["at", "On a date I choose"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setWhen(k)} className={cn("cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px]", when === k ? "border-primary bg-brass-soft/70" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        {when === "at" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input type="date" value={date} min={tomorrow.date} onChange={(e) => setDate(e.target.value)} className="h-10 w-auto tnum" />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-10 w-auto tnum" />
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-[13px] font-medium">Anything the team should know? <span className="font-normal text-muted-foreground">(optional)</span></div>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="E.g. post to LinkedIn first, or hold until after our client event." />
      </div>
      {blocker && <p className="text-[13px] text-destructive">{blocker}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="rounded-full px-6" onClick={() => void submit()} disabled={!!blocker || busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Send />} {previous && previous.status !== "cancelled" ? "Send updated request" : "Send to the team"}
        </Button>
        {onCancel && <Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  );
}
