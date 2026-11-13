"use client";

import * as React from "react";
import { CalendarCheck, Check, Send, Users } from "lucide-react";
import { CELEBRATE_EVENT, celebrationCopy, type CelebrateDetail } from "@/lib/celebrate";

/**
 * The celebration itself: a burst of confetti in the brand colours and a small
 * card in the middle of the screen, gone in a few seconds (or on a click or
 * Esc). People who ask for reduced motion get the card without the confetti.
 */

const COLORS = ["#B08D57", "#D9B97E", "#E8CFA4", "#0B1F3A", "#2F5D8A", "#F7F5F0"];
const SHOW_MS = 3600;

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  w: number;
  h: number;
  spin: number;
  color: string;
  round: boolean;
}

function burst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  // Two bursts from the lower corners, angled in, plus a few from the centre.
  const pieces: Piece[] = [];
  const add = (x: number, y: number, angle: number, spread: number, n: number, speed: number) => {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.55 + Math.random() * 0.6);
      pieces.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, spin: (Math.random() - 0.5) * 0.3, color: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.25 });
    }
  };
  const speed = Math.max(13, Math.min(22, H / 42));
  add(0, H * 0.95, -Math.PI / 3, 0.7, 70, speed);
  add(W, H * 0.95, (-2 * Math.PI) / 3, 0.7, 70, speed);
  add(W / 2, H * 0.42, -Math.PI / 2, Math.PI * 1.4, 40, speed * 0.6);

  let raf = 0;
  const start = performance.now();
  const frame = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, W, H);
    for (const p of pieces) {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.spin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1800) / 900);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.h, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
      ctx.restore();
    }
    if (age < 2800) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

const ICON = { now: Send, scheduled: CalendarCheck, team: Users, manual: Check } as const;

export function Celebration() {
  const [shown, setShown] = React.useState<(CelebrateDetail & { key: number }) | null>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const on = (e: Event) => setShown({ ...(e as CustomEvent<CelebrateDetail>).detail, key: Date.now() });
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => window.removeEventListener(CELEBRATE_EVENT, on);
  }, []);

  React.useEffect(() => {
    if (!shown) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const stop = !reduce && canvas.current ? burst(canvas.current) : () => {};
    const t = window.setTimeout(() => setShown(null), SHOW_MS);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setShown(null);
    window.addEventListener("keydown", key);
    return () => {
      stop();
      window.clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
  }, [shown]);

  if (!shown) return null;
  const { title, body } = celebrationCopy(shown);
  const Icon = ICON[shown.kind];
  return (
    <div key={shown.key} className="fixed inset-0 z-[100] flex items-center justify-center p-6" onClick={() => setShown(null)} role="status" aria-live="polite">
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <div className="relative w-full max-w-sm animate-in rounded-3xl border border-border bg-card px-7 py-7 text-center shadow-[0_24px_60px_-20px_rgba(11,31,58,.45)] duration-300 fade-in-0 zoom-in-90">
        <span className="mx-auto flex size-14 animate-in items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-6px_rgba(176,141,87,.7)] delay-150 duration-500 zoom-in-50 fill-mode-both">
          <Icon className="size-6" strokeWidth={2.4} />
        </span>
        <h2 className="mt-4 font-serif text-[28px] leading-tight">{title}</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
