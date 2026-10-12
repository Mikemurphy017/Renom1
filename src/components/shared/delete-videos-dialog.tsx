"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Video } from "@/lib/types";

/** "Delete 3 videos?" with the titles, before anything goes. */
export function DeleteVideosDialog({ videos, onCancel, onConfirm }: { videos: Video[]; onCancel: () => void; onConfirm: () => void }) {
  const one = videos.length === 1;
  return (
    <Dialog open={videos.length > 0} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{one ? "Delete this video?" : `Delete ${videos.length} videos?`}</DialogTitle>
          <DialogDescription>
            {one ? "Its idea, script, recording, edit and captions" : "Their ideas, scripts, recordings, edits and captions"} are removed from your studio. You can undo for a few seconds afterwards.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
          {videos.slice(0, 8).map((v) => <li key={v.id} className="truncate">{v.title}</li>)}
          {videos.length > 8 && <li className="text-muted-foreground">and {videos.length - 8} more</li>}
        </ul>
        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" className="rounded-full" onClick={onConfirm} autoFocus><Trash2 /> Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
