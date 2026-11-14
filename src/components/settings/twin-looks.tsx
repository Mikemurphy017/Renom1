"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own looks */
import * as React from "react";
import { CircleAlert, LoaderCircle, Pencil, Plus, Star, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TwinView } from "./ai-twin";
import { LookStudio } from "./look-studio";

/**
 * More looks of the advisor: the same person in the gallery's ready-made
 * outfits and settings (templates and look packs). Each one can be picked for
 * any AI video, so videos don't all look the same.
 */

export function TwinLooks({ twin, onTwin }: { twin: TwinView; onTwin: (t: TwinView) => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState("");
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

  const generate = async (o: { templateId: string; from: string; aspect: "9:16" | "16:9"; name: string; count: number }) => {
    if (await post("template", { action: "template-looks", templateId: o.templateId, from: o.from, aspect: o.aspect }, o.count > 1 ? `Making ${o.count} “${o.name}” looks` : `Making your “${o.name}” look`)) setOpen(false);
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
        <button type="button" onClick={() => setOpen(true)} className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground transition hover:border-primary/50">
          <Plus className="size-5" /> New look
          <span className="px-2 text-center text-[10px]">From templates</span>
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

      <LookStudio open={open} onOpenChange={setOpen} twin={twin} busy={busy === "template"} onGenerate={(o) => void generate(o)} />
    </div>
  );
}
