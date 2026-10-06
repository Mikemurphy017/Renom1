"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { BRAND } from "@/lib/brand";

type Policy = { open: boolean; needsCode: boolean };

/** The calm, centered frame every account page shares. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mx-auto flex w-full max-w-5xl items-center py-6">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-16">
        <h1 className="font-serif text-[36px] leading-tight tracking-tight">{title}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
        {children}
      </main>
    </div>
  );
}

export function PasswordInput({ value, onChange, autoComplete, minLength, autoFocus }: { value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number; autoFocus?: boolean }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={minLength} autoFocus={autoFocus} className="h-11 pr-11" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-destructive" role="alert">{children}</p>;
}

/** Sign in and create account share one calm, centered form. */
export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [invite, setInvite] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [policy, setPolicy] = React.useState<Policy | null>(null);
  const [resetByEmail, setResetByEmail] = React.useState(true);
  const [linkInvite, setLinkInvite] = React.useState(false);

  React.useEffect(() => {
    // An invite link (/signup?invite=…) fills in the code.
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code) {
      setInvite(code);
      setLinkInvite(true);
    }
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setPolicy(j.signup as Policy);
        setResetByEmail(j.resetByEmail !== false);
      })
      .catch(() => setPolicy({ open: true, needsCode: false }));
  }, []);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { email, password, name, invite } : { email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Something went wrong. Please try again.");
      // Full load so the studio opens with this account's data.
      window.location.href = mode === "signup" ? "/welcome" : next();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const signup = mode === "signup";
  const closed = signup && policy && !policy.open && !linkInvite;

  return (
    <AuthShell title={signup ? "Create your studio." : "Welcome back."} subtitle={signup ? `Free during early access. Your ${BRAND.name} studio, saved to your account and ready on any device.` : `Sign in to your ${BRAND.name} studio.`}>

        {closed ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-[14px] text-muted-foreground">
            New accounts are by invitation. Ask your administrator to set an invite code, then come back here.
            <div className="mt-4"><Link href="/signin" className="text-primary hover:underline">Back to sign in</Link></div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {signup && (
              <Field label="Your name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className="h-11" placeholder="Jane Doe" />
              </Field>
            )}
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus={!signup} className="h-11" placeholder="you@firm.com" />
            </Field>
            <Field label="Password" hint={signup ? "At least 10 characters" : undefined} aside={!signup && resetByEmail ? <Link href="/forgot" className="text-primary hover:underline">Forgot password?</Link> : undefined}>
              <PasswordInput value={password} onChange={setPassword} autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 10 : undefined} />
            </Field>
            {signup && policy?.needsCode && !linkInvite && (
              <Field label="Invite code">
                <Input value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" required className="h-11" />
              </Field>
            )}
            {signup && linkInvite && <p className="text-[13px] text-muted-foreground">You’re joining with an invite.</p>}
            {error && <FormError>{error}</FormError>}
            <Button type="submit" size="lg" className="h-11 w-full rounded-full" disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : null}
              {signup ? "Create account" : "Sign in"} {!busy && <ArrowRight />}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-[14px] text-muted-foreground">
          {signup ? (
            <>Already have an account? <Link href="/signin" className="text-primary hover:underline">Sign in</Link></>
          ) : policy?.open ? (
            <>New here? <Link href="/signup" className="text-primary hover:underline">Create an account</Link></>
          ) : resetByEmail ? null : (
            <>Forgot your password? Ask your administrator for a reset link.</>
          )}
        </p>
    </AuthShell>
  );
}

export function Field({ label, hint, aside, children }: { label: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="block">
      <label className="block">
        <span className="mb-1.5 flex justify-between text-[13px] font-medium">
          {label}
          {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
        </span>
        {children}
      </label>
      {aside && <div className="mt-1.5 text-right text-[13px]">{aside}</div>}
    </div>
  );
}
