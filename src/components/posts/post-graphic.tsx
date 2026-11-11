"use client";

import * as React from "react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { canvasBlob, drawGraphic, loadImage, type GraphicPlace, type GraphicTheme } from "@/lib/posts/graphic";
import type { PostAspect, PostImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The headline graphic for a post, with a live preview: over a picture
 * (`base`), or as a card with no picture. "Use" saves it as the post's image.
 */
export function GraphicMaker({ base, aspect, headline, onHeadline, onAdd }: { base?: PostImage; aspect: PostAspect; headline: string; onHeadline: (h: string) => void; onAdd: (img: PostImage) => void }) {
  const { profile } = useStore();
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = React.useState<GraphicTheme>("navy");
  const [place, setPlace] = React.useState<GraphicPlace>("bottom");
  const [showName, setShowName] = React.useState(true);
  const [photo, setPhoto] = React.useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = React.useState(false);
  const hasBrand = /^#[0-9a-f]{6}$/i.test(profile.brandColors?.[0] ?? "");

  React.useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (base) loadImage(base.url).then((img) => alive && setPhoto(img)).catch((e) => alive && toast.error((e as Error).message));
    return () => {
      alive = false;
    };
  }, [base]);

  const input = React.useMemo(
    () => ({
      headline,
      name: showName ? profile.name : "",
      sub: showName ? [profile.credentials, profile.firm].filter(Boolean).join(" · ") : "",
      photo: base ? photo : null,
      aspect,
      theme,
      place,
      brand: profile.brandColors,
    }),
    [headline, showName, profile.name, profile.credentials, profile.firm, profile.brandColors, base, photo, aspect, theme, place]
  );
  const waiting = !!base && !photo;
  React.useEffect(() => {
    if (!canvas.current || waiting) return;
    void drawGraphic(canvas.current, input).catch(() => {});
  }, [input, waiting]);

  const save = async () => {
    if (!canvas.current) return;
    setSaving(true);
    try {
      await drawGraphic(canvas.current, input);
      const up = await uploadImage(await canvasBlob(canvas.current), "thumbnail", "post-graphic");
      onAdd({ id: up.id, url: up.url, source: "graphic", aspect: base ? base.aspect : aspect, baseId: base?.id, headline: headline.trim() });
      toast.success(base ? "Graphics added" : "Graphic added", { description: "It’s selected for this post." });
    } catch (e) {
      toast.error("Couldn’t save the graphic", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div className="relative self-start overflow-hidden rounded-xl border border-border bg-muted">
        <canvas ref={canvas} className={cn("block h-auto w-full", waiting && "opacity-0")} aria-label="Preview of the graphic" />
        {waiting && <div className="absolute inset-0 flex items-center justify-center"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>}
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] font-medium" htmlFor="graphic-headline">Headline on the graphic</label>
          <Input id="graphic-headline" value={headline} onChange={(e) => onHeadline(e.target.value.slice(0, 140))} placeholder="e.g. A Roth conversion isn’t all or nothing" />
          <p className="mt-1 text-[12px] text-muted-foreground">Short reads best: six to ten words.</p>
        </div>
        {base ? (
          <div>
            <div className="mb-1 text-[12px] font-medium">Where the words sit</div>
            <ToggleGroup type="single" value={place} onValueChange={(v) => v && setPlace(v as GraphicPlace)}>
              <ToggleGroupItem value="bottom" className="text-[12px]">Bottom</ToggleGroupItem>
              <ToggleGroupItem value="top" className="text-[12px]">Top</ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : (
          <div>
            <div className="mb-1 text-[12px] font-medium">Colours</div>
            <ToggleGroup type="single" value={theme} onValueChange={(v) => v && setTheme(v as GraphicTheme)}>
              <ToggleGroupItem value="navy" className="text-[12px]">Navy</ToggleGroupItem>
              <ToggleGroupItem value="light" className="text-[12px]">Light</ToggleGroupItem>
              {hasBrand && <ToggleGroupItem value="brand" className="text-[12px]">Your brand</ToggleGroupItem>}
            </ToggleGroup>
          </div>
        )}
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
          <span>Show your name and firm</span>
          <Switch checked={showName} onCheckedChange={setShowName} />
        </label>
        <Button className="rounded-full" onClick={save} disabled={saving || waiting || !headline.trim()}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />} {base ? "Use this picture with graphics" : "Use this graphic"}
        </Button>
      </div>
    </div>
  );
}
