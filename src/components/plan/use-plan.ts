"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { seedDraft } from "@/lib/drafts";
import { goalsOf, monthSummary, nextUp, streakWeeks, weekSummary } from "@/lib/plan";
import type { PlanItem } from "@/lib/types";

/** Goals and progress for the signed-in advisor, recomputed as their videos and posts change. */
export function useAccountability(month = new Date()) {
  const { videos, posts, plan, profile } = useStore();
  const goals = goalsOf(profile.goals);
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  return React.useMemo(() => {
    const now = new Date();
    return {
      goals,
      hasGoals: !!profile.goals,
      week: weekSummary(videos, posts, goals, now),
      month: monthSummary(videos, posts, goals, month, now),
      streak: streakWeeks(videos, goals, now),
      next: nextUp(plan, videos, posts, now),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, posts, plan, profile.goals, monthKey]);
}

/** Open a planned item: start its video or post the first time, continue it after that. */
export function useOpenPlanItem() {
  const router = useRouter();
  const { videos, posts, addVideo, addPost, updatePlanItem } = useStore();
  return React.useCallback(
    (item: PlanItem) => {
      if (item.kind === "video") {
        const v = item.videoId ? videos.find((x) => x.id === item.videoId) : undefined;
        if (v) return router.push(`/studio/${v.id}/${v.stage}`);
        // A planned idea with its points goes straight to the script; a bare title starts at ideas.
        const ready = !!item.outline?.length;
        const made = addVideo({ title: item.title, format: item.format ?? "short", stage: ready ? "script" : "idea", outline: item.outline ?? [], subject: item.subject, angle: item.angle, ...(item.category ? { category: item.category } : {}) });
        if (!ready) {
          seedDraft(made.id, "idea.topic", item.title);
          seedDraft(made.id, "idea.autostart", true);
        }
        updatePlanItem(item.id, { videoId: made.id });
        return router.push(`/studio/${made.id}/${made.stage}`);
      }
      const p = item.postId ? posts.find((x) => x.id === item.postId) : undefined;
      if (p) return router.push(`/posts/${p.id}`);
      const kind = item.postKind ?? "text";
      const made = addPost({ kind, topic: item.title, platforms: kind === "image" ? ["linkedin", "facebook", "instagram"] : ["linkedin", "facebook"] });
      updatePlanItem(item.id, { postId: made.id });
      router.push(`/posts/${made.id}`);
    },
    [videos, posts, addVideo, addPost, updatePlanItem, router]
  );
}
