"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { finishAiVideo } from "@/lib/autopilot";

/**
 * Watches the AI videos the content plan started. Looking at a job also moves
 * it along; when one is finished it becomes that video's final cut, captions
 * are written, and the advisor is told it's ready to review.
 */
export function AutopilotSync() {
  const router = useRouter();
  const { hydrated, plan, videos, profile, updateVideo, updatePlanItem } = useStore();
  const busy = React.useRef(new Set<string>());
  const waiting = plan.filter((p) => p.kind === "video" && p.make === "ai" && p.aiJobId && p.videoId && !videos.find((v) => v.id === p.videoId)?.output && p.prep !== "error");
  const key = waiting.map((p) => p.aiJobId).join(",");

  React.useEffect(() => {
    if (!hydrated || !key) return;
    let live = true;
    const check = async () => {
      for (const item of waiting) {
        if (!live || busy.current.has(item.id)) continue;
        busy.current.add(item.id);
        try {
          const r = await fetch(`/api/cinematic/${item.aiJobId}`, { cache: "no-store" });
          const j = await r.json().catch(() => null);
          const job = j?.job;
          const v = videos.find((x) => x.id === item.videoId);
          if (!job || !v) continue;
          if (job.status === "ready") {
            await finishAiVideo(item, v, job, { profile, updateVideo });
            toast.success("Your AI video is ready to review", { description: item.title, action: { label: "Review", onClick: () => router.push(`/studio/${v.id}/post`) } });
          } else if (job.status === "failed") {
            updatePlanItem(item.id, { prep: "error", prepError: job.error ?? "The AI video didn’t work. Open it to try again." });
          }
        } catch {
          /* try again on the next check */
        } finally {
          busy.current.delete(item.id);
        }
      }
    };
    void check();
    const t = window.setInterval(() => void check(), 20_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);
  return null;
}
