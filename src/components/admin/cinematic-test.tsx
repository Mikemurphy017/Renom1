"use client";

import * as React from "react";
import { FlaskConical, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resolveSetting, videoPrompt } from "@/lib/cinematic/core";
import { cn, relativeTime } from "@/lib/utils";

/**
 * Admin test runs: one still and one prompt through any video model, with the
 * studio's key. For side-by-side comparisons before changing what advisors get.
 */

interface ModelInfo {
  id: string;
  label: string;
  minSeconds: number;
  maxSeconds: number;
}
interface Run {
  id: string;
  createdAt: string;
  model: string;
  prompt: string;
  seconds: number;
  resolution: string;
  aspect: string;
  usd: number | null;
  status: "working" | "ready" | "failed";
  error?: string;
  videoUrl?: string;
  durationSec?: number;
  width?: number;
  height?: number;
}

const SAMPLE = videoPrompt({ setting: resolveSetting("corner-office")!, voice: "confident, warm American male voice", script: "Write the script here." });

export function CinematicTest() {
  const [models, setModels] = React.useState<ModelInfo[]>([]);
  const [runs, setRuns] = React.useState<Run[]>([]);
  const [on, setOn] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState("");
  const [prompt, setPrompt] = React.useState(SAMPLE);
  const [model, setModel] = React.useState("");
  const [seconds, setSeconds] = React.useState(15);
  const [resolution, setResolution] = React.useState("1080p");
  const [aspect, setAspect] = React.useState("9:16");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const j = await fetch("/api/admin/cinematic/test", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (!j?.ok) return;
    setModels(j.models);
    setRuns(j.runs);
    setOn(j.on);
    setModel((m) => m || j.models[0]?.id || "");
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  const working = runs.some((r) => r.status === "working");
  React.useEffect(() => {
    if (!working) return;
    const t = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(t);
  }, [working, load]);
  React.useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const m = models.find((x) => x.id === model);
  const start = async () => {
    if (!file) return toast.error("Add the still first.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("prompt", prompt);
      form.append("model", model);
      form.append("seconds", String(seconds));
      form.append("resolution", resolution);
      form.append("aspect", aspect);
      const r = await fetch("/api/admin/cinematic/test", { method: "POST", body: form });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Couldn’t start the test.");
      setRuns((rs) => [j.run, ...rs]);
      toast.success("Test started", { description: j.run.usd != null ? `Estimated $${j.run.usd.toFixed(2)}. Usually five to ten minutes.` : "Usually five to ten minutes." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <FlaskConical className="size-4 text-primary" /> Test run
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">Run any still and prompt through a video model with the studio’s key, to compare models before changing what advisors get. Charged to the studio’s Higgsfield API balance. Only admins see this.</p>
      {!on ? (
        <p className="mt-4 text-[13px] text-muted-foreground">Switch cinematic videos on above to use it.</p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className={cn("relative flex cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-border text-center text-[12px] text-muted-foreground hover:border-primary/50", aspect === "9:16" ? "aspect-[9/16]" : "aspect-video")}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="The still" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <>
                <Upload className="size-5" /> The still (first frame)
              </>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Still image" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="space-y-3">
            <Textarea rows={7} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-[13px]" aria-label="Prompt" />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-56" aria-label="Model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup type="single" value={resolution} onValueChange={(v) => v && setResolution(v)}>
                <ToggleGroupItem value="720p" className="text-[12px]">720p</ToggleGroupItem>
                <ToggleGroupItem value="1080p" className="text-[12px]">1080p</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup type="single" value={aspect} onValueChange={(v) => v && setAspect(v)}>
                <ToggleGroupItem value="9:16" className="text-[12px]">9:16</ToggleGroupItem>
                <ToggleGroupItem value="16:9" className="text-[12px]">16:9</ToggleGroupItem>
              </ToggleGroup>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                Seconds
                <input type="number" min={m?.minSeconds ?? 4} max={m?.maxSeconds ?? 30} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="h-8 w-16 rounded-md border border-border bg-background px-2 text-[13px] text-foreground" />
              </label>
              <Button className="ml-auto rounded-full" onClick={start} disabled={busy || !file || !model}>
                {busy ? <LoaderCircle className="animate-spin" /> : <FlaskConical />} Run test
              </Button>
            </div>
          </div>
        </div>
      )}
      {runs.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          {runs.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start gap-4">
              <div className={cn("relative shrink-0 overflow-hidden rounded-lg bg-muted", r.aspect === "9:16" ? "aspect-[9/16] w-32" : "aspect-video w-56")}>
                {r.status === "ready" && r.videoUrl ? (
                  <video src={r.videoUrl} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[12px] text-muted-foreground">{r.status === "working" ? <LoaderCircle className="size-5 animate-spin" /> : "Failed"}</div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-[12px] text-muted-foreground">
                <div className="text-[13px] font-medium text-foreground">
                  {models.find((x) => x.id === r.model)?.label ?? r.model} · {r.resolution} · {r.seconds}s
                </div>
                <div>
                  {r.status === "working" ? "Filming…" : r.status === "ready" ? `Ready · ${r.width}×${r.height} · ${r.durationSec}s` : r.error} · {relativeTime(r.createdAt)}
                  {r.usd != null ? ` · est. $${r.usd.toFixed(2)}` : ""}
                </div>
                <p className="mt-1 line-clamp-2">{r.prompt}</p>
                {r.status === "ready" && r.videoUrl && (
                  <a href={`${r.videoUrl}?download=cinematic-test`} className="mt-1 inline-block text-primary underline-offset-2 hover:underline">
                    Download MP4
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
