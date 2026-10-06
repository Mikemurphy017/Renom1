"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn, fmtDuration } from "@/lib/utils";
import { FieldLabel } from "./step-layout";

/* ------------------------------------------------------------------ */
/* Settings (remembered on this device)                                */
/* ------------------------------------------------------------------ */

export type PrompterSettings = {
  /** Text size, 20–64 (scaled to the frame). */
  fontSize: number;
  /** Reading pace in words per minute. */
  wpm: number;
  /** Darkness of the panel behind the text, 0–100. */
  opacity: number;
  align: "left" | "center";
  /** Flip the text for glass (beam-splitter) teleprompter rigs. */
  mirrorText: boolean;
};

export const WPM_MIN = 80;
export const WPM_MAX = 240;
export const WPM_STEP = 10;
export const SPEED_PRESETS = [
  { label: "Relaxed", wpm: 120 },
  { label: "Natural", wpm: 145 },
  { label: "Brisk", wpm: 170 },
] as const;

const DEFAULTS: PrompterSettings = { fontSize: 38, wpm: 145, opacity: 60, align: "center", mirrorText: false };
const KEY = "renom.prompter.v1";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function sanitize(raw: Partial<PrompterSettings> | null | undefined): PrompterSettings {
  const r = raw ?? {};
  return {
    fontSize: clamp(Math.round(num(r.fontSize, DEFAULTS.fontSize)), 20, 64),
    wpm: clamp(Math.round(num(r.wpm, DEFAULTS.wpm)), WPM_MIN, WPM_MAX),
    opacity: clamp(Math.round(num(r.opacity, DEFAULTS.opacity)), 0, 100),
    align: r.align === "left" ? "left" : "center",
    mirrorText: r.mirrorText === true,
  };
}

/** Teleprompter preferences, loaded after mount and saved on every change. */
export function usePrompterSettings() {
  const [settings, setSettings] = React.useState<PrompterSettings>(DEFAULTS);
  const current = React.useRef(settings);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const next = sanitize(JSON.parse(raw));
      current.current = next;
      setSettings(next);
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const update = React.useCallback((patch: Partial<PrompterSettings> | ((s: PrompterSettings) => Partial<PrompterSettings>)) => {
    const prev = current.current;
    const next = sanitize({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) });
    current.current = next;
    setSettings(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: settings last for this visit */
    }
  }, []);

  return [settings, update] as const;
}

export type UpdatePrompterSettings = ReturnType<typeof usePrompterSettings>[1];

/* ------------------------------------------------------------------ */
/* Settings panel                                                      */
/* ------------------------------------------------------------------ */

export function PrompterSettingsPanel({ settings, update }: { settings: PrompterSettings; update: UpdatePrompterSettings }) {
  const preset = SPEED_PRESETS.find((p) => p.wpm === settings.wpm);
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel hint={<span className="tnum">{settings.wpm} words/min</span>}>Reading pace</FieldLabel>
        <ToggleGroup type="single" value={preset ? String(preset.wpm) : ""} onValueChange={(v) => v && update({ wpm: Number(v) })} className="mb-3 w-full">
          {SPEED_PRESETS.map((p) => (
            <ToggleGroupItem key={p.wpm} value={String(p.wpm)} className="flex-1">{p.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Slider value={[settings.wpm]} min={WPM_MIN} max={WPM_MAX} step={5} onValueChange={([v]) => update({ wpm: v })} aria-label="Reading pace" />
      </div>
      <div>
        <FieldLabel hint={<span className="tnum">{settings.fontSize}</span>}>Text size</FieldLabel>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">A</span>
          <Slider value={[settings.fontSize]} min={20} max={64} onValueChange={([v]) => update({ fontSize: v })} aria-label="Text size" />
          <span className="text-[16px] text-muted-foreground">A</span>
        </div>
      </div>
      <div>
        <FieldLabel hint={<span className="tnum">{settings.opacity}%</span>}>Backdrop</FieldLabel>
        <Slider value={[settings.opacity]} min={0} max={100} onValueChange={([v]) => update({ opacity: v })} aria-label="Backdrop darkness" />
      </div>
      <div>
        <FieldLabel>Alignment</FieldLabel>
        <ToggleGroup type="single" value={settings.align} onValueChange={(v) => v && update({ align: v as "left" | "center" })} className="w-full">
          <ToggleGroupItem value="left" className="flex-1">Left</ToggleGroupItem>
          <ToggleGroupItem value="center" className="flex-1">Center</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-medium">Mirror text</div>
          <div className="text-[11px] text-muted-foreground">For glass teleprompter rigs</div>
        </div>
        <Switch checked={settings.mirrorText} onCheckedChange={(v) => update({ mirrorText: v })} aria-label="Mirror text" />
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Check className="size-3" /> Remembered on this device</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard shortcut hint                                              */
/* ------------------------------------------------------------------ */

const SHORTCUTS: [string, string][] = [
  ["Space", "Pause / resume scrolling"],
  ["↑ ↓", "Faster / slower"],
  ["← →", "Back / forward a line"],
  ["R", "Back to the top"],
];

export function PrompterShortcuts() {
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-medium">Teleprompter shortcuts</div>
      <ul className="space-y-2">
        {SHORTCUTS.map(([k, label]) => (
          <li key={k} className="flex items-center justify-between gap-4 text-[12px] text-muted-foreground">
            <span>{label}</span>
            <kbd className="min-w-8 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-sans text-[11px] text-foreground">{k}</kbd>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Or tap the script to pause, and drag or scroll to move it.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The prompter                                                        */
/* ------------------------------------------------------------------ */

export type TeleprompterHandle = {
  /** Jump to a position, in words from the start (0 = top). */
  seek: (words: number) => void;
};

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Where the reading line sits, as a share of the prompter's height: high, close to the lens. */
const READ_AT = 0.26;
const LINE_HEIGHT = 1.4;

function isTyping(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return !!el.closest('[role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [role="radiogroup"], [role="tablist"], [role="dialog"], [role="alertdialog"]');
}

export function Teleprompter({
  ref,
  lines,
  settings,
  update,
  vertical,
  playing,
  onPlayingChange,
  recording,
  keyboard = true,
}: {
  ref?: React.Ref<TeleprompterHandle>;
  lines: string[];
  settings: PrompterSettings;
  update: UpdatePrompterSettings;
  vertical: boolean;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  recording: boolean;
  /** Listen for keyboard shortcuts (off while a dialog is open). */
  keyboard?: boolean;
}) {
  const scriptKey = lines.join("\n");
  const totalWords = Math.max(1, lines.reduce((a, l) => a + countWords(l), 0));
  const [pos, setPos] = React.useState(0); // words read so far
  const [box, setBox] = React.useState({ h: 0, end: 0 });
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLDivElement>(null);
  const endRef = React.useRef<HTMLParagraphElement>(null);
  const dragging = React.useRef(false);

  const fontPx = settings.fontSize * (vertical ? 0.62 : 0.8);
  const linePx = fontPx * LINE_HEIGHT;
  const lineY = Math.round(box.h * READ_AT);
  // Scrolling is measured in words, so pace stays true whatever the text size or frame.
  const pxPerWord = box.end > 0 ? box.end / totalWords : 0;
  const atEnd = pos >= totalWords;

  React.useImperativeHandle(ref, () => ({ seek: (w: number) => setPos(clamp(w, 0, totalWords)) }), [totalWords]);

  // New script: start from the top.
  React.useEffect(() => setPos(0), [scriptKey]);

  // Measure the frame and the script.
  React.useLayoutEffect(() => {
    const vp = viewportRef.current;
    const text = textRef.current;
    if (!vp || !text) return;
    const measure = () => setBox({ h: vp.clientHeight, end: (endRef.current?.offsetTop ?? 0) - lineY });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(text);
    return () => ro.disconnect();
  }, [lineY, fontPx, scriptKey]);

  // Scroll loop.
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!dragging.current) setPos((p) => Math.min(totalWords, p + (dt * settings.wpm) / 60));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, settings.wpm, totalWords]);

  // Come to rest gently at the end of the script.
  React.useEffect(() => {
    if (playing && atEnd) onPlayingChange(false);
  }, [playing, atEnd, onPlayingChange]);

  const toggle = React.useCallback(() => {
    if (!playing && atEnd) setPos(0);
    onPlayingChange(!playing);
  }, [playing, atEnd, onPlayingChange]);

  const nudge = React.useCallback(
    (px: number) => {
      if (!pxPerWord) return;
      setPos((p) => clamp(p + px / pxPerWord, 0, totalWords));
    },
    [pxPerWord, totalWords]
  );

  // Keyboard shortcuts.
  React.useEffect(() => {
    if (!keyboard) return;
    const inScope = (e: KeyboardEvent) => {
      const t = e.target as Element | null;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(t)) return false;
      // Space on a button elsewhere on the page keeps its normal meaning.
      if (e.key === " " && t && t !== document.body && !t.closest("[data-prompter-scope]") && t.closest("button, a, [role='button'], [role='checkbox']")) return false;
      return true;
    };
    const onDown = (e: KeyboardEvent) => {
      if (!inScope(e)) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (!e.repeat) toggle();
          break;
        case "ArrowUp":
          e.preventDefault();
          update((s) => ({ wpm: s.wpm + WPM_STEP }));
          break;
        case "ArrowDown":
          e.preventDefault();
          update((s) => ({ wpm: s.wpm - WPM_STEP }));
          break;
        case "ArrowLeft":
          e.preventDefault();
          nudge(-linePx);
          break;
        case "ArrowRight":
          e.preventDefault();
          nudge(linePx);
          break;
        case "r":
        case "R":
          e.preventDefault();
          setPos(0);
          break;
      }
    };
    // Browsers "click" a focused button on Space keyup; stop that so Space never doubles up.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " " && inScope(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [keyboard, toggle, nudge, update, linePx]);

  // Mouse wheel / trackpad moves the script (needs a non-passive listener).
  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      nudge(e.deltaMode === 1 ? e.deltaY * linePx : e.deltaY);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [nudge, linePx]);

  // Tap to pause/resume, drag to move.
  const pointer = React.useRef<{ id: number; startY: number; lastY: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pointer.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    if (!dragging.current && Math.abs(e.clientY - p.startY) > 6) dragging.current = true;
    if (dragging.current) nudge(p.lastY - e.clientY);
    p.lastY = e.clientY;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    if (!dragging.current) toggle();
    dragging.current = false;
    pointer.current = null;
  };
  const onPointerCancel = () => {
    dragging.current = false;
    pointer.current = null;
  };

  const offset = pos * pxPerWord;
  const progress = pos / totalWords;
  const secondsLeft = Math.max(0, ((totalWords - pos) / settings.wpm) * 60);
  const mask =
    box.h > 0
      ? `linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.38) ${Math.max(0, lineY - linePx * 0.6)}px, #000 ${lineY - 4}px, #000 ${box.h - 36}px, rgba(0,0,0,0.35) ${box.h}px)`
      : undefined;

  let hint: string | null = null;
  if (atEnd) hint = recording ? "That’s the script. Stop when you’re ready." : "End of script · press R or tap to start over";
  else if (!playing && !recording && pos === 0) hint = "Scrolls on its own after 3-2-1 · tap or press Space to preview";
  else if (!playing) hint = "Paused · tap or press Space to resume";

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Teleprompter"
      className="absolute inset-x-0 top-0 h-[50%] cursor-pointer touch-none overflow-hidden select-none"
      style={{ background: `rgba(6,16,31,${settings.opacity / 100})` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Script, dimmed above the reading line */}
      <div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <div className="h-full" style={{ transform: settings.mirrorText ? "scaleX(-1)" : undefined }}>
          <div
            ref={textRef}
            className={cn("relative px-[7%] font-medium text-white will-change-transform", settings.align === "center" ? "text-center" : "text-left")}
            style={{
              fontSize: fontPx,
              lineHeight: LINE_HEIGHT,
              paddingTop: lineY,
              paddingBottom: box.h,
              transform: `translate3d(0, ${-offset}px, 0)`,
              textShadow: "0 1px 3px rgba(0,0,0,0.65)",
              textWrap: "pretty",
            }}
          >
            {lines.map((l, i) => (
              <p key={i} className="mb-[0.9em]">{l}</p>
            ))}
            <p ref={endRef} className="flex items-center justify-center gap-2 text-[0.7em] tracking-wide text-[#D2B07A]">
              <span className="h-px w-8 bg-[#D2B07A]/60" /> End <span className="h-px w-8 bg-[#D2B07A]/60" />
            </p>
          </div>
        </div>
      </div>

      {/* Reading line: brass markers at eye level, just under the lens */}
      {box.h > 0 && (
        <div className="pointer-events-none absolute inset-x-0" style={{ top: lineY - linePx * 0.15, height: linePx * 1.3 }} aria-hidden>
          <div className="absolute inset-0 bg-white/[0.05]" />
          <span className="absolute top-1/2 left-0 -translate-y-1/2 border-y-[6px] border-l-[8px] border-y-transparent border-l-[#D2B07A]" />
          <span className="absolute top-1/2 right-0 -translate-y-1/2 border-y-[6px] border-r-[8px] border-y-transparent border-r-[#D2B07A]" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-[#D2B07A]/35" />
        </div>
      )}

      {/* Status hint */}
      {hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-3">
          <span className="rounded-full bg-[#06101F]/75 px-3 py-1 text-center text-[11px] text-white/80 backdrop-blur-sm animate-in fade-in-0">{hint}</span>
        </div>
      )}

      {/* Progress */}
      <div className="pointer-events-none absolute top-2.5 right-2.5 rounded bg-[#06101F]/60 px-1.5 py-0.5 text-[10px] text-white/70 tnum">
        {atEnd ? "Done" : `${fmtDuration(Math.ceil(secondsLeft))} left`}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0">
        <div className="h-[2px] bg-white/10">
          <div className="h-full bg-[#D2B07A] transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
