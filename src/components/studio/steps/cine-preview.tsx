"use client";

import * as React from "react";
import { PUSH_IN, cineOn, previewFilter, previewTint, type CineLook } from "@/lib/video/cine-look";

/**
 * The cinematic look on the live preview, approximated in CSS. The render
 * applies the real grade, grain, vignette, push-in and soft focus.
 */

/** Style for the preview <video>: the grade's filter and the push-in at this point of the video (0–1). */
export function cineVideoStyle(c: CineLook | undefined, progress: number): React.CSSProperties | undefined {
  if (!cineOn(c)) return undefined;
  const filter = previewFilter(c);
  const scale = c.pushIn ? 1 + PUSH_IN * Math.max(0, Math.min(1, progress)) : 1;
  return { filter: filter || undefined, transform: scale !== 1 ? `scale(${scale.toFixed(4)})` : undefined, transformOrigin: "50% 40%" };
}

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>"
)}")`;

/** Layers over the preview video: tint, soft-focus edges, vignette and grain. */
export function CinePreviewLayers({ look, vertical }: { look: CineLook | undefined; vertical: boolean }) {
  if (!cineOn(look)) return null;
  const tint = previewTint(look);
  const ellipse = vertical ? "46% 34% at 50% 40%" : "30% 46% at 50% 42%";
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {tint && <div className="absolute inset-0" style={{ background: tint, mixBlendMode: "soft-light" }} />}
      {look.softFocus && (
        <div
          className="absolute inset-0"
          style={{ backdropFilter: "blur(2.5px)", WebkitBackdropFilter: "blur(2.5px)", maskImage: `radial-gradient(ellipse ${ellipse}, transparent 80%, black 130%)`, WebkitMaskImage: `radial-gradient(ellipse ${ellipse}, transparent 80%, black 130%)` }}
        />
      )}
      {look.vignette && <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 70% at 50% 45%, transparent 55%, rgba(0,0,0,.5) 100%)" }} />}
      {look.grain && <div className="absolute inset-0 opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: GRAIN, backgroundSize: "160px 160px" }} />}
    </div>
  );
}
