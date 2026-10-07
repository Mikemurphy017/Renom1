"use client";

import * as React from "react";
import { Ban, Check, CircleAlert, KeyRound, LoaderCircle, LogOut, Mail, MoreHorizontal, RefreshCw, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, SectionLabel } from "@/components/shared/page";
import { CopyButton } from "@/components/studio/steps/share-kit";
import { useStore } from "@/lib/store";
import { cn, fmtDate, relativeTime } from "@/lib/utils";

interface Row {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt?: string;
  disabled?: boolean;
  admin: boolean;
  you: boolean;
  firm: string;
  onboarded: boolean;
  videos: number;
  published: number;
  lastActiveAt: string | null;
}
interface InviteRow {
  id: string;
  email?: string;
  note?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedBy?: string;
  status: "open" | "used" | "expired" | "revoked";
}
interface Service {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}
interface Data {
  users: Row[];
  invites: InviteRow[];
  services: Service[];
  settings: { openSignup: boolean };
  envInviteCode: boolean;
}

async function call<T = Record<string, unknown>>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) throw new Error(body.error || "That didn’t work. Please try again.");
  return body as T;
}

const when = (iso?: string | null) => (iso ? relativeTime(iso) : "Never");

export function AdminDashboard() {
  const { account, signOut } = useStore();
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [link, setLink] = React.useState<{ title: string; description: string; url: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(await call<Data>("/api/admin"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => void load(), [load]);

  const act = async (u: Row, action: "reset" | "disable" | "enable" | "signout" | "delete") => {
    const confirmText: Partial<Record<typeof action, string>> = {
      disable: `Disable ${u.email}? They’re signed out now and can’t sign in until you enable the account again.`,
      signout: u.you ? "Sign out on every device, including this one?" : `Sign ${u.email} out on every device?`,
      delete: `Delete ${u.email} and their saved studio? This can’t be undone.`,
    };
    if (confirmText[action] && !window.confirm(confirmText[action])) return;
    try {
      const r = await call<{ emailed?: boolean; link?: string; self?: boolean }>(`/api/admin/users/${u.id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "reset" && r.link) {
        setLink({
          title: r.emailed ? "Reset link sent" : "Reset link ready",
          description: r.emailed ? `We emailed ${u.email} a link to choose a new password. You can also send them this link yourself. It works once, for 24 hours.` : `Email isn’t set up, so send ${u.email} this link yourself. It works once, for 24 hours.`,
          url: r.link,
        });
      } else toast.success({ disable: "Account disabled", enable: "Account enabled", signout: "Signed out everywhere", delete: "Account deleted", reset: "" }[action]);
      if (action === "signout" && r.self) return void signOut();
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const active = data?.users.filter((u) => !u.disabled).length ?? 0;
  const videos = data?.users.reduce((n, u) => n + u.videos, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Accounts & health"
        description={`Only ${account?.email ?? "admins"} can see this page.`}
        actions={
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      {error && <p className="mt-6 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-destructive">{error}</p>}
      {!data && !error && <LoaderCircle className="mt-10 size-5 animate-spin text-muted-foreground" />}

      {data && (
        <div className="mt-8 space-y-12">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Accounts" value={data.users.length} />
            <Stat label="Active" value={active} />
            <Stat label="Videos" value={videos} />
          </div>

          <section>
            <SectionLabel>Accounts</SectionLabel>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {data.users.map((u) => (
                <div key={u.id} className={cn("flex items-start gap-3 p-4", u.disabled && "opacity-60")}>
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-serif text-[13px]">
                    {(u.name || u.email).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[14px] font-medium">{u.name}</span>
                      {u.you && <Badge variant="navy">You</Badge>}
                      {u.admin && <Badge variant="brass"><ShieldCheck className="size-3" /> Admin</Badge>}
                      {u.disabled && <Badge variant="danger">Disabled</Badge>}
                      {!u.onboarded && !u.disabled && <Badge variant="outline">Not set up</Badge>}
                    </div>
                    <div className="truncate text-[13px] text-muted-foreground">{u.email || "Details fill in at next sign-in"}{u.firm ? ` · ${u.firm}` : ""}</div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                      <span>{u.videos} video{u.videos === 1 ? "" : "s"}{u.published ? ` (${u.published} out)` : ""}</span>
                      <span>Signed in {when(u.lastSignInAt)}</span>
                      <span>Active {when(u.lastActiveAt)}</span>
                      {u.createdAt && <span>Joined {fmtDate(u.createdAt, { month: "short", day: "numeric", year: "numeric" })}</span>}
                    </div>
                  </div>
                  {u.email && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" aria-label={`Actions for ${u.email}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => void act(u, "reset")} disabled={u.disabled}><KeyRound /> Send password reset</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void act(u, "signout")}><LogOut /> Sign out everywhere</DropdownMenuItem>
                        {!u.you && (
                          <>
                            <DropdownMenuSeparator />
                            {u.disabled ? (
                              <DropdownMenuItem onSelect={() => void act(u, "enable")}><Check /> Enable account</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => void act(u, "disable")}><Ban /> Disable account</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void act(u, "delete")}><Trash2 /> Delete account</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </section>

          <Invites data={data} reload={load} onLink={setLink} />

          <section>
            <SectionLabel action={<TestEmail disabled={!data.services.find((s) => s.id === "email")?.ok} />}>Services</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.services.map((s) => (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
                  <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", s.ok ? "bg-primary/15 text-primary" : "bg-warning-soft text-destructive")}>
                    {s.ok ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{s.label}</div>
                    <div className="text-[12px] text-muted-foreground">{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <Dialog open={!!link} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{link?.title}</DialogTitle>
            <DialogDescription>{link?.description}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={link?.url ?? ""} onFocus={(e) => e.currentTarget.select()} className="h-10 font-mono text-[12px]" />
            {link && <CopyButton text={link.url} label="Link" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-serif text-[28px] leading-none tnum">{value}</div>
    </div>
  );
}

function Invites({ data, reload, onLink }: { data: Data; reload: () => Promise<void>; onLink: (l: { title: string; description: string; url: string }) => void }) {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call<{ link: string; emailed: boolean }>("/api/admin/invites", { method: "POST", body: JSON.stringify({ email }) });
      onLink({
        title: r.emailed ? "Invite sent" : "Invite ready",
        description: r.emailed ? `We emailed ${email} their invite. You can also share this link yourself. It works once, for 14 days.` : `Share this link with ${email || "the new advisor"}. It works once, for 14 days${email ? ", and only for that email" : ""}.`,
        url: r.link,
      });
      setEmail("");
      void reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await call(`/api/admin/invites?id=${id}`, { method: "DELETE" });
      toast.success("Invite revoked");
      void reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const [open, setOpen] = React.useState(data.settings.openSignup);
  React.useEffect(() => setOpen(data.settings.openSignup), [data.settings.openSignup]);
  const toggleOpen = async (v: boolean) => {
    setOpen(v);
    try {
      await call("/api/admin/settings", { method: "POST", body: JSON.stringify({ openSignup: v }) });
      toast.success(v ? "Anyone can sign up" : "Sign-ups are by invite only");
    } catch (err) {
      setOpen(!v);
      toast.error((err as Error).message);
    }
  };

  const shown = data.invites.slice(0, 12);
  return (
    <section>
      <SectionLabel>Sign-ups & invites</SectionLabel>
      <label className="mb-5 flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4">
        <span>
          <span className="block text-[14px] font-medium">Anyone can sign up</span>
          <span className="block text-[12px] text-muted-foreground">{open ? "Visitors from the landing page can create an account. Turn off to make sign-ups invite only." : "Only people with an invite can create an account."}</span>
        </span>
        <Switch checked={open} onCheckedChange={(v) => void toggleOpen(v)} aria-label="Anyone can sign up" />
      </label>
      <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="advisor@firm.com (optional)" className="h-10 sm:max-w-xs" />
        <Button type="submit" className="h-10 rounded-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : email ? <Mail /> : <UserPlus />} {email ? "Send invite" : "Create invite link"}
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Each invite works once. With an email it’s locked to that address{data.envInviteCode ? ". The shared INVITE_CODE also still works." : "."}
      </p>
      {shown.length > 0 && (
        <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((i) => (
            <div key={i.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
              <div className="min-w-0 flex-1">
                <div className="truncate">{i.email || "Anyone with the link"}</div>
                <div className="text-[12px] text-muted-foreground">
                  {i.status === "used" ? `Used by ${i.usedBy} ${when(i.usedAt)}` : i.status === "open" ? `Expires ${fmtDate(i.expiresAt)}` : i.status === "expired" ? `Expired ${fmtDate(i.expiresAt)}` : "Revoked"}
                </div>
              </div>
              <Badge variant={i.status === "open" ? "success" : "outline"} className="capitalize">{i.status}</Badge>
              {i.status === "open" && (
                <Button variant="ghost" size="icon" className="size-8 rounded-full" aria-label="Revoke invite" onClick={() => void revoke(i.id)}><X /></Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TestEmail({ disabled }: { disabled: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await call("/api/admin/test-email", { method: "POST" });
      toast.success("Test email sent", { description: "Check your inbox." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" className="h-7 rounded-full text-[12px]" onClick={() => void send()} disabled={disabled || busy}>
      {busy ? <LoaderCircle className="animate-spin" /> : <Mail />} Send test email
    </Button>
  );
}
