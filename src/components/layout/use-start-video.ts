"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { seedDraft } from "@/lib/drafts";
import type { VideoFormat } from "@/lib/types";

/** Create a video from a topic and open it in the studio, ready to suggest ideas. */
export function useStartVideo() {
  const router = useRouter();
  const { addVideo } = useStore();
  return (topic: string, format: VideoFormat = "short") => {
    const t = topic.trim();
    const v = addVideo({ title: t ? t.charAt(0).toUpperCase() + t.slice(1) : "Untitled video", format });
    seedDraft(v.id, "idea.topic", t);
    seedDraft(v.id, "idea.autostart", true);
    router.push(`/studio/${v.id}/idea`);
  };
}
