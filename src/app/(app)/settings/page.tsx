"use client";

import * as React from "react";
import { Check, CircleAlert, History, Lock, Mail, Plus, Sparkles, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer } from "@/components/shared/page";
import { Headshot } from "@/components/shared/headshot";
import { BufferCard } from "@/components/buffer/buffer-card";
import { useStore } from "@/lib/store";
import { TEAM } from "@/lib/mock/advisor";
import type { DisclosureVersion } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";

const SECTIONS = [
  ["voice", "Your voice"],
  ["disclosures", "Disclosures"],
  ["publishing", "Publishing"],
  ["approval", "Approval"],
  ["team", "Team"],
  ["plan", "Plan"],
] as const;

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-10 first:border-0 first:pt-0">
      <h2 className="font-serif text-2xl">{title}</h2>
      {desc && <p className="mt-1 max-w-xl text-[14px] text-muted-foreground">{desc}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-medium">
        {label}
        {hint && <span className="text-[12px] font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function useClaudeStatus() {
  const [on, setOn] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    fetch("/api/write").then((r) => r.json()).then((j) => setOn(!!j.claude)).catch(() => setOn(false));
  }, []);
  return on;
}

export default function SettingsPage() {
  const { profile: p, updateProfile, requireApproval, setRequireApproval } = useStore();
  const claude = useClaudeStatus();
  const [newOpinion, setNewOpinion] = React.useState("");
  const [team, setTeam] = React.useState(TEAM.map((t) => ({ ...t, role: t.role as string })));
  const [invite, setInvite] = React.useState("");
  const active = p.disclosures.find((d) => d.active)!;
  const [draft, setDraft] = React.useState(active.text);

  const addOpinion = () => {
    if (!newOpinion.trim()) return;
    updateProfile({ opinions: [...p.opinions, newOpinion.trim()] });
    setNewOpinion("");
  };

  const saveDisclosure = () => {
    const [maj, min] = active.version.slice(1).split(".").map(Number);
    const v: DisclosureVersion = { id: `d${Date.now()}`, version: `v${maj}.${min + 1}`, label: active.label, text: draft, updatedAt: new Date().toISOString(), updatedBy: p.name, active: true };
    updateProfile({ disclosures: [v, ...p.disclosures.map((d) => ({ ...d, active: false }))] });
    toast.success(`Disclosure ${v.version} saved`, { description: "New posts will use it." });
  };

  return (
    <PageContainer className="max-w-[1080px] pt-10">
      <h1 className="mb-10 font-serif text-[40px] leading-tight tracking-tight">Settings</h1>
      <div className="grid gap-12 lg:grid-cols-[180px_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[14px] text-muted-foreground hover:bg-card hover:text-foreground">{label}</a></li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12 pb-24">
          <Section id="voice" title="Your voice" desc="Everything Renom writes starts here: ideas, scripts and captions. The more specific you are, the more it sounds like you.">
            <div className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]", claude ? "border-success/25 bg-success-soft" : "border-border bg-card")}>
              {claude ? <Sparkles className="mt-0.5 size-4 text-success" /> : <CircleAlert className="mt-0.5 size-4 text-muted-foreground" />}
              <div>
                <div className="font-medium">{claude === null ? "Checking the writer…" : claude ? "Claude is writing your content" : "Sample mode: Claude isn't connected yet"}</div>
                <div className="mt-0.5 text-muted-foreground">
                  House style: Eugene Schwartz&rsquo;s market awareness, Joseph Sugarman&rsquo;s slippery slide, Oren Klaff&rsquo;s frame control and David Ogilvy&rsquo;s specifics, kept inside FINRA 2210 and SEC Marketing Rule guardrails.
                  {claude === false && <> Add <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> to <code className="font-mono text-[12px]">.env.local</code> to turn it on.</>}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={p.name} onChange={(e) => updateProfile({ name: e.target.value })} /></Field>
              <Field label="Credentials"><Input value={p.credentials} onChange={(e) => updateProfile({ credentials: e.target.value })} /></Field>
              <Field label="Firm"><Input value={p.firm} onChange={(e) => updateProfile({ firm: e.target.value })} /></Field>
              <Field label="CRD number" hint="FINRA BrokerCheck"><Input value={p.crd} inputMode="numeric" className="tnum" onChange={(e) => updateProfile({ crd: e.target.value.replace(/\D/g, "") })} /></Field>
            </div>
            <Field label="Who you help" hint="Your niche"><Input value={p.niche} onChange={(e) => updateProfile({ niche: e.target.value })} /></Field>
            <Field label="Your ideal client"><Textarea rows={3} value={p.idealClient} onChange={(e) => updateProfile({ idealClient: e.target.value })} /></Field>
            <Field label="Bio"><Textarea rows={3} value={p.bio} onChange={(e) => updateProfile({ bio: e.target.value })} /></Field>
            <div className="grid gap-6 sm:grid-cols-2">
              {([
                ["formalConversational", "Formal", "Conversational"],
                ["cautiousBold", "Cautious", "Bold"],
              ] as const).map(([k, l, r]) => (
                <div key={k}>
                  <div className="mb-3 flex justify-between text-[13px] text-muted-foreground"><span>{l}</span><span>{r}</span></div>
                  <Slider value={[p.tone[k]]} max={100} onValueChange={([v]) => updateProfile({ tone: { ...p.tone, [k]: v } })} />
                </div>
              ))}
            </div>
            <Field label="Strong opinions" hint="Renom leans on these">
              <ul className="space-y-2">
                {p.opinions.map((o, i) => (
                  <li key={i} className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-[14px]">
                    <span className="font-serif text-primary tnum">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1">{o}</span>
                    <button type="button" className="cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100" onClick={() => updateProfile({ opinions: p.opinions.filter((_, j) => j !== i) })} aria-label="Remove"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input value={newOpinion} onChange={(e) => setNewOpinion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOpinion())} placeholder="e.g. Annuities are a tool, not a strategy." />
                <Button type="button" variant="outline" onClick={addOpinion}><Plus /> Add</Button>
              </div>
            </Field>
            <Field label="How you write" hint="Paste a newsletter or LinkedIn post">
              <Textarea rows={5} value={p.sampleWriting} onChange={(e) => updateProfile({ sampleWriting: e.target.value })} className="font-serif text-[15px]" />
            </Field>
            <Field label="Headshots" hint="One headshot, endless poses">
              <div className="flex flex-wrap gap-3">
                {p.headshots.map((h, i) => (
                  <div key={h.id} className="relative size-24 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-[#E9E4D9] to-[#D8D1C2]" title={h.label}>
                    <Headshot pose={h.pose} className="absolute inset-0 h-full w-full" />
                    {i === 0 && <Badge variant="navy" className="absolute top-1.5 left-1.5">Primary</Badge>}
                  </div>
                ))}
                <button type="button" onClick={() => toast("Uploads need file storage", { description: "Coming with the storage setup." })} className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[12px] text-muted-foreground hover:border-primary/50">
                  <Upload className="size-4" /> Upload
                </button>
              </div>
            </Field>
          </Section>

          <Section id="disclosures" title="Disclosures" desc="Added to every caption automatically and locked. Each change is versioned for your records.">
            <div className="rounded-xl border border-primary/30 bg-brass-soft/50 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7d6238] dark:text-primary"><Lock className="size-3" /> Active · {active.version}</span>
                <span className="text-[12px] text-muted-foreground">{active.updatedBy} · {fmtDate(active.updatedAt, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-card text-[13px]" />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground tnum">{draft.length} characters</span>
                <Button size="sm" disabled={draft === active.text} onClick={saveDisclosure}><Check /> Save as new version</Button>
              </div>
            </div>
            <details className="group rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] text-muted-foreground"><History className="size-3.5" /> Version history ({p.disclosures.length})</summary>
              <ul className="divide-y divide-border border-t border-border">
                {p.disclosures.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", d.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{d.version}</span>
                    <p className="line-clamp-2 flex-1 text-[12px] text-muted-foreground">{d.text}</p>
                    {!d.active && <Button size="xs" variant="ghost" onClick={() => setDraft(d.text)}>Restore</Button>}
                  </li>
                ))}
              </ul>
            </details>
          </Section>

          <Section id="publishing" title="Publishing" desc="Renom schedules through Buffer. Your social accounts are connected in Buffer.">
            <BufferCard />
          </Section>

          <Section id="approval" title="Approval" desc="Who has to say yes before anything goes out.">
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                <div><div className="text-[14px] font-medium">Require approval before posting</div><div className="text-[12px] text-muted-foreground">Nothing is scheduled until a reviewer approves it.</div></div>
                <Switch checked={requireApproval} onCheckedChange={(v) => { setRequireApproval(v); toast.success(v ? "Approval required" : "Approval no longer required"); }} />
              </div>
              <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                <div><div className="text-[14px] font-medium">Reviewer</div><div className="text-[12px] text-muted-foreground">New submissions go here.</div></div>
                <Select defaultValue="rl"><SelectTrigger size="sm" className="w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rl">Ruth Lindqvist (CCO)</SelectItem><SelectItem value="pool">Meridian review pool</SelectItem></SelectContent></Select>
              </div>
            </div>
          </Section>

          <Section id="team" title="Team">
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {team.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-navy-foreground dark:bg-secondary">{m.initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{m.name}</div>
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground"><Mail className="size-3" /> {m.email}</div>
                  </div>
                  <Select value={m.role} disabled={"owner" in m && !!m.owner} onValueChange={(v) => setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, role: v } : x)))}>
                    <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Advisor", "Assistant", "Compliance Reviewer"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex gap-2 px-4 py-3">
                <Input placeholder="name@firm.com" value={invite} onChange={(e) => setInvite(e.target.value)} className="h-8" />
                <Button size="sm" variant="outline" onClick={() => {
                  if (!/\S+@\S+\.\S+/.test(invite)) return toast.error("Enter a valid email");
                  setTeam((t) => [...t, { id: invite, name: invite.split("@")[0], email: invite, role: "Assistant", initials: invite.slice(0, 2).toUpperCase(), owner: false }]);
                  toast.success("Invitation sent");
                  setInvite("");
                }}><UserPlus /> Invite</Button>
              </div>
            </div>
          </Section>

          <Section id="plan" title="Plan">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div>
                <div className="font-serif text-xl">Practice</div>
                <div className="text-[13px] text-muted-foreground tnum">9 of 20 videos this month · {team.length} of 5 seats</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast("Billing is mocked in this preview.")}>Manage plan</Button>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
