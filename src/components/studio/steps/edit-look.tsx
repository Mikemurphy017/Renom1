"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Film, Music2, Pause, Play, Sparkles, Volume2, Wand2, ZoomIn } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BRAND } from "@/lib/brand";
import { useStore } from "@/lib/store";
import { STYLES, MUSIC_CHOICES, extrasFor, getStyle, type StyleCategory, type StyleDef, type StyleId } from "@/lib/video/styles";
import type { CaptionPosition, OverlayOptions, StyleExtras, TranscriptWord } from "@/lib/video/types";
import { cn } from "@/lib/utils";

/** Which overlay the advisor just touched, shown in the preview for a moment. */
export type LookPeek = "captions" | "lowerThird" | "endCard" | null;

const POSITIONS: { id: CaptionPosition; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];
const CATEGORIES: ("All" | StyleCategory)[] = ["All", "Bold", "Polished", "Minimal"];

/** The "Look" panel: pick a style, then fine-tune captions and what the style adds. */
export function LookPanel({
  value,
  onChange,
  brandColors,
  frame,
  stockFootage,
}: {
  value: OverlayOptions;
  onChange: (next: OverlayOptions, peek: LookPeek) => void;
  brandColors: string[];
  /** A still from the take for the style cards. */
  frame?: string;
  stockFootage: boolean;
}) {
  const { profile } = useStore();
  const c = value.captions;
  const st = getStyle(c.style);
  const ex = value.extras;
  const [cat, setCat] = React.useState<(typeof CATEGORIES)[number]>("All");
  const swatches = [...new Set([st.accent, BRAND.captionColor, "#FFFFFF", "#F5C542", ...brandColors.filter((x) => !/^#(0b1f3a|f7f5f0)$/i.test(x))].map((x) => x.toUpperCase()))].slice(0, 6);
  const setCaptions = (patch: Partial<OverlayOptions["captions"]>) => onChange({ ...value, captions: { ...c, ...patch } }, "captions");
  const setExtras = (patch: Partial<StyleExtras>) => onChange({ ...value, extras: { ...ex, ...patch } }, null);
  const pickStyle = (id: StyleId) => {
    const s = getStyle(id);
    onChange({ ...value, captions: { ...c, style: id, color: s.accent }, extras: { ...extrasFor(id, ex), brollMedia: ex.brollMedia } }, "captions");
  };
  const library = profile.library ?? [];
  const brollItems = library.filter((x) => x.kind === "broll");
  const tracks = library.filter((x) => x.kind === "music");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Style</div>
        <div className="flex gap-1">
          {CATEGORIES.map((k) => (
            <button key={k} onClick={() => setCat(k)} className={cn("cursor-pointer rounded-full px-2.5 py-0.5 text-[11px] transition-colors", cat === k ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {STYLES.filter((s) => cat === "All" || s.category === cat).map((s) => (
          <StyleCard key={s.id} style={s} frame={frame} selected={s.id === c.style} onClick={() => pickStyle(s.id)} />
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{st.description}</p>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <Row label="Captions" checked={c.enabled} onChange={(v) => setCaptions({ enabled: v })} />
        <div className={cn("space-y-2.5 transition-opacity", !c.enabled && "pointer-events-none opacity-40")}>
          <ToggleGroup type="single" value={c.position} onValueChange={(v) => v && setCaptions({ position: v as CaptionPosition })} className="w-full" aria-label="Caption position">
            {POSITIONS.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} className="flex-1">{s.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[12px] text-muted-foreground">Highlight</span>
            {swatches.map((hex) => (
              <button
                key={hex}
                onClick={() => setCaptions({ color: hex })}
                aria-label={`Highlight color ${hex}`}
                className={cn("grid size-6 cursor-pointer place-items-center rounded-full border border-border shadow-soft", c.color.toUpperCase() === hex && "ring-2 ring-ring ring-offset-2 ring-offset-card")}
                style={{ background: hex }}
              >
                {c.color.toUpperCase() === hex && <Check className={cn("size-3", /^#(FFFFFF|F5C542|D9B97E|C6FF3D|3CF2B4)$/i.test(hex) ? "text-[#0B1F3A]" : "text-white")} />}
              </button>
            ))}
            <label className="relative ml-auto cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:underline">
              Custom
              <input type="color" value={c.color} onChange={(e) => setCaptions({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom highlight color" />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <div className="eyebrow">What the style adds</div>
        <Row icon={ZoomIn} label="Punch-in zooms" hint="Tighten the frame on the big moments" checked={ex.motion} onChange={(v) => setExtras({ motion: v })} />
        <Row icon={Sparkles} label="Keyword cards" hint={st.card ? "The key word on screen when it lands" : "This style keeps the screen clean"} checked={ex.keywordCards && !!st.card} disabled={!st.card} onChange={(v) => setExtras({ keywordCards: v })} />
        <Row
          icon={Film}
          label="B-roll"
          hint={brollItems.length ? `From your library (${brollItems.length})${stockFootage ? ", then stock footage" : ""}` : stockFootage ? "Stock footage picked for each moment" : "Add clips or photos to your library to use b-roll"}
          checked={ex.broll && (brollItems.length > 0 || stockFootage)}
          disabled={!brollItems.length && !stockFootage}
          onChange={(v) => setExtras({ broll: v, brollMedia: brollItems.map((x) => x.id) })}
        />
        <Row icon={Wand2} label="Sound effects" hint="A soft whoosh or pop on each moment" checked={ex.sfx} onChange={(v) => setExtras({ sfx: v })} />
        <MusicPicker value={ex} onChange={setExtras} tracks={tracks} />
        <Link href="/settings#library" className="block text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Add your own b-roll and music</Link>
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <Row label="Name & credentials" hint={`${value.lowerThird.name}, ${value.lowerThird.credentials}`} checked={value.lowerThird.enabled} onChange={(v) => onChange({ ...value, lowerThird: { ...value.lowerThird, enabled: v } }, "lowerThird")} />
        <Row label="Key-phrase emphasis" hint="Numbers and key terms in the highlight color" checked={value.keyPhrases} onChange={(v) => onChange({ ...value, keyPhrases: v }, "captions")} />
        <Row label="End card" hint={value.endCard.cta} checked={value.endCard.enabled} onChange={(v) => onChange({ ...value, endCard: { ...value.endCard, enabled: v } }, "endCard")} />
      </div>
    </div>
  );
}

function MusicPicker({ value, onChange, tracks }: { value: StyleExtras; onChange: (p: Partial<StyleExtras>) => void; tracks: { id: string; label: string; url: string }[] }) {
  const [playing, setPlaying] = React.useState<string | null>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => () => audio.current?.pause(), []);
  const choices = [...MUSIC_CHOICES.map((m) => ({ id: m.id as string, label: m.label, url: m.id === "none" ? "" : `/api/video/music/${m.id}` })), ...tracks.map((t) => ({ id: `media:${t.id}`, label: t.label, url: t.url }))];
  const toggle = (id: string, url: string) => {
    audio.current?.pause();
    if (playing === id || !url) return setPlaying(null);
    audio.current = new Audio(url);
    audio.current.volume = 0.6;
    audio.current.onended = () => setPlaying(null);
    void audio.current.play().catch(() => setPlaying(null));
    setPlaying(id);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[13px] font-medium"><Music2 className="size-3.5 text-muted-foreground" /> Music</div>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((m) => (
          <span key={m.id} className={cn("inline-flex items-center overflow-hidden rounded-full border text-[12px]", value.music === m.id ? "border-primary bg-brass-soft/70" : "border-border")}>
            <button onClick={() => onChange({ music: m.id as StyleExtras["music"] })} className="cursor-pointer py-1 pr-1.5 pl-2.5">{m.label}</button>
            {m.url && (
              <button onClick={() => toggle(m.id, m.url)} aria-label={`Preview ${m.label}`} className="cursor-pointer py-1 pr-2 pl-0.5 text-muted-foreground hover:text-foreground">
                {playing === m.id ? <Pause className="size-3" /> : <Play className="size-3" />}
              </button>
            )}
          </span>
        ))}
      </div>
      {value.music !== "none" && (
        <div className="flex items-center gap-2">
          <Volume2 className="size-3.5 text-muted-foreground" />
          <Slider value={[Math.round(value.musicVolume * 100)]} min={0} max={100} onValueChange={([v]) => onChange({ musicVolume: v / 100 })} aria-label="Music volume" />
          <span className="w-8 text-right text-[11px] text-muted-foreground tnum">{Math.round(value.musicVolume * 100)}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Music dips automatically while you talk.</p>
    </div>
  );
}

function Row({ label, hint, checked, onChange, disabled, icon: Icon }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-3", disabled && "cursor-default opacity-50")}>
      <span className="flex min-w-0 items-start gap-2">
        {Icon && <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">{label}</span>
          {hint && <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
        </span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

// ── caption rendering (cards + live preview share it) ─────────────────────────

const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

interface Word {
  w: string;
  on: boolean;
  /** Said already (karaoke fill, progressive reveal). */
  past: boolean;
}

/**
 * One caption line, drawn the way the renderer burns it in: big bold caps with a
 * heavy outline, the spoken word lit and slightly larger, key figures in the
 * highlight color. Sized relative to the frame height (cqh units).
 */
export function StyledCaption({ words, accent, keys, frameH }: { style?: StyleDef; words: Word[]; accent: string; keys: Set<string>; frameH: number }) {
  const size = (frameH > 1500 ? 84 : 76) / frameH;
  const hl = /^#?f{6}$/i.test(accent) ? "#D9B97E" : accent;
  const outline = "0 0 0.09em #000, 0.05em 0.05em 0 #000, -0.05em 0.05em 0 #000, 0.05em -0.05em 0 #000, -0.05em -0.05em 0 #000, 0 0.08em 0.06em rgba(0,0,0,.55)";
  return (
    <span className="inline leading-[1.2]" style={{ fontFamily: '"Liberation Sans", Arial, Helvetica, sans-serif', fontWeight: 700, fontSize: `${size * 100}cqh`, color: "#FFFFFF", textShadow: outline }}>
      {words.map((x, i) => {
        const lit = x.on || keys.has(clean(x.w));
        return (
          <React.Fragment key={i}>
            <span className="inline-block" style={{ color: lit ? hl : undefined, transform: x.on ? "scale(1.08)" : undefined }}>
              {x.w.toUpperCase()}
            </span>{" "}
          </React.Fragment>
        );
      })}
    </span>
  );
}

const SAMPLE = ["Your", "bracket", "drops", "at", "65"];

function StyleCard({ style, frame, selected, onClick }: { style: StyleDef; frame?: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("group cursor-pointer rounded-xl p-0.5 text-left transition-all", selected ? "bg-primary" : "hover:bg-border")} aria-pressed={selected}>
      <div className="relative aspect-[9/14] overflow-hidden rounded-[10px] bg-gradient-to-b from-[#2A3B55] to-[#0E1A2E]" style={{ containerType: "size" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {frame && <img src={frame} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        {style.card === "backdrop" && <span className="absolute inset-x-0 top-[12%] text-center font-[Anton] text-[22cqh] leading-none tracking-tight text-transparent" style={{ WebkitTextStroke: `1px ${style.accent}`, fontFamily: "Anton" }}>65</span>}
        {style.card === "banner" && <span className="absolute inset-x-0 top-[66%] bg-[#2347E6] py-[2cqh] text-center text-[9cqh] font-black text-white" style={{ fontFamily: '"Montserrat Black"' }}>BRACKET</span>}
        <div className="absolute inset-x-[6%] top-[40%] text-center">
          <StyledCaption style={style} words={SAMPLE.slice(0, Math.max(3, Math.min(5, style.words[0] + 1))).map((w, i) => ({ w, on: i === 1, past: i <= 1 }))} accent={style.accent} keys={new Set(["65"])} frameH={1920 * 1.25} />
        </div>
        <span className="absolute inset-x-0 bottom-[5%] text-center text-[11px] font-semibold text-white drop-shadow">{style.name}</span>
        {selected && <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2.5" /></span>}
      </div>
    </button>
  );
}

/** Caption words on screen at time t (source timeline), chunked like the renderer. */
export function captionAt(transcript: TranscriptWord[], t: number, style: StyleDef, vertical: boolean): Word[] | null {
  if (!transcript.length) return null;
  const per = vertical ? 3 : 5;
  let chunk: TranscriptWord[] = [];
  let found: TranscriptWord[] | null = null;
  for (const w of transcript) {
    if (chunk.length && w.start - chunk.at(-1)!.end > 0.7) {
      if (t >= chunk[0].start && t < chunk.at(-1)!.end + 0.5) found = chunk;
      chunk = [];
    }
    chunk.push(w);
    if (chunk.length >= per || /[.!?,;:]["”]?$/.test(w.text)) {
      if (t >= chunk[0].start && t < chunk.at(-1)!.end + 0.5) found = chunk;
      chunk = [];
    }
    if (found) break;
  }
  if (!found && chunk.length && t >= chunk[0].start && t < chunk.at(-1)!.end + 0.5) found = chunk;
  if (!found) return null;
  const active = found.reduce((a, w, i) => (t >= w.start ? i : a), -1);
  return found.map((w, i) => ({ w: w.text, on: i === active, past: i <= active }));
}

/** Live captions, lower third and end card drawn over the preview. */
export function PreviewOverlays({
  look,
  caption,
  keyPhrases,
  vertical,
  showLowerThird,
  showEndCard,
}: {
  look: OverlayOptions;
  caption: Word[] | null;
  keyPhrases: string[];
  vertical: boolean;
  showLowerThird: boolean;
  showEndCard: boolean;
}) {
  const c = look.captions;
  const st = getStyle(c.style);
  const keys = React.useMemo(() => new Set(look.keyPhrases ? keyPhrases.flatMap((p) => p.split(/\s+/)).map(clean) : []), [keyPhrases, look.keyPhrases]);
  // Bottom captions on long form sit above the name & credentials, which always take the bottom-left corner.
  const top = c.position === "top" ? "20%" : c.position === "middle" ? (vertical ? "56%" : "50%") : vertical ? "74%" : look.lowerThird.enabled ? "76%" : "85%";

  return (
    <>
      {c.enabled && caption && !showEndCard && (
        <div className="absolute inset-x-[7%] -translate-y-1/2 text-center" style={{ top }}>
          <StyledCaption style={st} words={caption} accent={c.color} keys={keys} frameH={vertical ? 1920 : 1080} />
        </div>
      )}
      {look.lowerThird.enabled && showLowerThird && !showEndCard && (
        <div className="absolute bottom-[6%] left-[5%] flex max-w-[85%] overflow-hidden rounded-md shadow-lg">
          <span className="w-1 shrink-0" style={{ background: c.color }} />
          <div className="bg-[#0B1F3A]/90 px-2.5 py-1.5 text-white">
            <div className="truncate text-[13px] leading-tight font-semibold">
              {look.lowerThird.name}
              <span className="font-normal opacity-80">, {look.lowerThird.credentials}</span>
            </div>
            <div className="truncate text-[10px] tracking-wider uppercase opacity-70">{look.lowerThird.firm}</div>
          </div>
        </div>
      )}
      {look.endCard.enabled && showEndCard && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1F3A]/92 px-6 text-center text-white">
          <span className="h-0.5 w-10 rounded-full" style={{ background: c.color }} />
          <div className="mt-4 font-serif text-[22px] leading-tight">{look.endCard.headline}</div>
          <div className="mt-1 text-[11px] tracking-wider uppercase opacity-70">{look.lowerThird.firm}</div>
          <span className="mt-5 rounded-full border px-3 py-1 text-[12px] font-medium" style={{ borderColor: c.color, color: c.color }}>{look.endCard.cta}</span>
        </div>
      )}
    </>
  );
}
