"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, PencilLine, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page";
import { relativeTime } from "@/lib/utils";
import { CredentialsCard, type Credentials } from "./client-setup";

interface Row {
  id: string;
  email: string;
  name: string;
  firm: string;
  admin: boolean;
  disabled?: boolean;
  lastSignInAt?: string;
  onboarded: boolean;
  videos: number;
}

/** Everyone who isn't an admin: set up their workspace, or hand them a new sign-in. */
export function ClientsList() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [creds, setCreds] = React.useState<Credentials | null>(null);

  React.useEffect(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRows((j.users as Row[]).filter((u) => !u.admin)))
      .catch(() => toast.error("Couldn’t load clients"));
  }, []);

  const newPassword = async (u: Row) => {
    if (!window.confirm(`Make a new temporary password for ${u.email}? Their current password stops working and they’re signed out.`)) return;
    setBusy(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password" }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "Couldn’t make a new password.");
      setCreds({ name: u.name, email: u.email, password: j.password, signInUrl: j.signInUrl });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Set up a client’s workspace for them and hand over their sign-in."
        actions={
          <Button asChild className="rounded-full">
            <Link href="/admin/clients/new"><UserPlus /> Set up a client</Link>
          </Button>
        }
      />
      {!rows ? (
        <div className="flex items-center gap-2 py-10 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading…</div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="font-serif text-xl">No clients yet</p>
          <p className="mt-1 text-[14px] text-muted-foreground">Set up your first client’s workspace, then copy their sign-in details to send them.</p>
          <Button asChild className="mt-5 rounded-full"><Link href="/admin/clients/new"><UserPlus /> Set up a client</Link></Button>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{u.name || u.email}{u.disabled && <span className="ml-2 text-[12px] font-normal text-destructive">Disabled</span>}</div>
                <div className="truncate text-[12px] text-muted-foreground">
                  {u.email}{u.firm ? ` · ${u.firm}` : ""} · {u.lastSignInAt ? `signed in ${relativeTime(u.lastSignInAt)}` : "hasn’t signed in yet"} · {u.videos} video{u.videos === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link href={`/admin/clients/${u.id}`}><PencilLine /> {u.onboarded ? "Edit workspace" : "Set up workspace"}</Link>
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full" disabled={busy === u.id} onClick={() => newPassword(u)}>
                  {busy === u.id ? <LoaderCircle className="animate-spin" /> : <KeyRound />} New password
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader><DialogTitle className="sr-only">New sign-in details</DialogTitle></DialogHeader>
          {creds && <CredentialsCard creds={creds} title="New password ready" onDone={() => setCreds(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
