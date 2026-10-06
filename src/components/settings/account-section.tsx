"use client";

import * as React from "react";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

/** Who's signed in, change password, sign out. */
export function AccountSection() {
  const { account, signOut, saveState } = useStore();
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, next }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Couldn’t change the password.");
      toast.success("Password changed");
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{account?.email ?? "Not signed in"}</div>
          <div className="text-[12px] text-muted-foreground">
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn’t save the last change. Check your connection." : "Everything is saved to your account."}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}><KeyRound /> Change password</Button>
          <Button variant="outline" size="sm" onClick={() => void signOut()}><LogOut /> Sign out</Button>
        </div>
      </div>
      {open && (
        <form onSubmit={change} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-[13px] font-medium">
            Current password
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className="mt-1.5" />
          </label>
          <label className="block text-[13px] font-medium">
            New password
            <Input type="password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required className="mt-1.5" />
          </label>
          <Button type="submit" disabled={busy}>Save</Button>
        </form>
      )}
    </div>
  );
}
