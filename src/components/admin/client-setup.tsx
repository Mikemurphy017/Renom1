"use client";

/* eslint-disable @next/next/no-img-element -- the client's own photos */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ImagePlus, KeyRound, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/shared/page";
import { EMPTY_PROFILE, disclosureTemplate } from "@/lib/profile";
import { uploadImage } from "@/lib/media/upload";
import { BRAND } from "@/lib/brand";
import type { AdvisorProfile, CoverPhotos } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Credentials: the copy-and-paste hand-over                           */
/* ------------------------------------------------------------------ */

export interface Credentials {
  name: string;
  email: string;
  password: string;
  signInUrl: string;
}

export function credentialsMessage(c: Credentials) {
  const first = c.name.trim().split(/\s+/)[0] || "there";
  return [
    `Hi ${first},`,
    "",
    `Your ${BRAND.name} studio is set up and ready for you.`,
    "",
    `Sign in: ${c.signInUrl}`,
    `Email: ${c.email}`,
    `Temporary password: ${c.password}`,
    "",
    "Once you're in, you'll be asked to choose your own password (Settings → Account).",
  ].join("\n");
}

/** The sign-in details, shown once, with one button that copies a ready-to-send message. */
export function CredentialsCard({ creds, title = "Client is set up", onDone }: { creds: Credentials; title?: string; onDone?: () => void }) {
  const message = credentialsMessage(creds);
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      toast.success(`${what} copied`);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Couldn’t copy", { description: "Select the text and copy it instead." });
    }
  };
  return (
    <div className="rounded-2xl border border-success/30 bg-success-soft p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[16px] font-medium">
        <span className="flex size-6 items-center justify-center rounded-full bg-success text-white"><Check className="size-3.5" /></span>
        {title}
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">Copy this and send it to {creds.name.split(" ")[0] || "them"} by email or text. The password is shown only now; if it gets lost, make a new one from the Clients list.</p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-card p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap select-all">{message}</pre>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button className="rounded-full" onClick={() => copy("Message", message)}>
          {copied === "Message" ? <Check /> : <Copy />} Copy message
        </Button>
        <Button variant="outline" className="rounded-full" onClick={() => copy("Password", creds.password)}>
          {copied === "Password" ? <Check /> : <KeyRound />} Copy password only
        </Button>
        {onDone && <Button variant="ghost" className="ml-auto rounded-full" onClick={onDone}>Done</Button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The setup form (new client, or editing one)                         */
/* ------------------------------------------------------------------ */

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.error || "That didn’t work. Please try again.");
  return body as T;
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium">
        {label}
        {hint && <span className="text-[12px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

const COVER: { id: CoverPhotos; label: string }[] = [
  { id: "ai", label: "AI photo set" },
  { id: "real", label: "Real photos" },
  { id: "none", label: "No photo" },
];

/** Set up a new client (no id) or edit an existing client's workspace. */
export function ClientSetup({ id }: { id?: string }) {
  const router = useRouter();
  const editing = !!id;
  const [loading, setLoading] = React.useState(editing);
  const [loginEmail, setLoginEmail] = React.useState("");
  const [p, setP] = React.useState<AdvisorProfile>(EMPTY_PROFILE);
  const [disclosure, setDisclosure] = React.useState("");
  const [requireApproval, setRequireApproval] = React.useState(false);
  const [reviewer, setReviewer] = React.useState("");
  const [opinion, setOpinion] = React.useState("");
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [creds, setCreds] = React.useState<Credentials | null>(null);
  const [meta, setMeta] = React.useState<{ videos: number; onboarded: boolean } | null>(null);
  const set = (patch: Partial<AdvisorProfile>) => setP((x) => ({ ...x, ...patch }));

  React.useEffect(() => {
    if (!id) return;
    call<{ user: { email: string }; profile: AdvisorProfile; requireApproval: boolean; reviewer: string; videos: number; onboarded: boolean }>(`/api/admin/clients/${id}`)
      .then((r) => {
        setLoginEmail(r.user.email);
        setP(r.profile);
        setDisclosure(r.profile.disclosures.find((d) => d.active)?.text ?? r.profile.disclosures[0]?.text ?? "");
        setRequireApproval(r.requireApproval);
        setReviewer(r.reviewer);
        setMeta({ videos: r.videos, onboarded: r.onboarded });
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoBusy(true);
    try {
      const added: AdvisorProfile["headshots"] = [];
      for (const f of Array.from(files).slice(0, 4)) {
        const up = await uploadImage(f, "headshot", "headshot");
        added.push({ id: up.id, label: f.name.replace(/\.[^.]+$/, ""), pose: "center", url: up.url });
      }
      setP((x) => ({ ...x, headshots: [...x.headshots.filter((h) => h.url), ...added].slice(0, 6) }));
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setPhotoBusy(false);
    }
  };

  const addOpinion = () => {
    const o = opinion.trim();
    if (!o) return;
    set({ opinions: [...p.opinions, o] });
    setOpinion("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const profile = { ...p, email: p.email || loginEmail, disclosures: disclosure.trim() ? [{ ...(p.disclosures[0] ?? {}), text: disclosure.trim() }] : [] };
      const body = JSON.stringify({ email: loginEmail, profile, requireApproval, reviewer });
      if (editing) {
        await call(`/api/admin/clients/${id}`, { method: "PUT", body });
        toast.success("Workspace saved", { description: "They’ll see it next time they open the app." });
        router.push("/admin/clients");
      } else {
        const r = await call<{ password: string; signInUrl: string; user: { email: string; name: string } }>("/api/admin/clients", { method: "POST", body });
        setCreds({ name: r.user.name, email: r.user.email, password: r.password, signInUrl: r.signInUrl });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (creds)
    return (
      <div className="mx-auto max-w-[720px]">
        <CredentialsCard creds={creds} onDone={() => router.push("/admin/clients")} />
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          <Link href="/admin/clients/new" onClick={() => window.location.assign("/admin/clients/new")} className="underline underline-offset-2">Set up another client</Link>
        </p>
      </div>
    );

  if (loading) return <div className="flex items-center gap-2 py-16 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading workspace…</div>;

  return (
    <form onSubmit={save} className="mx-auto max-w-[820px] space-y-5 pb-24">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Clients</Link>
      <PageHeader
        title={editing ? `${p.name || loginEmail}’s workspace` : "Set up a client"}
        description={editing ? `${loginEmail}${meta ? ` · ${meta.videos} video${meta.videos === 1 ? "" : "s"}` : ""}. Changes appear the next time they open the app.` : "Fill in what you know; they can change any of it later in Settings. When you save, you get their sign-in details to copy and send."}
      />

      <Card title="Account" desc={editing ? undefined : "The email they’ll sign in with. They get a temporary password and choose their own after signing in."}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input required value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Jordan Ellis" />
          </Field>
          <Field label="Sign-in email" hint={editing ? "Can’t be changed here" : undefined}>
            <Input required type="email" value={loginEmail} disabled={editing} onChange={(e) => setLoginEmail(e.target.value)} placeholder="jordan@firm.com" />
          </Field>
        </div>
      </Card>

      <Card title="Practice">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Credentials" hint="On the name title"><Input value={p.credentials} onChange={(e) => set({ credentials: e.target.value })} placeholder="CFP®, CPA" /></Field>
          <Field label="Firm"><Input value={p.firm} onChange={(e) => set({ firm: e.target.value })} placeholder="Ellis Wealth Partners" /></Field>
          <Field label="Title"><Input value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder="Founder & Lead Advisor" /></Field>
          <Field label="City"><Input value={p.city} onChange={(e) => set({ city: e.target.value })} placeholder="Austin, TX" /></Field>
          <Field label="CRD #" hint="Optional"><Input value={p.crd} onChange={(e) => set({ crd: e.target.value })} /></Field>
          <Field label="Calendar link" hint="Added to captions and end cards"><Input value={p.calendarUrl ?? ""} onChange={(e) => set({ calendarUrl: e.target.value })} placeholder="calendly.com/jordan" /></Field>
        </div>
        <Field label="Short bio"><Textarea rows={3} value={p.bio} onChange={(e) => set({ bio: e.target.value })} /></Field>
      </Card>

      <Card title="Audience & niche" desc="What every script is aimed at.">
        <Field label="Niche"><Input value={p.niche} onChange={(e) => set({ niche: e.target.value })} placeholder="Tech employees with equity compensation" /></Field>
        <Field label="Ideal client"><Textarea rows={3} value={p.idealClient} onChange={(e) => set({ idealClient: e.target.value })} placeholder="Engineers and managers, 35–50, with RSUs and options, worried about the tax bill…" /></Field>
      </Card>

      <Card title="Voice" desc="How their scripts should sound.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-between text-[12px] text-muted-foreground"><span>Formal</span><span>Conversational</span></div>
            <Slider value={[p.tone.formalConversational]} min={0} max={100} onValueChange={([v]) => set({ tone: { ...p.tone, formalConversational: v } })} aria-label="Formal to conversational" />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-[12px] text-muted-foreground"><span>Cautious</span><span>Bold</span></div>
            <Slider value={[p.tone.cautiousBold]} min={0} max={100} onValueChange={([v]) => set({ tone: { ...p.tone, cautiousBold: v } })} aria-label="Cautious to bold" />
          </div>
        </div>
        <Field label="Beliefs and opinions" hint="Things they say to clients">
          <div className="flex gap-2">
            <Input value={opinion} onChange={(e) => setOpinion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOpinion(); } }} placeholder="Most people overpay tax on their RSUs by selling at the wrong time" />
            <Button type="button" variant="outline" onClick={addOpinion}><Plus /> Add</Button>
          </div>
        </Field>
        {p.opinions.length > 0 && (
          <ul className="space-y-1.5">
            {p.opinions.map((o, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
                <span className="flex-1">{o}</span>
                <button type="button" className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label="Remove" onClick={() => set({ opinions: p.opinions.filter((_, j) => j !== i) })}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <Field label="Writing sample" hint="Optional: a post or email in their own words"><Textarea rows={4} value={p.sampleWriting} onChange={(e) => set({ sampleWriting: e.target.value })} /></Field>
      </Card>

      <Card title="Photos & covers" desc="Headshots go on their covers; 3–4 from different angles work best.">
        <div className="flex flex-wrap gap-3">
          {p.headshots.filter((h) => h.url).map((h) => (
            <div key={h.id} className="relative size-24 overflow-hidden rounded-xl border border-border">
              <img src={h.url} alt={h.label} className="h-full w-full object-cover" />
              <button type="button" onClick={() => set({ headshots: p.headshots.filter((x) => x.id !== h.id) })} className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white" aria-label="Remove photo"><X className="size-3" /></button>
            </div>
          ))}
          <label className={cn("flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/50 hover:text-foreground", photoBusy && "pointer-events-none opacity-60")}>
            {photoBusy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {photoBusy ? "Uploading…" : "Add photos"}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <Field label="What goes on their covers">
          <ToggleGroup type="single" value={p.coverPhotos ?? ""} onValueChange={(v) => set({ coverPhotos: (v || undefined) as CoverPhotos | undefined })} className="w-full sm:w-auto">
            {COVER.map((c) => <ToggleGroupItem key={c.id} value={c.id} className="flex-1 sm:flex-none sm:px-4">{c.label}</ToggleGroupItem>)}
          </ToggleGroup>
        </Field>
        <Field label="Brand colors" hint="Optional">
          <div className="flex flex-wrap items-center gap-2">
            {p.brandColors.map((c) => (
              <button key={c} type="button" title="Remove" onClick={() => set({ brandColors: p.brandColors.filter((x) => x !== c) })} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[12px]">
                <span className="size-4 rounded-full border border-border" style={{ background: c }} /> {c} <X className="size-3 text-muted-foreground" />
              </button>
            ))}
            {p.brandColors.length < 6 && (
              <label className="relative flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground">
                <Plus className="size-3" /> Add color
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => !p.brandColors.includes(e.target.value.toUpperCase()) && set({ brandColors: [...p.brandColors, e.target.value.toUpperCase()] })} />
              </label>
            )}
          </div>
        </Field>
      </Card>

      <Card title="Compliance">
        <Field label="Disclosure" hint="Added to every post">
          <Textarea rows={4} value={disclosure} onChange={(e) => setDisclosure(e.target.value)} placeholder="Securities offered through…" />
        </Field>
        {!disclosure && (
          <button type="button" className="cursor-pointer text-[12px] text-primary underline-offset-2 hover:underline" onClick={() => setDisclosure(disclosureTemplate(p))}>Start from a template</button>
        )}
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[13px] font-medium">Compliance approval before posting</span>
            <span className="block text-[12px] text-muted-foreground">Videos go to a reviewer before they can be posted</span>
          </span>
          <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
        </label>
        {requireApproval && (
          <Field label="Reviewer email"><Input type="email" required value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="compliance@firm.com" /></Field>
        )}
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button type="button" variant="ghost" className="rounded-full" onClick={() => router.push("/admin/clients")}>Cancel</Button>
        <Button type="submit" className="rounded-full px-5" disabled={saving || photoBusy}>
          {saving ? <LoaderCircle className="animate-spin" /> : <Check />} {editing ? "Save workspace" : "Create workspace & sign-in"}
        </Button>
      </div>
    </form>
  );
}
