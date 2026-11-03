"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, CreditCard, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { PLANS, TRIAL_DAYS, TRIAL_VIDEOS, annualSavings, effectiveMonthly, getPlan, money, type BillingInterval, type PlanId } from "@/lib/pricing";
import { cn, fmtDate } from "@/lib/utils";

interface Billing {
  required: boolean;
  active: boolean;
  status: string | null;
  plan: PlanId | null;
  interval: BillingInterval | null;
  trialEnd: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialing: boolean;
  trialVideosUsed: number;
  trialVideos: number;
  exempt?: "admin" | "client" | "early" | "off";
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
  return j as T;
}

/** Choose a plan (card at checkout, trial included), or see and manage the one you have. */
export function BillingPage() {
  const { onboarded } = useStore();
  const [b, setB] = React.useState<Billing | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const justPaid = q.get("checkout") === "done";

  React.useEffect(() => {
    const session = new URLSearchParams(window.location.search).get("session");
    fetch(`/api/billing${session ? `?session=${encodeURIComponent(session)}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setB(j.billing))
      .catch(() => toast.error("Couldn’t load billing"));
  }, []);

  const go = async (what: "portal" | "start") => {
    setBusy(what);
    try {
      if (what === "portal") window.location.href = (await post<{ url: string }>("/api/billing/portal")).url;
      else {
        const r = await post<{ billing: Billing }>("/api/billing/start");
        setB(r.billing);
        toast.success("Your plan has started", { description: "Make as many videos as you like." });
        setBusy(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  if (!b) return <div className="flex items-center gap-2 py-16 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading billing…</div>;

  // Back from Checkout.
  if (justPaid && b.active)
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success text-white"><Check className="size-6" /></span>
        <h1 className="mt-5 font-serif text-[34px] leading-tight">You’re in.</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {b.trialing && b.trialEnd ? `Your free trial runs until ${fmtDate(b.trialEnd)}, with up to ${b.trialVideos} finished videos. You won’t be charged before then.` : "Your plan is active."}
        </p>
        <Button asChild className="mt-7 rounded-full px-6">
          <Link href={onboarded ? "/" : "/welcome"}>{onboarded ? "Go to your studio" : "Set up your studio"} <ArrowRight /></Link>
        </Button>
      </div>
    );

  if (!b.required)
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="font-serif text-[34px] leading-tight">Billing</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {b.exempt === "off" ? "Billing isn’t switched on for this studio yet." : b.exempt === "client" ? "Your studio was set up for you, and it’s billed separately. There’s nothing to do here." : b.exempt === "admin" ? "Admin accounts don’t need a plan." : "You joined during early access, so your studio doesn’t need a plan."}
        </p>
      </div>
    );

  if (!b.active) return <ChoosePlan ended={!!b.status} />;

  const plan = getPlan(b.plan);
  return (
    <div className="mx-auto max-w-2xl space-y-5 py-6">
      <h1 className="font-serif text-[34px] leading-tight">Billing</h1>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-muted-foreground">Your plan</div>
            <div className="mt-0.5 text-[22px] font-semibold">{plan?.name ?? "Renom"} <span className="text-[14px] font-normal text-muted-foreground">· billed {b.interval === "year" ? "annually" : "monthly"}</span></div>
            {plan && <div className="mt-1 text-[14px] text-muted-foreground">{b.interval === "year" ? `${money(plan.annual)}/yr (${money(effectiveMonthly(plan))}/mo)` : `${money(plan.monthly)}/mo`}</div>}
          </div>
          <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", b.trialing ? "bg-brass-soft text-primary" : b.status === "past_due" ? "bg-warning-soft text-destructive" : "bg-success-soft text-success")}>
            {b.trialing ? "Free trial" : b.status === "past_due" ? "Payment due" : b.cancelAtPeriodEnd ? "Cancels at period end" : "Active"}
          </span>
        </div>

        {b.trialing && (
          <div className="mt-5 rounded-xl bg-muted/60 p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span>Trial videos</span>
              <span className="font-medium tnum">{b.trialVideosUsed} of {b.trialVideos}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (b.trialVideosUsed / b.trialVideos) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {b.trialVideosUsed >= b.trialVideos ? "You’ve made all your trial videos. Start your plan now to keep going." : `Your trial ends ${b.trialEnd ? fmtDate(b.trialEnd) : "soon"}; your card is charged then.`}
            </p>
            <Button className="mt-3 rounded-full" disabled={!!busy} onClick={() => go("start")}>
              {busy === "start" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Start my plan now
            </Button>
          </div>
        )}
        {!b.trialing && b.periodEnd && <p className="mt-4 text-[13px] text-muted-foreground">{b.cancelAtPeriodEnd ? "Access ends" : "Renews"} {fmtDate(b.periodEnd)}.</p>}
        {b.status === "past_due" && <p className="mt-3 text-[13px] text-destructive">Your last payment didn’t go through. Update your card to keep your studio.</p>}

        <div className="mt-6 border-t border-border pt-5">
          <Button variant="outline" className="rounded-full" disabled={!!busy} onClick={() => go("portal")}>
            {busy === "portal" ? <LoaderCircle className="animate-spin" /> : <CreditCard />} Manage billing
          </Button>
          <p className="mt-2 text-[12px] text-muted-foreground">Change plan or billing, update your card, see invoices, or cancel. Opens Stripe’s secure billing page.</p>
        </div>
      </section>
    </div>
  );
}

/** No plan yet (or it ended): pick one; annual first. Checkout takes the card; the trial is free. */
function ChoosePlan({ ended }: { ended: boolean }) {
  const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [interval, setInterval] = React.useState<BillingInterval>(q.get("billing") === "month" ? "month" : "year");
  const [busy, setBusy] = React.useState<PlanId | null>(null);
  const preferred = q.get("plan") === "starter" ? "starter" : q.get("plan") === "pro" ? "pro" : null;
  const annual = interval === "year";

  const choose = async (plan: PlanId) => {
    setBusy(plan);
    try {
      window.location.href = (await post<{ url: string }>("/api/billing/checkout", { plan, interval })).url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="text-center">
        <h1 className="font-serif text-[34px] leading-tight sm:text-[40px]">{ended ? "Choose a plan to keep going" : "Start your free trial"}</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted-foreground">
          {ended ? "Your studio, videos and drafts are all saved. Pick a plan to pick up where you left off." : `${TRIAL_DAYS} days free with up to ${TRIAL_VIDEOS} finished videos. Add a card to start; you won’t be charged until the trial ends, and you can cancel anytime before then.`}
        </p>
      </div>
      <div className="mt-7 flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-soft" role="group" aria-label="Billing">
          {(["year", "month"] as const).map((i) => (
            <button key={i} type="button" onClick={() => setInterval(i)} aria-pressed={interval === i} className={cn("flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium", interval === i ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {i === "year" ? "Annual" : "Monthly"}
              {i === "year" && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">2 months free</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const pick = preferred ? p.id === preferred : !!p.highlight;
          return (
            <div key={p.id} className={cn("flex flex-col rounded-2xl bg-card p-6 shadow-soft", pick ? "border-2 border-primary" : "border border-border")}>
              <div className="text-[18px] font-semibold">{p.name}</div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-serif text-[48px] leading-none tnum">{money(annual ? effectiveMonthly(p) : p.monthly)}</span>
                <span className="pb-1.5 text-[14px] text-muted-foreground">/ month</span>
              </div>
              <div className="mt-1.5 text-[13px] text-muted-foreground">
                {annual ? <>Billed annually ({money(p.annual)}/yr) · <span className="font-medium text-success">save {money(annualSavings(p))}</span></> : "Billed monthly"}
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-[13px]"><Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> {f}</li>)}
              </ul>
              <Button className="mt-6 h-11 rounded-full" variant={pick ? "default" : "outline"} disabled={!!busy} onClick={() => choose(p.id)}>
                {busy === p.id ? <LoaderCircle className="animate-spin" /> : null} {ended ? `Choose ${p.name}` : `Start free trial of ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground"><Lock className="size-3" /> Secure checkout by Stripe. Cancel anytime from this page.</p>
    </div>
  );
}
