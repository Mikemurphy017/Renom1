"use client";

import * as React from "react";
import { toast } from "sonner";
import { putDrafts, takeDrafts } from "./drafts";
import { useStore } from "./store";
import type { Video } from "./types";

/**
 * Deleting ideas and videos the advisor won't use. What has gone out, or is
 * about to, stays: it's part of their books and records, and a scheduled post
 * still needs its video.
 */
export function deleteBlocker(v: Video): string | null {
  if (v.status === "published" || v.posts?.length) return "Posted videos are kept for your records.";
  if (v.status === "scheduled") return "It’s scheduled to post. Cancel the post first.";
  if (v.teamPost && ["submitted", "in_buffer", "scheduled"].includes(v.teamPost.status)) return "It’s with your team to post. Withdraw the request first.";
  return null;
}

export const isIdea = (v: Video) => v.status === "in_progress" && (v.stage === "idea" || v.stage === "script") && !v.take;

/** Delete videos (and their drafts), with Undo on the toast. Returns how many went. */
export function useDeleteVideos() {
  const { videos, reviews, deleteVideo, restoreVideos } = useStore();
  return React.useCallback(
    (ids: string[]) => {
      const gone = videos.filter((v) => ids.includes(v.id) && !deleteBlocker(v));
      if (!gone.length) return 0;
      const saved = gone.map((video) => ({ video, reviews: reviews.filter((r) => r.videoId === video.id), drafts: takeDrafts(video.id) }));
      gone.forEach((v) => deleteVideo(v.id));
      toast.success(gone.length === 1 ? `Deleted “${gone[0].title}”` : `Deleted ${gone.length} videos`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            restoreVideos(saved);
            saved.forEach((s) => putDrafts(s.drafts));
            toast.success(gone.length === 1 ? "Restored" : `Restored ${gone.length} videos`);
          },
        },
      });
      return gone.length;
    },
    [videos, reviews, deleteVideo, restoreVideos]
  );
}
