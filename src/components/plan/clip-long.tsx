"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Film, Scissors, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUploadFinished } from "@/components/layout/upload-finished";
import { useStore } from "@/lib/store";
import { seedDraft } from "@/lib/drafts";
import { clippable } from "@/lib/video/clips";
import { fmtDuration, relativeTime } from "@/lib/utils";

/** Pick a long recording (or upload one) to turn into a month of short clips. */
export function ClipLongDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { videos } = useStore();
  const upload = useUploadFinished();
  const input = React.useRef<HTMLInputElement>(null);
  const long = videos.filter((v) => v.take && v.source !== "clip" && clippable(v.take.durationSec)).sort((a, b) => b.lastEdited.localeCompare(a.lastEdited)).slice(0, 8);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><Scissors className="size-5 text-primary" /> Clip a long video</DialogTitle>
          <DialogDescription>A webinar, a podcast, a client event, a long-form video. Renom reads it, finds the moments that stand on their own, makes each a vertical short and spreads them across your open days.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button className="w-full rounded-full" onClick={() => input.current?.click()}><Upload /> Upload a long video</Button>
          <input
            ref={input}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void upload(f, { clips: true }).then((ok) => ok && onOpenChange(false));
            }}
          />
          {long.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-medium">Or use one you already have</div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {long.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Film className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-1 text-[13px] font-medium">{v.title}</div>
                      <div className="text-[12px] text-muted-foreground tnum">{fmtDuration(v.take!.durationSec)} · {relativeTime(v.lastEdited)}</div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => { seedDraft(v.id, "edit.clips.open", true); onOpenChange(false); router.push(`/studio/${v.id}/edit`); }}>Clip it</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-muted-foreground">Works best on recordings of 5 minutes or more where you make several separate points. Reading a long video takes a few minutes; keep the tab open.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
