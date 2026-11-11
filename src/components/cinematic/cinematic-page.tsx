"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own photos and stills */
import * as React from "react";
import Link from "next/link";
import { Check, Clapperboard, Download, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStore } from "@/lib/store";
import { uploadImage } from "@/lib/media/upload";
import { CUSTOM_SETTING_ID, DEFAULT_WARDROBE, SETTINGS, STATUS_LABEL, VOICES, WORDS_PER_SECOND, countWords, estimateSeconds, isWorking, type CinematicAspect, type CinematicStatus } from "@/lib/cinematic/core";
import { cn, fmtDuration, relativeTime } from "@/lib/utils";

/**
 * Cinematic videos: the advisor's photo, a script and a setting become a
 * photorealistic video of them speaking it. They approve the still (their
 * face, the setting) before the video is filmed. Advisors reach this from the
 * Record step only (src/components/studio/cinematic-option.tsx); the API key
 * and usage are under Admin → Cinematic.
 */

export interface Job {
  id: string;
  createdAt: string;
  status: CinematicStatus;
  error?: string;
  failedAt?: "scene" | "filming";
  script: string;
  settingName: string;
  aspect: CinematicAspect;
  aiLabel: boolean;
  stillUrl?: string;
  videoUrl?: string;
  uploadId?: string;
  width?: number;
  height?: number;
  videoId?: string;
  durationSec?: number;
  elapsedSec?: number;
}
export interface Config {
  available: boolean;
  /** This account may switch the feature on (the studio's admin). */
  canConfigure?: boolean;
  pro: boolean;
  limits: { maxSeconds: number; maxWords: number; perMonth: number };
  consentText: string;
}

const mediaIdOf = (url?: string) => /\/api\/media\/(img[a-f0-9]{18})/.exec(url ?? "")?.[1];
const STEPS: CinematicStatus[] = ["uploading", "scene", "approval", "filming", "ready"];

/** The advisor's cinematic videos and the limits the form works to; follows anything in progress. */
export function useCinematic() {
  const [config, setConfig] = React.useState<Config | null>(null);
  const [jobs, setJobs] = React.useState<Job[]>([]);

  const load = React.useCallback(async () => {
    const r = await fetch("/api/cinematic", { cache: "no-store" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as ({ ok?: boolean; jobs?: Job[] } & Config) | null;
    if (j?.ok) {
      setConfig({ available: j.available, canConfigure: j.canConfigure, pro: j.pro, limits: j.limits, consentText: j.consentText });
      setJobs(j.jobs ?? []);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  // Follow anything in progress. Looking at a job is also what moves it along.
  const working = jobs.filter((j) => isWorking(j.status)).map((j) => j.id).join(",");
  React.useEffect(() => {
    if (!working) return;
    const t = window.setInterval(async () => {
      for (const id of working.split(",")) {
        const r = await fetch(`/api/cinematic/${id}`, { cache: "no-store" }).catch(() => null);
        const j = (await r?.json().catch(() => null)) as { ok?: boolean; job?: Job } | null;
        if (j?.ok && j.job) {
          const next = j.job;
          setJobs((js) => {
            const prev = js.find((x) => x.id === id);
            if (prev && prev.status !== next.status) {
              if (next.status === "approval") toast.success("Your scene is ready", { description: "Take a look and approve it before we film." });
              if (next.status === "ready") toast.success("Your cinematic video is ready");
              if (next.status === "failed") toast.error(next.error ?? "That one didn’t work.");
            }
            return js.map((x) => (x.id === id ? next : x));
          });
        }
      }
    }, 6000);
    return () => window.clearInterval(t);
  }, [working]);

  const patch = React.useCallback((job: Job) => setJobs((js) => (js.some((x) => x.id === job.id) ? js.map((x) => (x.id === job.id ? job : x)) : [job, ...js])), []);
  const remove = React.useCallback((id: string) => setJobs((js) => js.filter((x) => x.id !== id)), []);
  return { config, jobs, patch, remove };
}

/** Why cinematic videos can't be made right now; the studio's admin gets the way to fix it. */
export function NotSwitchedOn({ canConfigure }: { canConfigure?: boolean }) {
  return canConfigure ? (
    <div className="rounded-xl border border-primary/40 bg-brass-soft/40 p-4 text-[13px]">
      <div className="font-semibold">Cinematic videos are switched off</div>
      <p className="mt-1 text-muted-foreground">They need the studio’s API key before any Pro account can make one, including yours. It takes a minute.</p>
      <Button asChild size="sm" className="mt-3 rounded-full"><Link href="/admin/cinematic">Switch them on</Link></Button>
    </div>
  ) : (
    <p className="rounded-xl border border-border bg-card p-4 text-[13px] text-muted-foreground">Cinematic videos aren’t switched on for this studio yet. Your administrator can turn them on.</p>
  );
}

/** The advisor's own headshots, as the creator form takes them. */
export function useHeadshots() {
  const { profile, updateProfile } = useStore();
  const headshots = React.useMemo(() => profile.headshots.filter((h) => h.url && mediaIdOf(h.url)).map((h) => ({ id: mediaIdOf(h.url)!, url: h.url! })), [profile.headshots]);
  const add = (h: { id: string; url: string }) => updateProfile({ headshots: [...profile.headshots, { id: h.id, label: "Headshot", pose: "center" as never, url: h.url }] });
  return { headshots, add };
}

// ── New video ──

export interface NewVideoProps {
  config: Config;
  headshots: { id: string; url: string }[];
  onHeadshot: (h: { id: string; url: string }) => void;
  onCreated: (j: Job) => void;
  /** Start from this script (the Record step passes the video's own). */
  initialScript?: string;
  /** The studio video this is for. */
  videoId?: string;
  /** Rewrites a script that's too long down to the word limit. */
  onShorten?: (script: string, maxWords: number) => Promise<string>;
  /** Vertical or wide to start with. */
  initialAspect?: CinematicAspect;
}

export function NewVideo({ config, headshots, onHeadshot, onCreated, initialScript = "", videoId, onShorten, initialAspect = "9:16" }: NewVideoProps) {
  const [photo, setPhoto] = React.useState<string>("");
  const [script, setScript] = React.useState(initialScript);
  const [shortening, setShortening] = React.useState(false);
  const [setting, setSetting] = React.useState(SETTINGS[0].id);
  const [custom, setCustom] = React.useState("");
  const [wardrobe, setWardrobe] = React.useState("");
  const [voice, setVoice] = React.useState<string>(VOICES[0].id);
  const [aspect, setAspect] = React.useState<CinematicAspect>(initialAspect);
  const [aiLabel, setAiLabel] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "upload" | "create">("");
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (!photo && headshots[0]) setPhoto(headshots[0].id);
  }, [photo, headshots]);

  const words = countWords(script);
  const max = config.limits.maxWords;
  const over = words > max;
  const secs = estimateSeconds(words);

  const upload = async (f?: File | null) => {
    if (!f) return;
    setBusy("upload");
    try {
      const up = await uploadImage(f, "headshot", "headshot");
      onHeadshot({ id: up.id, url: up.url });
      setPhoto(up.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    setBusy("create");
    try {
      // The chosen photo first: it's the reference for the face.
      const ids = [photo, ...headshots.map((h) => h.id).filter((id) => id !== photo)].slice(0, 3);
      const r = await fetch("/api/cinematic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headshotIds: ids, script, settingId: setting, customSetting: custom, wardrobe, voiceId: voice, aspect, aiLabel, consent, videoId }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; job?: Job } | null;
      if (!r.ok || !j?.ok || !j.job) throw new Error(j?.error ?? "Couldn’t start the video.");
      onCreated(j.job);
      if (!videoId) setScript("");
      toast.success("Creating your scene", { description: "About a minute. You’ll approve it before we film." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const shorten = async () => {
    if (!onShorten) return;
    setShortening(true);
    try {
      setScript(await onShorten(script, max));
    } catch (e) {
      toast.error("Couldn’t shorten it", { description: (e as Error).message });
    } finally {
      setShortening(false);
    }
  };

  const ready = !!photo && words >= 5 && !over && consent && (setting !== CUSTOM_SETTING_ID || custom.trim().length >= 8);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Field n={1} title="Your photo" hint="Clear, well lit, facing the camera, nothing covering your face.">
            <div className="flex flex-wrap gap-2">
              {headshots.slice(0, 8).map((h) => (
                <button key={h.id} type="button" onClick={() => setPhoto(h.id)} aria-pressed={photo === h.id} className={cn("relative block size-20 cursor-pointer overflow-hidden rounded-xl border-2 transition", photo === h.id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                  <img src={h.url} alt="Your headshot" className="absolute inset-0 h-full w-full object-cover" />
                  {photo === h.id && <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}
                </button>
              ))}
              <button type="button" onClick={() => input.current?.click()} disabled={!!busy} className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground">
                {busy === "upload" ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} Add photo
              </button>
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </Field>

          <Field n={2} title="What you’ll say" hint={`Up to ${max} words, about ${Math.round(max / WORDS_PER_SECOND)} seconds.`}>
            <Textarea rows={4} value={script} onChange={(e) => setScript(e.target.value)} placeholder="e.g. Most people think a Roth conversion is all or nothing. It isn’t. You can convert a slice each year and fill the lower brackets on purpose." className="font-serif text-[16px]" />
            <div className="mt-1.5 flex items-center justify-between text-[12px]">
              <span className={cn("tnum", over ? "font-medium text-destructive" : "text-muted-foreground")}>{words} / {max} words{over ? ` · cut ${words - max}` : ""}</span>
              <span className="text-muted-foreground tnum">{words ? `about ${secs < 10 ? secs.toFixed(1) : Math.round(secs)} seconds spoken` : "about 2.5 words a second"}</span>
            </div>
            {over && onShorten && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-brass-soft/40 px-3 py-2 text-[12px]">
                <span className="min-w-0 flex-1">Cinematic videos run up to {Math.round(max / WORDS_PER_SECOND)} seconds, so this script is too long as written.</span>
                <Button size="sm" variant="outline" className="rounded-full" onClick={shorten} disabled={shortening}>{shortening ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Shorten it for me</Button>
              </div>
            )}
          </Field>

          <Field n={3} title="Voice and wardrobe">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger aria-label="Voice"><SelectValue /></SelectTrigger>
                <SelectContent>{VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
              <ToggleGroup type="single" value={aspect} onValueChange={(v) => v && setAspect(v as CinematicAspect)} className="w-full">
                <ToggleGroupItem value="9:16" className="flex-1">Vertical 9:16</ToggleGroupItem>
                <ToggleGroupItem value="16:9" className="flex-1">Wide 16:9</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Input className="mt-3" value={wardrobe} onChange={(e) => setWardrobe(e.target.value)} placeholder={`What you’re wearing (default: ${DEFAULT_WARDROBE})`} />
            <p className="mt-1.5 text-[12px] text-muted-foreground">The voice is an AI voice that fits the description, not a recording of yours.</p>
          </Field>
        </div>

        <div className="space-y-6">
          <Field n={4} title="Setting">
            <div className="grid grid-cols-2 gap-2">
              {SETTINGS.map((s) => (
                <button key={s.id} type="button" onClick={() => setSetting(s.id)} aria-pressed={setting === s.id} className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-left text-[13px] transition", setting === s.id ? "border-primary bg-brass-soft/50 font-medium" : "border-border hover:bg-muted/50")}>
                  {s.name}
                </button>
              ))}
              <button type="button" onClick={() => setSetting(CUSTOM_SETTING_ID)} aria-pressed={setting === CUSTOM_SETTING_ID} className={cn("cursor-pointer rounded-xl border px-3 py-2.5 text-left text-[13px] transition", setting === CUSTOM_SETTING_ID ? "border-primary bg-brass-soft/50 font-medium" : "border-dashed border-border hover:bg-muted/50")}>
                Describe your own…
              </button>
            </div>
            {setting === CUSTOM_SETTING_ID && <Input className="mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. a vineyard terrace at sunset with rolling hills behind" />}
          </Field>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <span>{config.consentText}</span>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
              <span><span className="font-medium">Add an “AI-generated” label</span><span className="block text-[12px] text-muted-foreground">A small disclosure in the corner of the video.</span></span>
              <Switch checked={aiLabel} onCheckedChange={setAiLabel} />
            </label>
            <p className="flex items-start gap-2 text-[12px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> Have your firm’s compliance team review this video before you post it, as you would any other communication.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-muted-foreground">You’ll see the scene and approve it before the video is filmed.</span>
            <Button className="rounded-full px-5" onClick={create} disabled={!ready || !!busy}>{busy === "create" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Create my scene</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="flex size-6 items-center justify-center self-center rounded-full bg-navy text-[12px] font-semibold text-navy-foreground dark:bg-primary dark:text-primary-foreground">{n}</span>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── One video ──

export function JobCard({ job, onChange, onRemove, onUse, using }: { job: Job; onChange: (j: Job) => void; onRemove: () => void; onUse?: (j: Job) => void; using?: boolean }) {
  const [busy, setBusy] = React.useState("");
  const act = async (action: "approve" | "regenerate" | "retry") => {
    setBusy(action);
    try {
      const r = await fetch(`/api/cinematic/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; job?: Job } | null;
      if (!r.ok || !j?.ok || !j.job) throw new Error(j?.error ?? "That didn’t work. Try again.");
      onChange(j.job);
      if (action === "approve") toast.success("Filming", { description: "Usually five to ten minutes. You can leave this page; it carries on." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const remove = async () => {
    if (!window.confirm("Remove this video from your list?")) return;
    await fetch(`/api/cinematic/${job.id}`, { method: "DELETE" }).catch(() => {});
    onRemove();
  };
  const at = STEPS.indexOf(job.status === "failed" ? (job.failedAt === "filming" ? "filming" : "scene") : job.status);
  const tall = job.aspect === "9:16";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className={cn("relative mx-auto overflow-hidden rounded-xl bg-[#06101F]", tall ? "aspect-[9/16] w-44 sm:w-48" : "aspect-video w-full sm:w-80")}>
          {job.status === "ready" && job.videoUrl ? (
            <video src={job.videoUrl} poster={job.stillUrl} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
          ) : job.stillUrl ? (
            <img src={job.stillUrl} alt="Your scene" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">{job.status === "failed" ? <TriangleAlert className="size-6" /> : <LoaderCircle className="size-6 animate-spin" />}</div>
          )}
          {job.status === "filming" && <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/55 px-3 py-2 text-[12px] text-white"><LoaderCircle className="size-3.5 animate-spin" /> Filming…</div>}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <span className={cn("rounded-full px-2 py-0.5 font-medium", job.status === "ready" ? "bg-success-soft text-success" : job.status === "failed" ? "bg-destructive/10 text-destructive" : job.status === "approval" ? "bg-primary text-primary-foreground" : "bg-brass-soft text-[#7d6238] dark:text-primary")}>{STATUS_LABEL[job.status]}</span>
            {job.settingName} · {relativeTime(job.createdAt)}{job.durationSec ? ` · ${fmtDuration(job.durationSec)}` : ""}{job.aiLabel ? " · AI label" : ""}
          </div>
          <p className="mt-2 line-clamp-3 font-serif text-[16px] leading-snug">“{job.script}”</p>

          <ol className="mt-4 flex items-center gap-1.5" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col gap-1">
                <span className={cn("h-1.5 rounded-full", job.status === "failed" && i === at ? "bg-destructive" : i < at || job.status === "ready" ? "bg-primary" : i === at ? "bg-primary/50" : "bg-muted")} />
                <span className={cn("hidden text-[10px] sm:block", i === at ? "font-medium text-foreground" : "text-muted-foreground")}>{STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4">
            {job.status === "scene" || job.status === "uploading" ? (
              <p className="text-[13px] text-muted-foreground">Placing you in the setting. About a minute{job.elapsedSec ? ` (${fmtDuration(job.elapsedSec)} so far)` : ""}.</p>
            ) : job.status === "approval" ? (
              <div className="space-y-3">
                <p className="text-[13px]">Does this look like you, in the right setting? Filming starts when you approve.</p>
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-full" onClick={() => act("approve")} disabled={!!busy}>{busy === "approve" ? <LoaderCircle className="animate-spin" /> : <Clapperboard />} Approve and film</Button>
                  <Button variant="outline" className="rounded-full" onClick={() => act("regenerate")} disabled={!!busy}>{busy === "regenerate" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Try another scene</Button>
                </div>
              </div>
            ) : job.status === "filming" ? (
              <p className="text-[13px] text-muted-foreground">Filming your video. Usually five to ten minutes{job.elapsedSec ? ` (${fmtDuration(job.elapsedSec)} so far)` : ""}. You can leave this page; it carries on.</p>
            ) : job.status === "ready" ? (
              <div className="flex flex-wrap items-center gap-2">
                {onUse && <Button className="rounded-full" onClick={() => onUse(job)} disabled={using}>{using ? <LoaderCircle className="animate-spin" /> : <Check />} Use this video</Button>}
                <Button className="rounded-full" variant={onUse ? "outline" : "default"} asChild><a href={`${job.videoUrl}?download=cinematic-video`}><Download /> Download MP4</a></Button>
                <span className="text-[12px] text-muted-foreground">{onUse ? "It goes on to Edit for captions, then Post." : "Send it through compliance review before posting."}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] text-destructive">{job.error ?? "That one didn’t work."}</p>
                <Button className="rounded-full" onClick={() => act("retry")} disabled={!!busy}>{busy === "retry" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} {job.failedAt === "filming" ? "Film it again" : "Try again"}</Button>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={remove} className="inline-flex cursor-pointer items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /> Remove</button>
          </div>
        </div>
      </div>
      {job.status === "approval" && <p className="mt-3 border-t border-border pt-3 text-[12px] text-muted-foreground">Not quite you? Try another scene, or <Link href="/settings#voice" className="text-primary underline-offset-2 hover:underline">add a sharper, front-facing headshot</Link> and start again.</p>}
    </article>
  );
}
