import { ImageOff } from "lucide-react";
import type { ThumbnailSpec, VideoFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Headshot } from "./headshot";

const STYLES: Record<ThumbnailSpec["style"], { bg: string; text: string; accent: string; rule: string }> = {
  navy: { bg: "linear-gradient(160deg,#13294A 0%,#0B1F3A 60%,#081629 100%)", text: "#F7F5F0", accent: "#D2B07A", rule: "#B08D57" },
  ivory: { bg: "linear-gradient(160deg,#FBFAF6 0%,#EFEBE1 100%)", text: "#0B1F3A", accent: "#9C7A47", rule: "#0B1F3A" },
  brass: { bg: "linear-gradient(160deg,#C9A76F 0%,#A8844E 100%)", text: "#0B1F3A", accent: "#FFFFFF", rule: "#0B1F3A" },
  slate: { bg: "linear-gradient(160deg,#3D5371 0%,#22344F 100%)", text: "#FFFFFF", accent: "#E8CFA4", rule: "#E8CFA4" },
};

interface Props {
  spec?: ThumbnailSpec;
  format?: VideoFormat;
  className?: string;
  /** scale headline font for small renders */
  size?: "xs" | "sm" | "md" | "lg";
  label?: string;
  /** A rendered cover image; drawn instead of the spec when present. */
  image?: string;
}

/** Renders a generated thumbnail: brand background, advisor headshot, bold overlay text. */
export function VideoThumb({ spec, format = "short", className, size = "md", label, image }: Props) {
  const aspect = format === "short" ? "aspect-[9/16]" : "aspect-video";
  if (image) {
    return (
      <div className={cn(aspect, "relative overflow-hidden rounded-md bg-muted", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={spec?.headline ?? ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {label && <span className="absolute top-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white tnum backdrop-blur-sm">{label}</span>}
      </div>
    );
  }
  if (!spec) {
    return (
      <div
        className={cn(
          aspect,
          "relative flex items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted text-muted-foreground",
          className
        )}
        style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in oklab, var(--border) 50%, transparent) 8px 9px)" }}
      >
        <ImageOff className="size-4 opacity-60" />
      </div>
    );
  }
  const s = STYLES[spec.style];
  const words = spec.headline.split(" ");
  const accentWords = new Set((spec.accent ?? "").split(" "));
  const vertical = format === "short";

  return (
    <div className={cn(aspect, "@container relative overflow-hidden rounded-md", className)} style={{ background: s.bg }}>
      <Headshot
        pose={spec.pose}
        className={cn(
          "absolute bottom-0",
          vertical ? "left-1/2 h-[62%] -translate-x-1/2" : spec.pose === "left" ? "left-[4%] h-[92%]" : "right-[4%] h-[92%]"
        )}
      />
      <div
        className={cn(
          "absolute flex flex-col",
          vertical ? "inset-x-[8%] top-[9%] items-center text-center" : spec.pose === "left" ? "right-[5%] top-1/2 w-[52%] -translate-y-1/2" : "left-[6%] top-1/2 w-[52%] -translate-y-1/2"
        )}
      >
        <span
          className="font-sans leading-[0.95] font-extrabold tracking-[-0.02em] uppercase [overflow-wrap:anywhere]"
          style={{ fontSize: vertical ? "clamp(5px, 11.5cqw, 64px)" : "clamp(5px, 6.4cqw, 64px)", color: s.text, textShadow: spec.style === "navy" || spec.style === "slate" ? "0 2px 12px rgba(0,0,0,.25)" : undefined }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: accentWords.has(w) ? s.accent : undefined }}>
              {w}{" "}
            </span>
          ))}
        </span>
        <span className={cn("mt-[6%] h-[3px] w-[22%] rounded-full", size === "xs" && "h-px")} style={{ background: s.rule }} />
      </div>
      {label && (
        <span className="absolute top-1.5 right-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white tnum backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}
