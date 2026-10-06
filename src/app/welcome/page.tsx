"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleAlert, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/layout/logo";
import { useStore } from "@/lib/store";
import { useBuffer } from "@/lib/buffer/use-buffer";
import { EMPTY_PROFILE, disclosureTemplate, firstDisclosure } from "@/lib/profile";
import type { AdvisorProfile } from "@/lib/types";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

const STEPS = ["welcome", "name", "practice", "audience", "voice", "beliefs", "compliance", "connect", "done"] as const;
type Step = (typeof STEPS)[number];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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

const big = "h-12 rounded-xl text-[16px]";

function Status({ state, ok, off, children }: { state: boolean | null; ok: string; off: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border px-5 py-4", state ? "border-success/25 bg-success-soft" : "border-border bg-card")}>
      <div className="flex items-center gap-2 text-[15px] font-medium">
        {state === null ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : state ? <Check className="size-4 text-success" /> : <CircleAlert className="size-4 text-muted-foreground" />}
        {state === null ? "Checking…" : state ? ok : off}
      </div>
      {!state && state !== null && children && <div className="mt-2 text-[13px] text-muted-foreground">{children}</div>}
    </div>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const { hydrated, onboarded, completeOnboarding, profile: saved } = useStore();
  const buffer = useBuffer();
  const [step, setStep] = React.useState<Step>("welcome");
  const [dir, setDir] = React.useState(1);
  const [p, setP] = React.useState<AdvisorProfile>(EMPTY_PROFILE);
  const [opinion, setOpinion] = React.useState("");
  const [disclosure, setDisclosure] = React.useState("");
  const [requireApproval, setRequireApproval] = React.useState(true);
  const [reviewer, setReviewer] = React.useState("");
  const [claude, setClaude] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (hydrated && onboarded) router.replace("/");
  }, [hydrated, onboarded, router]);
  React.useEffect(() => {
    if (hydrated) setP({ ...EMPTY_PROFILE, ...saved });
    // only once, after saved state loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  React.useEffect(() => {
    if (step === "connect") fetch("/api/write").then((r) => r.json()).then((j) => setClaude(!!j.claude)).catch(() => setClaude(false));
    if (step === "compliance" && !disclosure) setDisclosure(disclosureTemplate(p));
  }, [step, disclosure, p]);

  const set = <K extends keyof AdvisorProfile>(k: K, v: AdvisorProfile[K]) => setP((x) => ({ ...x, [k]: v }));
  const i = STEPS.indexOf(step);
  const go = (to: number) => {
    setDir(to > i ? 1 : -1);
    setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, to))]);
  };
  const addOpinion = () => {
    if (!opinion.trim()) return;
    set("opinions", [...p.opinions, opinion.trim()]);
    setOpinion("");
  };

  const canNext: Record<Step, boolean> = {
    welcome: true,
    name: !!p.name.trim(),
    practice: !!p.firm.trim(),
    audience: !!p.niche.trim() && !!p.idealClient.trim(),
    voice: true,
    beliefs: true,
    compliance: !!disclosure.trim() && (!requireApproval || !!reviewer.trim()),
    connect: true,
    done: true,
  };

  const finish = () => {
    completeOnboarding({
      profile: { ...p, disclosures: disclosure.trim() ? [firstDisclosure(disclosure.trim(), p.name)] : [] },
      requireApproval,
      reviewer: requireApproval ? reviewer.trim() : "",
    });
    router.replace("/");
  };

  const first = p.name.split(" ")[0];

  if (!hydrated) return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-[720px] items-center gap-6 px-6 pt-8">
        <Logo />
        {step !== "welcome" && step !== "done" && (
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(i / (STEPS.length - 2)) * 100}%` }} transition={{ duration: 0.3 }} />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-6 py-12">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-8"
          >
            {step === "welcome" && (
              <>
                <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight sm:text-[56px]">Let&rsquo;s set up your studio.</h1>
                <p className="max-w-lg text-[17px] text-muted-foreground">Five minutes, a few questions. Everything {BRAND.name} writes for you (ideas, scripts, captions) starts from your answers.</p>
              </>
            )}

            {step === "name" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">What should we call you?</h1>
                <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
                  <Field label="Full name"><Input autoFocus className={big} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Jordan Avery" /></Field>
                  <Field label="Credentials" hint="Optional"><Input className={big} value={p.credentials} onChange={(e) => set("credentials", e.target.value)} placeholder="CFP®, CPA" /></Field>
                </div>
              </>
            )}

            {step === "practice" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">Where do you practice{first ? `, ${first}` : ""}?</h1>
                <Field label="Firm"><Input autoFocus className={big} value={p.firm} onChange={(e) => set("firm", e.target.value)} placeholder="Avery Wealth Partners" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" hint="Optional"><Input className={big} value={p.city} onChange={(e) => set("city", e.target.value)} placeholder="Charlotte, NC" /></Field>
                  <Field label="CRD number" hint="Optional"><Input className={cn(big, "tnum")} inputMode="numeric" value={p.crd} onChange={(e) => set("crd", e.target.value.replace(/\D/g, ""))} /></Field>
                </div>
              </>
            )}

            {step === "audience" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">Who do you help?</h1>
                <p className="-mt-4 text-[15px] text-muted-foreground">Be specific. &ldquo;Everyone with money&rdquo; writes bland videos.</p>
                <Field label="Your niche, in one line"><Input autoFocus className={big} value={p.niche} onChange={(e) => set("niche", e.target.value)} placeholder="Tax-aware planning for executives with equity compensation" /></Field>
                <Field label="Your ideal client">
                  <Textarea rows={4} className="rounded-xl text-[15px]" value={p.idealClient} onChange={(e) => set("idealClient", e.target.value)} placeholder="Age, profession, assets, the decision they’re facing, what keeps them up at night…" />
                </Field>
                <Field label="A short bio" hint="Optional"><Textarea rows={3} className="rounded-xl text-[15px]" value={p.bio} onChange={(e) => set("bio", e.target.value)} placeholder="How you got here, and what clients say about you." /></Field>
              </>
            )}

            {step === "voice" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">How do you sound?</h1>
                <div className="space-y-7 rounded-2xl border border-border bg-card p-6">
                  {([
                    ["formalConversational", "Formal", "Conversational"],
                    ["cautiousBold", "Cautious", "Bold"],
                  ] as const).map(([k, l, r]) => (
                    <div key={k}>
                      <div className="mb-3 flex justify-between text-[14px] text-muted-foreground"><span>{l}</span><span>{r}</span></div>
                      <Slider value={[p.tone[k]]} max={100} onValueChange={([v]) => set("tone", { ...p.tone, [k]: v })} />
                    </div>
                  ))}
                </div>
                <Field label="Paste something you’ve written" hint="A newsletter, an email, a LinkedIn post">
                  <Textarea rows={6} className="rounded-xl font-serif text-[16px]" value={p.sampleWriting} onChange={(e) => set("sampleWriting", e.target.value)} placeholder="The more of your real writing, the more it sounds like you." />
                </Field>
              </>
            )}

            {step === "beliefs" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">What do you believe that others don&rsquo;t?</h1>
                <p className="-mt-4 text-[15px] text-muted-foreground">Strong opinions make videos people remember. Add two or three.</p>
                <ul className="space-y-2">
                  {p.opinions.map((o, j) => (
                    <li key={j} className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-[15px]">
                      <span className="font-serif text-primary tnum">{String(j + 1).padStart(2, "0")}</span>
                      <span className="flex-1">{o}</span>
                      <button type="button" className="cursor-pointer text-muted-foreground" onClick={() => set("opinions", p.opinions.filter((_, k) => k !== j))} aria-label="Remove"><X className="size-4" /></button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input autoFocus className={big} value={opinion} onChange={(e) => setOpinion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOpinion())} placeholder="e.g. Tax planning is a year-round discipline, not an April event." />
                  <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={addOpinion}><Plus /> Add</Button>
                </div>
              </>
            )}

            {step === "compliance" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">Keep compliance happy.</h1>
                <Field label="Your disclosure" hint="Added to every caption, locked and versioned">
                  <Textarea rows={6} className="rounded-xl text-[14px]" value={disclosure} onChange={(e) => setDisclosure(e.target.value)} />
                </Field>
                <p className="-mt-5 text-[12px] text-muted-foreground">Replace anything in [brackets] with your firm&rsquo;s approved language.</p>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[15px] font-medium">Require approval before posting</div>
                      <div className="text-[13px] text-muted-foreground">Nothing is scheduled until your reviewer says yes.</div>
                    </div>
                    <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                  </div>
                  {requireApproval && (
                    <div className="mt-4">
                      <Field label="Who reviews?"><Input className="h-11 rounded-xl" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your CCO's name" /></Field>
                      <p className="mt-1.5 text-[12px] text-muted-foreground">For now you&rsquo;ll act on their behalf in Approve; reviewer sign-in comes with accounts.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {step === "connect" && (
              <>
                <h1 className="font-serif text-[40px] leading-tight tracking-tight">Two connections.</h1>
                <p className="-mt-4 text-[15px] text-muted-foreground">Claude writes. Buffer publishes. Keys live in <code className="font-mono text-[13px]">.env.local</code> on the computer running {BRAND.name}, never in the browser.</p>
                <Status state={claude} ok="Claude is connected. It will write in your voice." off="Claude isn’t connected">
                  Add <code className="font-mono">ANTHROPIC_API_KEY=…</code> to <code className="font-mono">.env.local</code> and restart. Until then, writing is turned off.
                </Status>
                <Status state={buffer.loading ? null : buffer.connected} ok={`Buffer is connected${buffer.status && "organization" in buffer.status ? `: ${buffer.status.organization.name}` : ""}.`} off="Buffer isn’t connected">
                  Add a personal key from publish.buffer.com/settings/api as <code className="font-mono">BUFFER_API_KEY=…</code> and restart. Until then you can still post by hand.
                </Status>
                <p className="text-[13px] text-muted-foreground">You can finish setup either way and connect later in Settings.</p>
              </>
            )}

            {step === "done" && (
              <>
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex size-14 items-center justify-center rounded-full bg-success-soft">
                  <Check className="size-7 text-success" />
                </motion.div>
                <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight">You&rsquo;re ready{first ? `, ${first}` : ""}.</h1>
                <p className="max-w-lg text-[17px] text-muted-foreground">Next: tell {BRAND.name} what you want to talk about. It&rsquo;ll suggest ideas, write the script, then you record, trim and post. You can change any of this in Settings.</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex items-center justify-between">
          {i > 0 && step !== "done" ? (
            <Button variant="ghost" className="rounded-full" onClick={() => go(i - 1)}><ArrowLeft /> Back</Button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {(step === "voice" || step === "beliefs") && <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => go(i + 1)}>Skip for now</Button>}
            {step === "done" ? (
              <Button size="lg" className="rounded-full px-7" onClick={finish}>Make my first video <ArrowRight /></Button>
            ) : (
              <Button size="lg" className="rounded-full px-7" disabled={!canNext[step]} onClick={() => go(i + 1)}>
                {step === "welcome" ? "Begin" : "Continue"} <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
