"use client";

import * as React from "react";
import { Check, LoaderCircle, RefreshCw, Sparkles, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { canvasBlob, loadImage } from "@/lib/posts/graphic";
import { INFO_PALETTES, brandPalette, drawInfographic, type InfoPalette, type PhotoPlace } from "@/lib/posts/infographic";
import { HYPOTHETICAL_NOTE, type Infographic } from "@/lib/posts/infographic-spec";
import type { PostAspect, PostDraft, PostImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Infographics for a post: Claude reads the post and plans three (a big
 * number, a chart, a comparison…), the advisor picks one, a palette and edits
 * the words and figures, with a live preview. "Use" saves it as the picture.
 */

const LAYOUT_LABEL: Record<Infographic["layout"], string> = { stat: "Big number", bars: "Bar chart", donut: "Donut chart", compare: "Side by side", line: "Growth line", steps: "Steps" };

/** A number from how it's shown: "$420K" → 420000, "24%" → 24, "Age 65" → 65. */
export function numberFrom(display: string): number | null {
  const m = /(-?\d[\d,]*(?:\.\d+)?)\s*([kmb])?/i.exec(display.replace(/\s+/g, ""));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Number.isFinite(n) ? n * mult : null;
}

function Preview({ spec, palette, aspect, name, sub, photo, photoPlace, className }: { spec: Infographic; palette: InfoPalette; aspect: PostAspect; name: string; sub: string; photo: HTMLImageElement | null; photoPlace: PhotoPlace; className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    if (ref.current) void drawInfographic(ref.current, { spec, palette, aspect, name, sub, photo, photoPlace }).catch(() => {});
  }, [spec, palette, aspect, name, sub, photo, photoPlace]);
  return <canvas ref={ref} className={cn("block h-auto w-full", className)} aria-label="Preview of the infographic" />;
}

export function InfographicMaker({ post, aspect, onAdd, onPlans }: { post: PostDraft; aspect: PostAspect; onAdd: (img: PostImage) => void; onPlans: (plans: Infographic[]) => void }) {
  const { profile } = useStore();
  const brand = brandPalette(profile.brandColors);
  const palettes = brand ? [brand, ...INFO_PALETTES] : INFO_PALETTES;
  const [plans, setPlans] = React.useState<Infographic[]>(post.infographics ?? []);
  const [pick, setPick] = React.useState(0);
  const [spec, setSpec] = React.useState<Infographic | null>(post.infographics?.[0] ?? null);
  const [palette, setPalette] = React.useState<InfoPalette>(palettes[brand ? 1 : 0]);
  const [showName, setShowName] = React.useState(true);
  const [busy, setBusy] = React.useState<"" | "plan" | "save">("");
  // The post's own pictures (AI images and uploads) can go on the infographic.
  const photos = (post.images ?? (post.image ? [post.image] : [])).filter((g) => g.source !== "graphic");
  const [photoId, setPhotoId] = React.useState<string>(() => (post.image?.infographic && post.image.baseId ? post.image.baseId : (photos.find((g) => g.source === "ai") ?? photos[0])?.id ?? ""));
  const [photoPlace, setPhotoPlace] = React.useState<PhotoPlace>("hero");
  const [photo, setPhoto] = React.useState<HTMLImageElement | null>(null);
  const photoUrl = photos.find((g) => g.id === photoId)?.url;
  React.useEffect(() => {
    let alive = true;
    setPhoto(null);
    if (photoUrl) loadImage(photoUrl).then((img) => alive && setPhoto(img)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [photoUrl]);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const text = post.copy[0]?.text ?? "";
  const name = showName ? profile.name : "";
  const sub = showName ? [profile.credentials, profile.firm].filter(Boolean).join(" · ") : "";

  const plan = async () => {
    setBusy("plan");
    try {
      const r = await fetch("/api/posts/infographic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, topic: post.topic }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Couldn’t make the infographics.");
      setPlans(j.options);
      setPick(0);
      setSpec(j.options[0]);
      onPlans(j.options);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const choose = (n: number) => {
    setPick(n);
    setSpec(plans[n]);
  };
  const edit = (patch: Partial<Infographic>) => setSpec((s) => (s ? { ...s, ...patch } : s));

  const save = async () => {
    if (!spec || !canvas.current) return;
    setBusy("save");
    try {
      await drawInfographic(canvas.current, { spec, palette, aspect, name, sub, photo, photoPlace });
      const up = await uploadImage(await canvasBlob(canvas.current), "thumbnail", "post-infographic");
      onAdd({ id: up.id, url: up.url, source: "graphic", aspect, headline: spec.headline, infographic: true, baseId: photo && photoId ? photoId : undefined });
      toast.success("Infographic added", { description: "It’s selected for this post." });
    } catch (e) {
      toast.error("Couldn’t save the infographic", { description: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  React.useEffect(() => {
    if (spec && canvas.current) void drawInfographic(canvas.current, { spec, palette, aspect, name, sub, photo, photoPlace }).catch(() => {});
  }, [spec, palette, aspect, name, sub, photo, photoPlace]);

  if (!plans.length || !spec)
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <div className="mx-auto flex w-fit gap-1.5">{INFO_PALETTES.slice(0, 4).map((p) => <span key={p.id} className="size-5 rounded-full" style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})` }} />)}</div>
        <div className="mt-3 text-[15px] font-semibold">Turn this post into an infographic</div>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">Big numbers, charts, comparisons and steps in bold colour, made from what your post says. You get three to choose from.</p>
        <Button className="mt-4 rounded-full" onClick={plan} disabled={busy === "plan" || text.trim().length < 20}>{busy === "plan" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {busy === "plan" ? "Designing…" : "Make infographics"}</Button>
        {text.trim().length < 20 && <p className="mt-2 text-[12px] text-muted-foreground">Write the post first: the figures come from it.</p>}
      </div>
    );

  const rows = spec.layout === "bars" || spec.layout === "donut" || spec.layout === "line";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {plans.map((p, n) => (
          <button key={n} type="button" onClick={() => choose(n)} aria-pressed={pick === n} className={cn("cursor-pointer overflow-hidden rounded-xl border-2 text-left transition", pick === n ? "border-primary" : "border-transparent opacity-80 hover:opacity-100")}>
            <Preview spec={n === pick ? spec : p} palette={palette} aspect={aspect} name={name} sub={sub} photo={photo} photoPlace={photoPlace} />
            <span className="block bg-card px-2 py-1 text-[11px] font-medium">{LAYOUT_LABEL[p.layout]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="self-start overflow-hidden rounded-xl border border-border bg-muted">
          <canvas ref={canvas} className="block h-auto w-full" aria-label="Preview of the infographic" />
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-[12px] font-medium">Colours</div>
            <div className="flex flex-wrap gap-2">
              {palettes.map((p) => (
                <button key={p.id} type="button" onClick={() => setPalette(p)} aria-pressed={palette.id === p.id} title={p.label} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-[12px] transition", palette.id === p.id ? "border-primary" : "border-border hover:border-primary/50")}>
                  <span className="size-5 rounded-full" style={{ background: `linear-gradient(135deg, ${p.bg[0]}, ${p.bg[1]})`, boxShadow: `inset 0 0 0 3px ${p.colors[0]}` }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-medium">Your photo</div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setPhotoId("")} aria-pressed={!photoId} className={cn("flex size-14 cursor-pointer items-center justify-center rounded-lg border-2 bg-muted text-[11px] text-muted-foreground", !photoId ? "border-primary" : "border-transparent hover:border-primary/40")}>None</button>
              {photos.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element -- the advisor's own pictures
                <button key={g.id} type="button" onClick={() => setPhotoId(g.id)} aria-pressed={photoId === g.id} className={cn("relative size-14 cursor-pointer overflow-hidden rounded-lg border-2", photoId === g.id ? "border-primary" : "border-transparent opacity-75 hover:opacity-100")}><img src={g.url} alt={g.source === "ai" ? "AI image" : "Your picture"} className="absolute inset-0 h-full w-full object-cover" /></button>
              ))}
              {photoId && (
                <div className="inline-flex rounded-full border border-border p-0.5" role="radiogroup" aria-label="Where the photo goes">
                  {(
                    [
                      ["hero", "Across the top"],
                      ["circle", "In a circle"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={photoPlace === v} onClick={() => setPhotoPlace(v)} className={cn("cursor-pointer rounded-full px-3 py-1 text-[12px] transition", photoPlace === v ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            {!photos.length && <p className="mt-1 text-[12px] text-muted-foreground">Make an AI image first (the “AI image” option above) and it can go on your infographic.</p>}
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium" htmlFor="ig-headline">Headline</label>
            <Input id="ig-headline" value={spec.headline} maxLength={90} onChange={(e) => edit({ headline: e.target.value })} />
          </div>
          {spec.layout === "stat" && spec.stat && (
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <div><label className="mb-1 block text-[12px] font-medium">Figure</label><Input value={spec.stat.value} maxLength={10} onChange={(e) => edit({ stat: { ...spec.stat!, value: e.target.value } })} /></div>
              <div><label className="mb-1 block text-[12px] font-medium">What it is</label><Input value={spec.stat.label} maxLength={90} onChange={(e) => edit({ stat: { ...spec.stat!, label: e.target.value } })} /></div>
            </div>
          )}
          {rows && (
            <div>
              <div className="mb-1 text-[12px] font-medium">{spec.layout === "line" ? "Points, in order" : "Figures"}</div>
              <div className="space-y-1.5">
                {spec.series.map((r, n) => (
                  <div key={n} className="flex gap-1.5">
                    <Input value={r.label} maxLength={28} aria-label="Label" onChange={(e) => edit({ series: spec.series.map((x, k) => (k === n ? { ...x, label: e.target.value } : x)) })} />
                    <Input value={r.display} maxLength={14} aria-label="Figure" className="w-28 shrink-0" onChange={(e) => { const v = numberFrom(e.target.value); edit({ series: spec.series.map((x, k) => (k === n ? { ...x, display: e.target.value, value: v ?? x.value } : x)) }); }} />
                    <Button size="icon" variant="ghost" aria-label="Remove" disabled={spec.series.length <= (spec.layout === "line" ? 3 : 2)} onClick={() => edit({ series: spec.series.filter((_, k) => k !== n) })}><Trash2 /></Button>
                  </div>
                ))}
                {spec.series.length < (spec.layout === "donut" ? 4 : spec.layout === "line" ? 10 : 6) && (
                  <button type="button" onClick={() => edit({ series: [...spec.series, { label: "New", display: "0", value: 0 }] })} className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-primary"><Plus className="size-3.5" /> Add a row</button>
                )}
              </div>
              {spec.layout === "donut" && <p className="mt-1 text-[11px] text-muted-foreground">Parts of a whole: they should add up to 100%.</p>}
            </div>
          )}
          {spec.layout === "steps" && (
            <div>
              <div className="mb-1 text-[12px] font-medium">Steps</div>
              <div className="space-y-1.5">{spec.steps.map((st, n) => <Input key={n} value={st} maxLength={60} aria-label={`Step ${n + 1}`} onChange={(e) => edit({ steps: spec.steps.map((x, k) => (k === n ? e.target.value : x)) })} />)}</div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[12px] font-medium" htmlFor="ig-take">The takeaway</label>
            <Input id="ig-take" value={spec.takeaway} maxLength={110} onChange={(e) => edit({ takeaway: e.target.value })} />
          </div>
          {spec.hypothetical && <p className="rounded-lg bg-muted/60 p-2 text-[12px] text-muted-foreground">These figures are an example, so the graphic says so: “{HYPOTHETICAL_NOTE}”</p>}
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
            <span>Show your name and firm</span>
            <Switch checked={showName} onCheckedChange={setShowName} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" onClick={save} disabled={!!busy || !spec.headline.trim()}>{busy === "save" ? <LoaderCircle className="animate-spin" /> : <Check />} Use this infographic</Button>
            <Button variant="outline" className="rounded-full" onClick={plan} disabled={!!busy}>{busy === "plan" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Three more ideas</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
