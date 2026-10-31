"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { getTake, saveTake } from "@/lib/media/takes";
import { readVideoMeta, videoType } from "@/lib/media/video-file";
import { analyzeTake, getPipeline, resetPipeline } from "@/lib/video/client";
import { defaultOverlays } from "@/lib/video/edit-model";
import { ACCEPTED_VIDEO_TYPES, DEFAULT_EDIT, MAX_UPLOAD_LABEL, MAX_UPLOAD_MB } from "@/lib/video/types";

/**
 * A video the advisor already made: skip Idea and Script, go straight to the
 * AI edit. The edit transcribes it, and the transcript becomes the words the
 * captions, covers and posts are written from.
 */
export function useUploadFinished() {
  const router = useRouter();
  const { addVideo, updateVideo, profile } = useStore();
  return React.useCallback(
    async (file?: File | null) => {
      if (!file) return false;
      const type = videoType(file);
      if (!ACCEPTED_VIDEO_TYPES.includes(type)) {
        toast.error("That file isn’t a video we can use", { description: "Use an MP4, MOV or WebM file." });
        return false;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        toast.error(`Videos can be up to ${MAX_UPLOAD_LABEL}`, { description: "Export a smaller copy and try again." });
        return false;
      }
      const meta = await readVideoMeta(file);
      // Taller than wide: a short-form vertical video.
      const vertical = meta ? meta.height > meta.width : true;
      const format = vertical ? "short" : "long";
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      const v = addVideo({ title: name ? name.charAt(0).toUpperCase() + name.slice(1) : "Uploaded video", format, stage: "edit", source: "upload", runtimeSec: meta?.durationSec || 60 });
      saveTake(v.id, {
        blob: file,
        mimeType: type,
        durationSec: meta?.durationSec || 60,
        width: meta?.width ?? (vertical ? 1080 : 1920),
        height: meta?.height ?? (vertical ? 1920 : 1080),
        recordedAt: new Date().toISOString(),
      });
      resetPipeline(v.id);
      const take = getTake(v.id)!;
      // One upload: the edit stores the video as it reads it. As soon as it's stored, it's saved on the video
      // (so a reload doesn't lose it), and the finished reading after that.
      const stored = (sourceId: string) => ({ sourceId, url: `/api/video/files/${sourceId}`, mimeType: take.mimeType.split(";")[0], durationSec: take.durationSec, width: take.width, height: take.height, recordedAt: take.recordedAt });
      let saved = false;
      const watch = setInterval(() => {
        const st = getPipeline(v.id, "analyze");
        if (st?.sourceId && !saved) {
          saved = true;
          updateVideo(v.id, { take: stored(st.sourceId) });
        }
        if (!st || st.phase === "done" || st.phase === "error" || saved) clearInterval(watch);
      }, 500);
      analyzeTake(v.id, take, { aspect: take.height > take.width ? "9:16" : "16:9", edit: DEFAULT_EDIT, overlays: defaultOverlays(profile, format) })
        .then((r) => {
          clearInterval(watch);
          const sourceId = getPipeline(v.id, "analyze")?.sourceId;
          updateVideo(v.id, { analysisJobId: r.jobId, ...(sourceId && !saved ? { take: stored(sourceId) } : {}) });
        })
        .catch((e) => {
          clearInterval(watch);
          toast.error("AI Edit couldn’t process this video", { description: (e as Error).message });
        });
      router.push(`/studio/${v.id}/edit`);
      return true;
    },
    [addVideo, updateVideo, profile, router]
  );
}

/** A button that picks a finished video and sends it straight to the AI edit. */
export function UploadFinishedButton({ className, variant = "outline", label = "Upload a finished video", onPicked }: { className?: string; variant?: "outline" | "default" | "ghost"; label?: string; onPicked?: () => void }) {
  const upload = useUploadFinished();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant={variant} className={className} onClick={() => input.current?.click()}>
        <Upload /> {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void upload(f).then((ok) => ok && onPicked?.());
        }}
      />
    </>
  );
}
