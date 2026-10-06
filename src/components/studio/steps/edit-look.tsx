"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BRAND } from "@/lib/brand";
import type { CaptionPosition, CaptionStyle, OverlayOptions } from "@/lib/video/types";
import { cn } from "@/lib/utils";

/** Which overlay the advisor just touched, shown in the preview for a moment. */
export type LookPeek = "captions" | "lowerThird" | "endCard" | null;

const STYLES: { id: CaptionStyle; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "bold", label: "Bold" },
  { id: "minimal", label: "Minimal" },
];
const POSITIONS: { id: CaptionPosition; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];

/** The "Look" panel: caption style, position, color and the AI overlays. */
export function LookPanel({ value, onChange, brandColors }: { value: OverlayOptions; onChange: (next: OverlayOptions, peek: LookPeek) => void; brandColors: string[] }) {
  const c = value.captions;
  const swatches = [...new Set([BRAND.captionColor, "#FFFFFF", "#F2C94C", ...brandColors.filter((x) => !/^#(0b1f3a|f7f5f0)$/i.test(x))].map((x) => x.toUpperCase()))].slice(0, 5);
  const setCaptions = (patch: Partial<OverlayOptions["captions"]>) => onChange({ ...value, captions: { ...c, ...patch } }, "captions");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 eyebrow">Look</div>
      <div className="space-y-3">
        <Row label="Captions" checked={c.enabled} onChange={(v) => setCaptions({ enabled: v })} />
        <div className={cn("space-y-2.5 transition-opacity", !c.enabled && "pointer-events-none opacity-40")}>
          <ToggleGroup type="single" value={c.style} onValueChange={(v) => v && setCaptions({ style: v as CaptionStyle })} className="w-full" aria-label="Caption style">
            {STYLES.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} className="flex-1">{s.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup type="single" value={c.position} onValueChange={(v) => v && setCaptions({ position: v as CaptionPosition })} className="w-full" aria-label="Caption position">
            {POSITIONS.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} className="flex-1">{s.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[12px] text-muted-foreground">Color</span>
            {swatches.map((hex) => (
              <button
                key={hex}
                onClick={() => setCaptions({ color: hex })}
                aria-label={`Caption color ${hex}`}
                className={cn("grid size-6 cursor-pointer place-items-center rounded-full border border-border shadow-soft", c.color.toUpperCase() === hex && "ring-2 ring-ring ring-offset-2 ring-offset-card")}
                style={{ background: hex }}
              >
                {c.color.toUpperCase() === hex && <Check className={cn("size-3", hex === "#FFFFFF" || hex === "#F2C94C" ? "text-[#0B1F3A]" : "text-white")} />}
              </button>
            ))}
            <label className="relative ml-auto cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:underline">
              Custom
              <input type="color" value={c.color} onChange={(e) => setCaptions({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Custom caption color" />
            </label>
          </div>
        </div>
        <div className="space-y-3 border-t border-border pt-3">
          <Row
            label="Name & credentials"
            hint={`${value.lowerThird.name}, ${value.lowerThird.credentials}`}
            checked={value.lowerThird.enabled}
            onChange={(v) => onChange({ ...value, lowerThird: { ...value.lowerThird, enabled: v } }, "lowerThird")}
          />
          <Row label="Key-phrase emphasis" hint="Numbers and key terms pop on screen" checked={value.keyPhrases} onChange={(v) => onChange({ ...value, keyPhrases: v }, "captions")} />
          <Row label="End card" hint={value.endCard.cta} checked={value.endCard.enabled} onChange={(v) => onChange({ ...value, endCard: { ...value.endCard, enabled: v } }, "endCard")} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const clean = (w: string) => w.replace(/^[“"'(]+|[,.;:!?”"')]+$/g, "").toLowerCase();

const CAPTION_BOX: Record<CaptionStyle, string> = {
  classic: "rounded-md bg-black/60 px-2 py-1 text-[15px] font-semibold leading-snug text-white",
  bold: "rounded-md bg-black/35 px-2 py-1 text-[17px] leading-snug font-extrabold tracking-tight text-white uppercase [text-shadow:0_2px_8px_rgba(0,0,0,.5)]",
  minimal: "text-[14px] font-medium leading-snug text-white [text-shadow:0_1px_6px_rgba(0,0,0,.8)]",
};

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
  caption: { w: string; on: boolean }[] | "";
  keyPhrases: string[];
  vertical: boolean;
  showLowerThird: boolean;
  showEndCard: boolean;
}) {
  const c = look.captions;
  const keys = React.useMemo(() => new Set(keyPhrases.flatMap((p) => p.split(/\s+/)).map(clean)), [keyPhrases]);
  const pos = c.position === "top" ? "top-[13%]" : c.position === "middle" ? (vertical ? "top-[56%]" : "top-1/2 -translate-y-1/2") : "bottom-[12%]";

  return (
    <>
      {c.enabled && caption && !showEndCard && (
        <div className={cn("absolute inset-x-[8%] text-center", pos)}>
          <span className={CAPTION_BOX[c.style]}>
            {caption.map((x, i) => {
              const key = look.keyPhrases && keys.has(clean(x.w));
              return (
                <React.Fragment key={i}>
                  <span
                    className={cn(key && "rounded px-1 text-[#0B1F3A]", c.style === "minimal" && !x.on && "opacity-80")}
                    style={key ? { background: c.color } : x.on && c.style !== "minimal" ? { color: c.color } : undefined}
                  >
                    {x.w}
                  </span>{" "}
                </React.Fragment>
              );
            })}
          </span>
        </div>
      )}
      {look.lowerThird.enabled && showLowerThird && !showEndCard && (
        <div className={cn("absolute left-3 flex max-w-[85%] overflow-hidden rounded-md shadow-lg", c.enabled && c.position === "bottom" ? "bottom-[26%]" : "bottom-[7%]")}>
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
