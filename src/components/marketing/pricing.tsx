"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PLANS, TRIAL_DAYS, TRIAL_VIDEOS, annualSavings, effectiveMonthly, money, type BillingInterval } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/**
 * The plans, annual first. On annual, the big number is the effective monthly
 * price with "billed annually" under it and "2 months free" as the lead; the
 * dollar savings sits in smaller text. A toggle switches to monthly.
 */
export function PricingPlans() {
  const [interval, setInterval] = React.useState<BillingInterval>("year");
  const annual = interval === "year";
  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-soft" role="group" aria-label="Billing">
          {(["year", "month"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              aria-pressed={interval === i}
              className={cn("flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-colors", interval === i ? "bg-[#0B1F3A] text-white" : "text-muted-foreground hover:text-foreground")}
            >
              {i === "year" ? "Annual" : "Monthly"}
              {i === "year" && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", interval === i ? "bg-[#D2B07A] text-[#0B1F3A]" : "bg-success-soft text-success")}>2 months free</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
        {PLANS.map((p) => (
          <div key={p.id} className={cn("relative flex flex-col rounded-3xl bg-card p-7 shadow-soft sm:p-9", p.highlight ? "border-2 border-primary" : "border border-border")}>
            {p.highlight && <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-primary-foreground">Most popular</span>}
            <div className="text-[18px] font-semibold">{p.name}</div>
            <p className="mt-1 text-[14px] text-muted-foreground">{p.tagline}</p>
            <div className="mt-6 flex items-end gap-2">
              <span className="font-serif text-[56px] leading-none tnum">{money(annual ? effectiveMonthly(p) : p.monthly)}</span>
              <span className="pb-2 text-[15px] text-muted-foreground">/ month</span>
            </div>
            <div className="mt-2 min-h-[40px] text-[13px] text-muted-foreground">
              {annual ? (
                <>
                  <div>Billed annually ({money(p.annual)}/yr)</div>
                  <div className="font-medium text-success">2 months free · save {money(annualSavings(p))} a year</div>
                </>
              ) : (
                <>
                  <div>Billed monthly</div>
                  <div>Or {money(effectiveMonthly(p))}/mo billed annually</div>
                </>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-[14px]"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}</li>
              ))}
            </ul>
            <Link
              href={`/signup?plan=${p.id}&billing=${interval}`}
              className={cn("mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-[15px] font-medium transition-colors", p.highlight ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "border border-border bg-card hover:bg-accent")}
            >
              Start your free trial <ArrowRight className="size-4" />
            </Link>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] text-muted-foreground">
        {TRIAL_DAYS}-day free trial with up to {TRIAL_VIDEOS} finished videos. A card is required to start; you won’t be charged until the trial ends, and you can cancel anytime before then.
      </p>
    </div>
  );
}
