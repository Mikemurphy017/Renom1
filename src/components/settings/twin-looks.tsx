"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own looks */
import * as React from "react";
import { CircleAlert, LoaderCircle, Pencil, Plus, Sparkles, Star, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { TwinView } from "./ai-twin";

/**
 * More looks of the advisor: the same person in other outfits and settings,
 * made from a description (or a curated set of five). Each one can be picked
 * for any AI video, so videos don't all look the same.
 */

const IDEAS = [
  "Navy suit and white shirt, modern office with a city view, soft daylight",
  "Beige blazer, bright home office with bookshelves and a plant",
  "Dark sweater, podcast studio with a microphone and warm lamps",
  "Grey blazer, glass meeting room, clean and bright",
  "Open-collar shirt, cozy living room, warm evening light",
  "Quarter-zip pullover, coffee shop by a window, morning light",
];
const PACKS = [
  ["corporate", "Modern corporate"],
  ["casual", "Business casual"],
  ["keynote", "Keynote presenter"],
  ["minimal", "Clean and minimal"],
] as const;

type Aspect = "9:16" | "16:9";

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; label: string }) {
  return (
    <div className="inline-flex rounded-full border border-border p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("cursor-pointer rounded-full px-3 py-1 text-[12px] transition", value === v ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function TwinLooks({ twin, onTwin }: { twin: TwinView; onTwin: (t: TwinView) => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [name, setName] = React.useState("");
  const [aspect, setAspect] = React.useState<Aspect>("9:16");
  const [styling, setStyling] = React.useState<"men" | "women">("men");
  const [from, setFrom] = React.useState("");
  const base = from || twin.defaultLook || twin.looks[0]?.id || "";
  const left = twin.limits.looksLeft;

  const post = async (what: string, body: object, done?: string) => {
    setBusy(what);
    try {
      const r = await fetch("/api/twin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "That didn’t work. Try again.");
      onTwin(j.twin);
      if (done) toast.success(done);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    if (await post("look", { action: "look", prompt, name: name || undefined, from: base, aspect }, "Making your new look")) {
      setPrompt("");
      setName("");
      setOpen(false);
    }
  };
  const pack = async (id: string, label: string) => {
    if (await post(`pack-${id}`, { action: "look-pack", pack: id, styling, from: base, aspect }, `Making five “${label}” looks`)) setOpen(false);
  };
  const rename = (id: string, current: string) => {
    const n = window.prompt("Name this look", current)?.trim();
    if (n && n !== current) void post(`rename-${id}`, { action: "rename-look", lookId: id, name: n });
  };
  const remove = (id: string) => {
    if (window.confirm("Delete this look? Videos already made with it stay.")) void post(`remove-${id}`, { action: "remove-look", lookId: id }, "Look deleted");
  };

  return (
    <div id="ai-twin-looks" className="scroll-mt-24 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold">Your looks</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">You, in other outfits and settings. Pick any look when you make an AI video. The star marks the one used by default.</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tnum">{left} new {left === 1 ? "look" : "looks"} left this month</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn("flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[12px] transition", open ? "border-primary bg-brass-soft/40 text-foreground" : "border-border text-muted-foreground hover:border-primary/50")}>
          {open ? <X className="size-5" /> : <Plus className="size-5" />} {open ? "Close" : "New look"}
        </button>

        {twin.scenesPending.map((s) => (
          <div key={s.id} className="relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-muted p-2 text-center">
            {s.status === "working" ? <LoaderCircle className="size-5 animate-spin text-muted-foreground" /> : <CircleAlert className="size-5 text-destructive" />}
            <span className="line-clamp-2 text-[11px] font-medium">{s.name}</span>
            <span className={cn("line-clamp-3 text-[10px]", s.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{s.status === "working" ? "Making it, about a minute" : s.error}</span>
            {s.status === "failed" && <button type="button" onClick={() => remove(s.id)} className="cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive">Remove</button>}
          </div>
        ))}

        {twin.looks.map((l) => {
          const isDefault = l.id === twin.defaultLook;
          return (
            <div key={l.id} className={cn("group relative aspect-[3/4] overflow-hidden rounded-xl border-2 bg-muted", isDefault ? "border-primary" : "border-transparent")}>
              {l.mediaId ? <img src={`/api/media/${l.mediaId}`} alt={l.label} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><UserRound className="size-6" /></div>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pt-6 pb-1.5 text-[11px] leading-tight font-medium text-white">
                <span className="line-clamp-2">{l.label}</span>
                {l.aspect === "16:9" && <span className="text-[10px] font-normal text-white/70">Wide</span>}
              </div>
              <button type="button" onClick={() => !isDefault && void post(`default-${l.id}`, { action: "default", lookId: l.id }, "Default look set")} aria-label={isDefault ? "Default look" : "Use by default"} title={isDefault ? "Default look" : "Use by default"} className={cn("absolute top-1 left-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur", isDefault && "bg-primary text-primary-foreground")}>
                <Star className={cn("size-3.5", isDefault && "fill-current")} />
              </button>
              <div className="absolute top-1 right-1 flex gap-1">
                {l.kind === "scene" && (
                  <>
                    <button type="button" onClick={() => rename(l.id, l.label)} aria-label="Rename" title="Rename" className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Pencil className="size-3" /></button>
                    <button type="button" onClick={() => remove(l.id)} aria-label="Delete" title="Delete" className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"><Trash2 className="size-3" /></button>
                  </>
                )}
              </div>
              {busy.endsWith(l.id) && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><LoaderCircle className="size-5 animate-spin text-white" /></div>}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="mt-4 space-y-4 rounded-xl border border-border p-4">
          {twin.looks.length > 1 && (
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Start from</div>
              <div className="flex flex-wrap gap-1.5">
                {twin.looks.map((l) => (
                  <button key={l.id} type="button" onClick={() => setFrom(l.id)} aria-pressed={base === l.id} title={l.label} className={cn("relative size-12 cursor-pointer overflow-hidden rounded-lg border-2 bg-muted", base === l.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                    {l.mediaId ? <img src={`/api/media/${l.mediaId}`} alt={l.label} className="absolute inset-0 h-full w-full object-cover" /> : <UserRound className="m-auto size-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Outfit and setting</div>
            <Textarea rows={3} maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Navy suit and white shirt, modern office with a city view, soft daylight" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEAS.map((i) => (
                <button key={i} type="button" onClick={() => setPrompt(i)} className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground">{i.split(",").slice(0, 2).join(",")}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Name (optional)</div>
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. City office" />
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Shape</div>
              <Segmented label="Shape" value={aspect} onChange={setAspect} options={[["9:16", "Vertical"], ["16:9", "Wide"]] as const} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">Same face and voice. Usually ready in about a minute.</span>
            <Button className="rounded-full" onClick={create} disabled={!!busy || prompt.trim().length < 8 || left < 1}>{busy === "look" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Create look</Button>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium">Or get a set of five</div>
                <p className="text-[12px] text-muted-foreground">Five coordinated outfits and settings in one go. Uses 5 of this month’s looks.</p>
              </div>
              <Segmented label="Styling" value={styling} onChange={setStyling} options={[["men", "Men’s"], ["women", "Women’s"]] as const} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PACKS.map(([id, label]) => (
                <Button key={id} variant="outline" className="justify-start" onClick={() => void pack(id, label)} disabled={!!busy || left < 5}>
                  {busy === `pack-${id}` ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
