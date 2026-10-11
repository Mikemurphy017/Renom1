"use client";

import * as React from "react";
import { useStore } from "@/lib/store";
import type { Video } from "@/lib/types";
import { coverForOutput, coverIntroNeeded, coverIntroOn, plainOutput, syncCoverIntro } from "@/lib/video/cover-intro";

/**
 * Keeps the finished video starting on its cover: adds it when a cover is
 * picked or the video is re-rendered, swaps it when the cover changes, and
 * takes it off when the advisor switches it off.
 */
export function useCoverIntro(video: Video) {
  const { updateVideo } = useStore();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [attempt, setAttempt] = React.useState(0);
  const latest = React.useRef(video);
  latest.current = video;

  const need = coverIntroNeeded(video);
  const key = need ? `${need}:${video.output && plainOutput(video.output).id}:${coverForOutput(video)?.id}` : "";

  React.useEffect(() => {
    if (!key) {
      setBusy(false);
      return;
    }
    let live = true;
    const from = latest.current.output && plainOutput(latest.current.output).id;
    setBusy(true);
    setError(undefined);
    syncCoverIntro(latest.current)
      .then((out) => {
        // Only if the render it was made from is still this video's render.
        const now = latest.current.output;
        if (!out || !now || plainOutput(now).id !== from) return;
        updateVideo(latest.current.id, { output: out, outputUrl: out.url });
      })
      .catch((e: Error) => live && setError(e.message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return {
    on: coverIntroOn(video),
    /** There's a cover to put at the start (one in the render's shape). */
    available: !!video.output && !!coverForOutput(video),
    added: !!video.output?.withCover,
    busy,
    error,
    setOn: (on: boolean) => updateVideo(video.id, { coverIntro: on }),
    retry: () => setAttempt((a) => a + 1),
  };
}
