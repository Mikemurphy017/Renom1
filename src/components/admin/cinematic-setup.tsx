"use client";

import * as React from "react";
import { CircleCheck, KeyRound, LoaderCircle, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * The switch for cinematic videos: they're on for every Pro account once the
 * studio's Higgsfield API key is set. The key is checked before it's saved,
 * stored encrypted, and never shown again.
 */

interface Status {
  on: boolean;
  source: "environment" | "dashboard" | null;
  ends: string | null;
  canSave: boolean;
}

export function CinematicSetup({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [key, setKey] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "save" | "off">("");
  const [replacing, setReplacing] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/cinematic/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setStatus(j))
      .catch(() => {});
  }, []);

  const call = async (method: "POST" | "DELETE") => {
    setBusy(method === "POST" ? "save" : "off");
    try {
      const r = await fetch("/api/admin/cinematic/setup", { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ key }) : undefined });
      const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Status) | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "That didn’t work. Try again.");
      setStatus(j);
      setKey("");
      setReplacing(false);
      toast.success(method === "POST" ? "Cinematic videos are on" : "Cinematic videos are off", { description: method === "POST" ? "Pro advisors now get the option when they record." : undefined });
      onChange?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!status) return <div className="rounded-2xl border border-border bg-card p-5"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>;

  const form = (
    <form
      className="mt-4 flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) void call("POST");
      }}
    >
      <div className="min-w-[260px] flex-1">
        <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="key-id:key-secret" aria-label="Higgsfield API key" />
        <p className="mt-1.5 text-[12px] text-muted-foreground">From the Higgsfield console (console.higgsfield.ai → API keys). Both parts, joined by a colon. It’s checked with Higgsfield, stored encrypted, and never shown again.</p>
      </div>
      <Button type="submit" className="rounded-full" disabled={!key.trim() || !!busy}>{busy === "save" ? <LoaderCircle className="animate-spin" /> : <Power />} {status.on ? "Replace key" : "Switch on"}</Button>
      {replacing && <Button type="button" variant="ghost" className="rounded-full" onClick={() => { setReplacing(false); setKey(""); }}>Cancel</Button>}
    </form>
  );

  return (
    <section className={status.on ? "rounded-2xl border border-success/40 bg-success-soft/30 p-5" : "rounded-2xl border border-primary/40 bg-brass-soft/40 p-5"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            {status.on ? <CircleCheck className="size-4 text-success" /> : <KeyRound className="size-4 text-primary" />}
            {status.on ? "Cinematic videos are on" : "Cinematic videos are off"}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {status.on
              ? status.source === "environment"
                ? `Every Pro account can make them. The Higgsfield key (ending ${status.ends}) is set in the server’s settings (HF_CREDENTIALS), so it’s changed there, not here.`
                : `Every Pro account can make them. Higgsfield key ending ${status.ends}, saved here.`
              : "No Pro account can make them yet, including yours, because the studio has no Higgsfield API key. Add it here to switch them on for everyone on Pro."}
          </p>
        </div>
        {status.on && status.source === "dashboard" && !replacing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReplacing(true)} disabled={!!busy}>Replace key</Button>
            <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => window.confirm("Switch cinematic videos off for every account? Videos already made stay.") && void call("DELETE")} disabled={!!busy}>{busy === "off" ? <LoaderCircle className="animate-spin" /> : null} Switch off</Button>
          </div>
        )}
      </div>
      {!status.canSave && !status.on && <p className="mt-3 text-[13px] text-destructive">The key can’t be saved here until SECRETS_KEY is set on the server.</p>}
      {((!status.on && status.canSave) || replacing) && form}
    </section>
  );
}
