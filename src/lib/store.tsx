"use client";

import * as React from "react";
import type { ComplianceStatus, StageId, Video } from "./types";
import { VIDEOS } from "./mock/videos";
import { REVIEW_QUEUE, type ReviewComment, type ReviewItem } from "./mock/compliance";
import { TODAY } from "./utils";

/**
 * In-memory app store seeded with mock data. Every mutation goes through
 * these functions so they can later be replaced by API calls.
 */
interface Store {
  videos: Video[];
  getVideo: (id: string) => Video | undefined;
  updateVideo: (id: string, patch: Partial<Video>) => void;
  addVideo: (v: Partial<Video> & Pick<Video, "title">) => Video;
  setStage: (id: string, stage: StageId) => void;
  reviews: ReviewItem[];
  setReviewStatus: (id: string, status: ComplianceStatus) => void;
  resolveComment: (reviewId: string, commentId: string) => void;
  submitForReview: (videoId: string, kind?: ReviewItem["kind"]) => void;
  addComment: (reviewId: string, c: Omit<ReviewComment, "id" | "at" | "resolved">) => void;
  requireApproval: boolean;
  setRequireApproval: (v: boolean) => void;
}

const StoreContext = React.createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = React.useState<Video[]>(VIDEOS);
  const [reviews, setReviews] = React.useState<ReviewItem[]>(REVIEW_QUEUE);
  const [requireApproval, setRequireApproval] = React.useState(true);

  const value = React.useMemo<Store>(
    () => ({
      videos,
      getVideo: (id) => videos.find((v) => v.id === id),
      updateVideo: (id, patch) =>
        setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, ...patch, lastEdited: new Date().toISOString() } : v))),
      addVideo: (partial) => {
        const v: Video = {
          id: `v${Math.random().toString(36).slice(2, 7)}`,
          category: "Wealth Strategy",
          format: "short",
          stage: "idea",
          status: "in_progress",
          mode: "evergreen",
          outline: [],
          runtimeSec: 55,
          platforms: [],
          compliance: "draft",
          createdAt: TODAY.toISOString(),
          lastEdited: new Date().toISOString(),
          ...partial,
        };
        setVideos((vs) => [v, ...vs]);
        return v;
      },
      setStage: (id, stage) =>
        setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, stage, lastEdited: new Date().toISOString() } : v))),
      reviews,
      setReviewStatus: (id, status) => {
        setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
        const r = reviews.find((x) => x.id === id);
        if (r) setVideos((vs) => vs.map((v) => (v.id === r.videoId ? { ...v, compliance: status } : v)));
      },
      resolveComment: (reviewId, commentId) =>
        setReviews((rs) =>
          rs.map((r) =>
            r.id === reviewId ? { ...r, comments: r.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)) } : r
          )
        ),
      submitForReview: (videoId, kind = "Video + script") => {
        setReviews((rs) => {
          const existing = rs.find((r) => r.videoId === videoId && r.kind === kind);
          if (existing) return rs.map((r) => (r === existing ? { ...r, status: "submitted", submittedAt: new Date().toISOString() } : r));
          return [
            {
              id: `r${Math.random().toString(36).slice(2, 7)}`,
              videoId,
              kind,
              status: "submitted",
              submittedAt: new Date().toISOString(),
              submittedBy: "Catherine Hale",
              reviewer: "Ruth Lindqvist",
              dueAt: new Date(TODAY.getTime() + 2 * 86400000).toISOString(),
              comments: [],
            },
            ...rs,
          ];
        });
        setVideos((vs) => vs.map((v) => (v.id === videoId ? { ...v, compliance: "submitted" } : v)));
      },
      addComment: (reviewId, c) =>
        setReviews((rs) =>
          rs.map((r) =>
            r.id === reviewId ? { ...r, comments: [...r.comments, { ...c, id: `c${Date.now()}`, at: new Date().toISOString(), resolved: false }] } : r
          )
        ),
      requireApproval,
      setRequireApproval,
    }),
    [videos, reviews, requireApproval]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
