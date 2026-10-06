"use client";

import * as React from "react";
import { Brain, Check, History, Lock, Plus, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { Headshot } from "@/components/shared/headshot";
import { FieldLabel } from "@/components/studio/step-layout";
import { ADVISOR } from "@/lib/mock/advisor";
import type { DisclosureVersion } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";

const SECTIONS = [
  ["identity", "Identity"],
  ["bio", "Bio & niche"],
  ["voice", "Voice & tone"],
  ["opinions", "Opinions"],
  ["headshots", "Headshots"],
  ["brand", "Brand"],
  ["disclosures", "Disclosures"],
] as const;

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
          <div>
            <h2 className="font-serif text-lg">{title}</h2>
            {desc && <p className="mt-1 text-[12px] text-muted-foreground">{desc}</p>}
          </div>
          <div className="min-w-0 space-y-4">{children}</div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function ProfilePage() {
  const [p, setP] = React.useState(ADVISOR);
  const [newOpinion, setNewOpinion] = React.useState("");
  const [disclosures, setDisclosures] = React.useState<DisclosureVersion[]>(ADVISOR.disclosures);
  const active = disclosures.find((d) => d.active)!;
  const [draft, setDraft] = React.useState(active.text);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));

  const saveDisclosure = () => {
    const [maj, min] = active.version.slice(1).split(".").map(Number);
    const v: DisclosureVersion = { id: `d${Date.now()}`, version: `v${maj}.${min + 1}`, label: active.label, text: draft, updatedAt: new Date().toISOString(), updatedBy: "Catherine Hale", active: true };
    setDisclosures((ds) => [v, ...ds.map((d) => ({ ...d, active: false }))]);
    toast.success(`Disclosure ${v.version} saved`, { description: "Submitted to compliance. New posts will use it once approved." });
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="The brain behind every agent"
        description="Ideas, scripts, thumbnails and descriptions all draw from what's here. The more specific, the more it sounds like you."
        actions={<Button onClick={() => toast.success("Profile saved")}><Save /> Save changes</Button>}
      />

      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="flex size-10 items-center justify-center rounded-full bg-brass-soft"><Brain className="size-5 text-primary" /></div>
        <div className="min-w-56 flex-1">
          <div className="flex items-baseline justify-between"><span className="text-[13px] font-medium">Profile strength</span><span className="font-serif text-lg tnum">86%</span></div>
          <Progress value={86} className="mt-2" />
        </div>
        <p className="text-[12px] text-muted-foreground">Add 2 more sample writing pieces to improve voice match.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
        <nav className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">{label}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-6">
          <Section id="identity" title="Identity" desc="Used in descriptions, lower-thirds and disclosures.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><FieldLabel>Full name</FieldLabel><Input value={p.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div><FieldLabel>Credentials</FieldLabel><Input value={p.credentials} onChange={(e) => set("credentials", e.target.value)} /></div>
              <div><FieldLabel>Firm name</FieldLabel><Input value={p.firm} onChange={(e) => set("firm", e.target.value)} /></div>
              <div><FieldLabel>Title</FieldLabel><Input value={p.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div><FieldLabel hint="FINRA BrokerCheck">CRD number</FieldLabel><Input value={p.crd} onChange={(e) => set("crd", e.target.value.replace(/\D/g, ""))} className="tnum" inputMode="numeric" /></div>
              <div><FieldLabel>City</FieldLabel><Input value={p.city} onChange={(e) => set("city", e.target.value)} /></div>
            </div>
          </Section>

          <Section id="bio" title="Bio & niche" desc="Who you serve and why they trust you.">
            <div><FieldLabel hint={`${p.bio.length}/600`}>Advisor bio</FieldLabel><Textarea rows={4} value={p.bio} maxLength={600} onChange={(e) => set("bio", e.target.value)} /></div>
            <div><FieldLabel>Niche</FieldLabel><Input value={p.niche} onChange={(e) => set("niche", e.target.value)} /></div>
            <div><FieldLabel>Ideal client</FieldLabel><Textarea rows={3} value={p.idealClient} onChange={(e) => set("idealClient", e.target.value)} /></div>
          </Section>

          <Section id="voice" title="Voice & tone" desc="How Renom should sound when it writes for you.">
            {([
              ["formalConversational", "Formal", "Conversational"],
              ["cautiousBold", "Cautious", "Bold"],
            ] as const).map(([k, l, r]) => (
              <div key={k}>
                <div className="mb-2 flex justify-between text-[12px]"><span className="text-muted-foreground">{l}</span><span className="text-muted-foreground">{r}</span></div>
                <Slider value={[p.tone[k]]} max={100} onValueChange={([v]) => set("tone", { ...p.tone, [k]: v })} />
              </div>
            ))}
            <div>
              <FieldLabel hint="Paste a newsletter, email or LinkedIn post">Sample writing</FieldLabel>
              <Textarea rows={5} value={p.sampleWriting} onChange={(e) => set("sampleWriting", e.target.value)} className="font-serif text-[15px]" />
            </div>
          </Section>

          <Section id="opinions" title="Opinions & talking points" desc="Strong views make better content. Renom will lean on these.">
            <ul className="space-y-2">
              {p.opinions.map((o, i) => (
                <li key={i} className="group flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-[13px]">
                  <span className="font-serif text-primary tnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{o}</span>
                  <button className="cursor-pointer text-muted-foreground opacity-0 group-hover:opacity-100" onClick={() => set("opinions", p.opinions.filter((_, j) => j !== i))} aria-label="Remove"><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input value={newOpinion} onChange={(e) => setNewOpinion(e.target.value)} placeholder="e.g. Annuities are a tool, not a strategy." onKeyDown={(e) => { if (e.key === "Enter" && newOpinion.trim()) { set("opinions", [...p.opinions, newOpinion.trim()]); setNewOpinion(""); } }} />
              <Button variant="outline" onClick={() => { if (newOpinion.trim()) { set("opinions", [...p.opinions, newOpinion.trim()]); setNewOpinion(""); } }}><Plus /> Add</Button>
            </div>
          </Section>

          <Section id="headshots" title="Headshots" desc="One headshot, endless poses. Upload 1–5 well-lit photos.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {p.headshots.map((h, i) => (
                <div key={h.id} className="overflow-hidden rounded-lg border border-border">
                  <div className="relative aspect-square bg-gradient-to-b from-[#E9E4D9] to-[#D8D1C2]">
                    <Headshot pose={h.pose} className="absolute inset-x-0 bottom-0 h-full w-full" />
                    {i === 0 && <Badge variant="navy" className="absolute top-2 left-2">Primary</Badge>}
                  </div>
                  <div className="truncate px-2.5 py-2 text-[11px] text-muted-foreground">{h.label}</div>
                </div>
              ))}
              <button onClick={() => toast("Upload", { description: "Connect storage to enable uploads." })} className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                <Upload className="size-5" />
                <span className="text-[12px]">Upload headshot</span>
              </button>
            </div>
          </Section>

          <Section id="brand" title="Brand" desc="Applied to thumbnails, captions and lower-thirds.">
            <div className="flex flex-wrap gap-4">
              {p.brandColors.map((c, i) => (
                <div key={i} className="w-32">
                  <div className="h-14 rounded-md border border-border" style={{ background: c }} />
                  <Input value={c} onChange={(e) => set("brandColors", p.brandColors.map((x, j) => (j === i ? e.target.value : x)))} className="mt-2 h-8 font-mono text-[12px] uppercase" />
                </div>
              ))}
            </div>
          </Section>

          <Section id="disclosures" title="Compliance disclosures" desc="Auto-appended to every description. Edits create a new version and require approval.">
            <div className="rounded-md border border-primary/30 bg-brass-soft/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#7d6238] uppercase dark:text-primary"><Lock className="size-3" /> Active · {active.version}</span>
                <span className="text-[11px] text-muted-foreground">Approved by {active.updatedBy} · {fmtDate(active.updatedAt, { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <Textarea rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-card text-[13px]" />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground tnum">{draft.length} characters</span>
                <Button size="sm" disabled={draft === active.text} onClick={saveDisclosure}><Check /> Save as new version</Button>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2 flex items-center gap-1.5"><History className="size-3" /> Version history</div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {disclosures.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[11px]", d.active ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>{d.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[12px] text-muted-foreground">{d.text}</p>
                      <div className="mt-1 text-[11px] text-muted-foreground">{d.updatedBy} · {fmtDate(d.updatedAt, { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    {d.active ? <Badge variant="success">Active</Badge> : <Button size="xs" variant="ghost" onClick={() => setDraft(d.text)}>Restore</Button>}
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}
