"use client";

import * as React from "react";
import { ArrowUpToLine, CalendarClock, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteBufferPost, moveBufferPost, rescheduleBufferPost } from "@/lib/buffer/use-buffer";
import type { BufferScheduledPost } from "@/lib/buffer/types";

const can = (post: BufferScheduledPost, action: string) => !post.allowedActions || post.allowedActions.includes(action);
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Reschedule / move to top / delete for one Buffer post (Home → Coming up). */
export function BufferPostMenu({ post, title }: { post: BufferScheduledPost; title: string }) {
  const [dialog, setDialog] = React.useState<"reschedule" | "delete" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const current = post.dueAt ? new Date(post.dueAt) : new Date(Date.now() + 86_400_000);
  const [date, setDate] = React.useState(localDate(current));
  const [time, setTime] = React.useState(localTime(current));
  const when = new Date(`${date}T${time}`);
  const inPast = Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000;
  const queued = post.shareMode !== "customScheduled";

  const open = (d: "reschedule" | "delete") => {
    if (d === "reschedule") {
      setDate(localDate(current));
      setTime(localTime(current));
    }
    setDialog(d);
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, failed: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      toast.success(done);
      setDialog(null);
    } else toast.error(failed, { description: r.error });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0 rounded-full text-muted-foreground" aria-label={`Actions for “${title}”`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          <DropdownMenuItem disabled={!can(post, "updatePostSchedule")} onSelect={() => open("reschedule")}>
            <CalendarClock /> Reschedule…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!queued || busy}
            onSelect={() => run(() => moveBufferPost(post.id, "top"), "Moved to the top of the queue", "Couldn’t move it")}
          >
            <ArrowUpToLine />
            <span className="flex flex-col">
              Move to top of queue
              {!queued && <span className="text-[11px] text-muted-foreground">Set for a fixed time</span>}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!can(post, "deletePost")} onSelect={() => open("delete")} className="text-destructive focus:text-destructive [&_svg]:text-destructive">
            <Trash2 /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "reschedule"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule</DialogTitle>
            <DialogDescription className="line-clamp-2">{title}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`d-${post.id}`}>Date</Label>
              <Input id={`d-${post.id}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`t-${post.id}`}>Time</Label>
              <Input id={`t-${post.id}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {inPast && <p className="text-[12px] text-destructive">Pick a time in the future.</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button disabled={inPast || busy} onClick={() => run(() => rescheduleBufferPost(post.id, when), "Rescheduled in Buffer", "Couldn’t reschedule")}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              “{title}” will be removed from Buffer and won’t be published. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => run(() => deleteBufferPost(post.id), "Deleted from Buffer", "Couldn’t delete it")}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
