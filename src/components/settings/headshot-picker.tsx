"use client";

import * as React from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/storage/media-types";

/** Upload, order and remove headshots. The first one is primary. */
export function HeadshotPicker({ compact }: { compact?: boolean }) {
  const { profile, updateProfile } = useStore();
  const photos = profile.headshots.filter((h) => h.url);
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const size = compact ? "size-20" : "size-24";

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const f of Array.from(files).slice(0, 6)) {
        const up = await uploadImage(f, "headshot", "headshot");
        added.push({ id: up.id, label: f.name.replace(/\.[^.]+$/, ""), pose: "center" as const, url: up.url });
        if (up.storage === "disk") toast.warning("Saved on this server only", { description: "Connect the storage bucket so photos survive a redeploy." });
      }
      updateProfile({ headshots: [...photos, ...added] });
      toast.success(added.length > 1 ? `${added.length} headshots saved` : "Headshot saved");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {photos.map((h, i) => (
        <div key={h.id} className={`group relative ${size} overflow-hidden rounded-xl border border-border bg-muted`} title={h.label}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={h.url} alt={h.label} className="absolute inset-0 h-full w-full object-cover" />
          {i === 0 ? (
            <Badge variant="navy" className="absolute top-1.5 left-1.5">Primary</Badge>
          ) : (
            <button
              type="button"
              onClick={() => updateProfile({ headshots: [h, ...photos.filter((x) => x.id !== h.id)] })}
              className="absolute inset-x-1.5 bottom-1.5 cursor-pointer rounded-md bg-black/55 py-0.5 text-[10px] font-medium text-white touch-show opacity-0 backdrop-blur-sm transition group-hover:opacity-100 focus-visible:opacity-100"
            >
              Make primary
            </button>
          )}
          <button
            type="button"
            aria-label={`Remove ${h.label}`}
            onClick={() => updateProfile({ headshots: photos.filter((x) => x.id !== h.id) })}
            className="absolute top-1.5 right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white touch-show opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={`flex ${size} cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/50 disabled:cursor-wait`}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Saving…" : "Upload"}
      </button>
      <input ref={input} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple hidden onChange={(e) => add(e.target.files)} />
    </div>
  );
}
