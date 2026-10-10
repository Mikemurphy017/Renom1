"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own photo, any size */
import * as React from "react";
import { Bookmark, Heart, MessageCircle, Music2, Plus, Send, Volume2, VolumeX } from "lucide-react";
import { initials } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * The finished video as it would look in a vertical feed (TikTok, Reels,
 * Shorts), with the advisor's handle and caption over it. Generic: no
 * network's branding. The engagement numbers are samples, steady per video.
 */

/** "12.4K", "1.2M", "318". */
export const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "")}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : String(n);

/** Sample numbers that feel like a post doing well, the same each time for a video. */
export function sampleStats(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (k: number) => (((h >>> 0) * (k + 1) * 2654435761) % 1000) / 1000;
  const likes = Math.round(8_000 + r(1) * 40_000);
  return { likes, comments: Math.round(likes * (0.02 + r(2) * 0.04)), saves: Math.round(likes * (0.08 + r(3) * 0.08)), shares: Math.round(likes * (0.04 + r(4) * 0.05)) };
}

export const handleFor = (name: string) => `@${(name || "youradvisor").toLowerCase().replace(/[^a-z0-9]+/g, "") || "youradvisor"}`;

export function PhonePreview({
  src,
  aspect,
  seed,
  name,
  avatar,
  caption,
  className,
}: {
  src: string;
  aspect: "9:16" | "16:9";
  /** Keeps the sample numbers steady (the video id). */
  seed: string;
  name: string;
  avatar?: string;
  caption: string;
  className?: string;
}) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [burst, setBurst] = React.useState<{ x: number; y: number; k: number } | null>(null);
  const [more, setMore] = React.useState(false);
  const stats = React.useMemo(() => sampleStats(seed), [seed]);
  const lastTap = React.useRef(0);

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const box = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 300) {
      // Double tap: like it, with a heart where you tapped.
      setLiked(true);
      setBurst({ x: e.clientX - box.left, y: e.clientY - box.top, k: now });
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    window.setTimeout(() => {
      if (lastTap.current !== now) return;
      const v = video.current;
      if (!v) return;
      if (v.paused) void v.play().catch(() => {});
      else v.pause();
    }, 300);
  };

  const text = caption.trim().replace(/\s*\n+\s*/g, " ");

  return (
    <div className={cn("w-[260px] shrink-0 sm:w-[290px]", className)}>
      {/* The phone */}
      <div className="relative rounded-[42px] bg-[#0b0b0d] p-[9px] shadow-[0_24px_60px_-20px_rgba(0,0,0,.55)] ring-1 ring-black/40">
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[34px] bg-black text-white select-none" onClick={tap}>
          <video
            ref={video}
            src={src}
            autoPlay
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
            className={cn("absolute inset-0 h-full w-full", aspect === "9:16" ? "object-cover" : "object-contain")}
          />
          {/* Shade so the white type reads on any video. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

          {/* Status bar and tabs */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-6 pt-2.5 text-[11px] font-semibold">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2 h-[18px] w-[72px] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-[1.5px]">{[4, 6, 8, 10].map((h) => <span key={h} className="w-[2.5px] rounded-sm bg-white" style={{ height: h }} />)}</span>
              <span className="relative ml-1 h-[10px] w-[20px] rounded-[3px] border border-white/80 p-[1px]"><span className="block h-full w-[75%] rounded-[1.5px] bg-white" /></span>
            </span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-center gap-4 text-[13px] font-semibold">
            <span className="text-white/60">Following</span>
            <span className="relative">For You<span className="absolute -bottom-1 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-white" /></span>
          </div>

          {/* Right rail */}
          <div className="absolute right-2 bottom-24 flex flex-col items-center gap-3.5 text-[11px] font-semibold drop-shadow">
            <div className="relative mb-1.5">
              {avatar ? (
                <img src={avatar} alt="" className="size-10 rounded-full border-2 border-white object-cover" />
              ) : (
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-white bg-[#B08D57] text-[13px]">{initials(name) || "R"}</span>
              )}
              <span className="absolute -bottom-2 left-1/2 flex size-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-[#FE2C55]"><Plus className="size-3" strokeWidth={3} /></span>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); setLiked((l) => !l); }} className="flex cursor-pointer flex-col items-center gap-0.5" aria-pressed={liked} aria-label="Like">
              <Heart className={cn("size-8 transition-transform", liked ? "scale-110 fill-[#FE2C55] text-[#FE2C55]" : "fill-white text-white")} />
              <span className="tnum">{compact(stats.likes + (liked ? 1 : 0))}</span>
            </button>
            <span className="flex flex-col items-center gap-0.5"><MessageCircle className="size-8 fill-white text-white" /><span className="tnum">{compact(stats.comments)}</span></span>
            <span className="flex flex-col items-center gap-0.5"><Bookmark className="size-7 fill-white text-white" /><span className="tnum">{compact(stats.saves)}</span></span>
            <span className="flex flex-col items-center gap-0.5"><Send className="size-7 fill-white text-white" /><span className="tnum">{compact(stats.shares)}</span></span>
            <span className="mt-1 flex size-9 animate-[spin_5s_linear_infinite] items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-950 ring-[5px] ring-neutral-800">
              {avatar ? <img src={avatar} alt="" className="size-4 rounded-full object-cover" /> : <span className="size-3 rounded-full bg-[#B08D57]" />}
            </span>
          </div>

          {/* Handle, caption, audio */}
          <div className="absolute right-16 bottom-5 left-3 text-[12.5px] leading-snug drop-shadow">
            <div className="font-semibold">{handleFor(name)}</div>
            {text && (
              <p className={cn("mt-1 text-white/95", !more && "line-clamp-2")} onClick={(e) => { e.stopPropagation(); setMore((m) => !m); }}>
                {text}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-[11.5px] text-white/90">
              <Music2 className="size-3.5 shrink-0" />
              <span className="truncate">Original audio · {name || "You"}</span>
            </div>
          </div>

          {/* Sound */}
          <button type="button" onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }} className="absolute top-16 right-3 flex size-8 cursor-pointer items-center justify-center rounded-full bg-black/35 backdrop-blur" aria-label={muted ? "Sound on" : "Sound off"}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>

          {/* Double-tap heart */}
          {burst && (
            <Heart
              key={burst.k}
              className="pointer-events-none absolute size-24 animate-[renom-heart_.9s_ease-out_forwards] fill-[#FE2C55] text-[#FE2C55] drop-shadow-lg"
              style={{ left: burst.x - 48, top: burst.y - 48 }}
              onAnimationEnd={() => setBurst(null)}
            />
          )}

          {/* Progress */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25"><div className="h-full bg-white/90" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      </div>
      <p className="mt-2.5 text-center text-[11px] text-muted-foreground">Preview · sample numbers · double-tap to like</p>
    </div>
  );
}
