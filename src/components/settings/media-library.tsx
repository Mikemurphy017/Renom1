"use client";

import * as React from "react";
import { Film, ImageIcon, Loader2, Music2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { ACCEPTED_BROLL_TYPES, ACCEPTED_MUSIC_TYPES, MAX_MEDIA_MB } from "@/lib/storage/media-types";
import type { LibraryItem } from "@/lib/types";

/** The advisor's own b-roll (photos, short clips) and music for edit styles. */
export function MediaLibrary() {
  const { profile, updateProfile } = useStore();
  const items = profile.library ?? [];
  const [busy, setBusy] = React.useState<null | "broll" | "music">(null);
  const inputs = { broll: React.useRef<HTMLInputElement>(null), music: React.useRef<HTMLInputElement>(null) };

  const add = async (kind: "broll" | "music", files: FileList | null) => {
    if (!files?.length) return;
    setBusy(kind);
    const added: LibraryItem[] = [];
    try {
      for (const f of Array.from(files).slice(0, 10)) {
        if (f.size > MAX_MEDIA_MB * 1024 * 1024) {
          toast.error(`${f.name} is over ${MAX_MEDIA_MB} MB`);
          continue;
        }
        const up = await uploadImage(f, kind, f.name);
        added.push({ id: up.id, url: up.url, kind, type: f.type, label: f.name.replace(/\.[^.]+$/, "").slice(0, 40), addedAt: new Date().toISOString() });
      }
      if (added.length) {
        updateProfile({ library: [...items, ...added] });
        toast.success(`${added.length} added to your library`);
      }
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
      const el = inputs[kind].current;
      if (el) el.value = "";
    }
  };
  const remove = (id: string) => updateProfile({ library: items.filter((x) => x.id !== id) });

  const broll = items.filter((x) => x.kind === "broll");
  const music = items.filter((x) => x.kind === "music");

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium">B-roll</span>
          <span className="text-[11px] text-muted-foreground">Photos or short clips of your office, team, city, events</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {broll.map((x) => (
            <div key={x.id} className="group relative size-24 overflow-hidden rounded-xl border border-border bg-muted" title={x.label}>
              {x.type.startsWith("video/") ? (
                <video src={x.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={x.url} alt={x.label} className="h-full w-full object-cover" />
              )}
              <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/55 text-white">
                {x.type.startsWith("video/") ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
              </span>
              <RemoveButton label={x.label} onClick={() => remove(x.id)} />
            </div>
          ))}
          <UploadTile busy={busy === "broll"} onClick={() => inputs.broll.current?.click()} />
          <input ref={inputs.broll} type="file" accept={ACCEPTED_BROLL_TYPES.join(",")} multiple hidden onChange={(e) => add("broll", e.target.files)} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-medium">Music</span>
          <span className="text-[11px] text-muted-foreground">Tracks you have the rights to use</span>
        </div>
        <div className="space-y-2">
          {music.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <Music2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{x.label}</span>
              <audio src={x.url} controls preload="none" className="h-8 w-56 max-w-[45%]" />
              <button type="button" onClick={() => remove(x.id)} aria-label={`Remove ${x.label}`} className="cursor-pointer text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
          ))}
          <button type="button" disabled={busy === "music"} onClick={() => inputs.music.current?.click()} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground hover:border-primary/50 disabled:cursor-wait">
            {busy === "music" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy === "music" ? "Saving…" : "Upload a track (MP3, M4A, WAV)"}
          </button>
          <input ref={inputs.music} type="file" accept={ACCEPTED_MUSIC_TYPES.join(",")} multiple hidden onChange={(e) => add("music", e.target.files)} />
        </div>
      </div>
    </div>
  );
}

function UploadTile({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={busy} onClick={onClick} className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/50 disabled:cursor-wait">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Saving…" : "Upload"}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Remove ${label}`} onClick={onClick} className="absolute top-1.5 right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white touch-show opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
      <X className="size-3" />
    </button>
  );
}
