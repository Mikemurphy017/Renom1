"use client";

import { CoverStyleSwitch, PhotoSetPanel, useAiPhotosAvailable } from "@/components/studio/photo-set";
import { useStore } from "@/lib/store";

/** Settings → Covers: what goes on them, and the AI photo set. */
export function CoverSettings() {
  const { profile, updateProfile } = useStore();
  const ai = useAiPhotosAvailable();
  const mode = profile.coverPhotos ?? "ai";
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex justify-start">
        <CoverStyleSwitch value={mode} onChange={(m) => updateProfile({ coverPhotos: m })} aiAvailable={ai} />
      </div>
      {mode === "ai" ? (
        <PhotoSetPanel compact />
      ) : (
        <p className="text-[13px] text-muted-foreground">
          {mode === "real" ? "Covers use frames from your video and your headshots. No AI-made pictures of you." : "Covers use your words, colors and graphics only, with no photo."}
        </p>
      )}
    </div>
  );
}
