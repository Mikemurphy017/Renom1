"use client";

import * as React from "react";
import { Check, CircleAlert, LoaderCircle, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page";
import type { SetupStatus } from "@/lib/billing/setup";
import { getPlan } from "@/lib/pricing";
import { cn } from "@/lib/utils";

function Row({ ok, title, detail }: { ok: boolean; title: string; detail: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-success text-white" : "bg-warning-soft text-destructive")}>{ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}</span>
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{title}</div>
        <div className="text-[12px] break-words text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

/** Checks the Stripe account and sets up what's missing, in one click. */
export function StripeSetup() {
  const [st, setSt] = React.useState<SetupStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [log, setLog] = React.useState<{ done: string[]; failed: string[] } | null>(null);
  const load = React.useCallback(async () => {
    const j = await fetch("/api/admin/stripe", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setSt(j.status);
    else toast.error("Couldn’t check Stripe");
  }, []);
  React.useEffect(() => void load(), [load]);

  const run = async () => {
    setBusy(true);
    try {
      const j = await fetch("/api/admin/stripe", { method: "POST" }).then((r) => r.json());
      setLog({ done: j.done ?? [], failed: j.failed ?? [] });
      if (j.status) setSt(j.status);
      if (j.failed?.length) toast.error("Some steps need attention");
      else toast.success("Stripe is set up");
    } catch {
      toast.error("Setup didn’t finish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const allOk = !!st && !st.error && st.links.every((l) => l.ok) && st.webhook.ok && st.portal.ok;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Billing setup"
        description={st?.account ? `Stripe account: ${st.account}${st.live ? " (live)" : " (test mode)"}` : "Payment links, webhook and customer portal."}
        actions={
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()} disabled={busy}>
            <RefreshCw /> Check again
          </Button>
        }
      />
      {!st ? (
        <div className="flex items-center gap-2 py-10 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Checking Stripe…</div>
      ) : st.error ? (
        <p className="rounded-xl border border-destructive/30 bg-warning-soft p-4 text-[14px]">{st.error}</p>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {st.links.map((l) => (
              <Row
                key={l.url}
                ok={l.ok}
                title={`${getPlan(l.plan)?.name} ${l.interval === "year" ? "(pay in full)" : "(monthly)"} payment link`}
                detail={!l.found ? `Not found in this Stripe account: ${l.url}` : `${l.priceText}${l.priceOk ? "" : " (doesn’t match the plan’s price)"} · trial ${l.trialDays ?? 0} days · card ${l.card === "always" ? "required" : "only if needed"} · ${l.redirect ? "returns to Renom" : "shows Stripe’s confirmation page"}`}
              />
            ))}
            <Row ok={st.webhook.ok} title="Webhook" detail={<>{st.webhook.detail} <span className="opacity-70">{st.webhook.url}</span></>} />
            <Row ok={st.portal.ok} title="Customer portal" detail={st.portal.detail} />
          </ul>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button className="rounded-full px-5" disabled={busy || allOk} onClick={run}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Wand2 />} {allOk ? "Everything’s set up" : "Set up Stripe"}
            </Button>
            {!allOk && <span className="text-[12px] text-muted-foreground">Sets the 7-day trial and card on each link, sends buyers back to Renom, creates the webhook and turns on the customer portal.</span>}
          </div>
          {log && (
            <div className="mt-5 space-y-1.5 rounded-xl border border-border bg-card p-4 text-[13px]">
              {log.done.map((d) => <div key={d} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {d}</div>)}
              {log.failed.map((d) => <div key={d} className="flex gap-2 text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {d}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
