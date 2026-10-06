"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Field, FormError, PasswordInput } from "./auth-form";

/** Step one: ask for the email and send the link. */
export function ForgotForm() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <AuthShell title="Check your email." subtitle={<>If there’s an account for <span className="text-foreground">{email}</span>, a link to choose a new password is on its way. It works once and expires in an hour.</>}>
        <div className="mt-8 space-y-3 text-[14px] text-muted-foreground">
          <p>Nothing after a few minutes? Check spam, or <button type="button" onClick={() => setSent(false)} className="cursor-pointer text-primary hover:underline">try again</button>.</p>
          <p><Link href="/signin" className="text-primary hover:underline">Back to sign in</Link></p>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your account’s email and we’ll send you a link to choose a new one.">
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus className="h-11" placeholder="you@firm.com" />
        </Field>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" size="lg" className="h-11 w-full rounded-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          Send reset link {!busy && <ArrowRight />}
        </Button>
      </form>
      <p className="mt-6 text-center text-[14px] text-muted-foreground">
        Remembered it? <Link href="/signin" className="text-primary hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

/** Step two: the link from the email lands here to set the new password. */
export function ResetForm() {
  const [token, setToken] = React.useState("");
  const [check, setCheck] = React.useState<"checking" | "ok" | "bad">("checking");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    // Keep the token out of the address bar (and history) once read.
    window.history.replaceState(null, "", "/reset");
    if (!t) return setCheck("bad");
    fetch(`/api/auth/reset?token=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setCheck(j.ok ? "ok" : "bad");
        if (j.email) setEmail(j.email);
      })
      .catch(() => setCheck("bad"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      setDone(true);
      setTimeout(() => (window.location.href = "/"), 1200);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (check === "checking")
    return (
      <AuthShell title="One moment…" subtitle="Checking your reset link.">
        <LoaderCircle className="mt-8 size-5 animate-spin text-muted-foreground" />
      </AuthShell>
    );
  if (check === "bad")
    return (
      <AuthShell title="This link has expired." subtitle="Reset links work once and only for an hour. Request a fresh one and use the newest email.">
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild size="lg" className="h-11 w-full rounded-full"><Link href="/forgot">Send a new link <ArrowRight /></Link></Button>
          <Link href="/signin" className="text-center text-[14px] text-primary hover:underline">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  if (done)
    return (
      <AuthShell title="Password updated." subtitle="You’re signed in. Opening your studio…">
        <CheckCircle2 className="mt-8 size-6 text-primary" />
      </AuthShell>
    );

  return (
    <AuthShell title="Choose a new password." subtitle={<>For <span className="text-foreground">{email}</span>. You’ll be signed out on every other device.</>}>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <Field label="New password" hint="At least 10 characters">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" minLength={10} autoFocus />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={10} />
        </Field>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" size="lg" className="h-11 w-full rounded-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          Save and sign in {!busy && <ArrowRight />}
        </Button>
      </form>
    </AuthShell>
  );
}
