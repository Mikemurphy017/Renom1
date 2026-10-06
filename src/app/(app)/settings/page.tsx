"use client";

import * as React from "react";
import { Check, CreditCard, Mail, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { PLATFORMS } from "@/lib/mock/platforms";
import { TEAM } from "@/lib/mock/advisor";
import { cn, sleep } from "@/lib/utils";

const ROLES = ["Advisor", "Assistant", "Compliance Reviewer"] as const;
const ROLE_DESC: Record<(typeof ROLES)[number], string> = {
  Advisor: "Full access. Owns the profile and publishes.",
  Assistant: "Drafts and edits videos. Can't publish or approve.",
  "Compliance Reviewer": "Reviews, comments and approves. Read-only elsewhere.",
};

export default function SettingsPage() {
  const [connected, setConnected] = React.useState<Record<string, boolean>>(Object.fromEntries(PLATFORMS.map((p) => [p.id, p.connected])));
  const [busy, setBusy] = React.useState<string | null>(null);
  const [team, setTeam] = React.useState(TEAM.map((t) => ({ ...t, role: t.role as string })));
  const [invite, setInvite] = React.useState("");
  const [tab, setTab] = React.useState("platforms");

  React.useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (["platforms", "team", "billing", "notifications"].includes(h)) setTab(h);
  }, []);

  const toggleConnect = async (id: string, label: string) => {
    setBusy(id);
    await sleep(900);
    setConnected((c) => ({ ...c, [id]: !c[id] }));
    setBusy(null);
    toast.success(connected[id] ? `${label} disconnected` : `${label} connected`);
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Settings" title="Workspace settings" description="Platforms, team, billing and notifications for Hale Wealth Partners." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line">
          <TabsTrigger value="platforms">Connected platforms</TabsTrigger>
          <TabsTrigger value="team">Team & roles</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="pt-3">
          <div className="grid gap-3 md:grid-cols-2" id="platforms">
            {PLATFORMS.map((p) => {
              const on = connected[p.id];
              return (
                <Card key={p.id} className="flex items-center gap-4 p-4" style={{ ["--pi-bg" as string]: "var(--muted)" }}>
                  <span className="flex size-10 items-center justify-center rounded-md bg-muted"><PlatformIcon id={p.id} className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      {p.label}
                      {on && <span className="inline-flex items-center gap-1 text-[11px] font-normal text-success"><span className="size-1.5 rounded-full bg-success" /> Connected</span>}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">{on ? `${p.handle ?? "Account linked"} · synced 12m ago` : `Preferred ${p.aspect} · not connected`}</div>
                  </div>
                  <Button size="sm" variant={on ? "outline" : "default"} disabled={busy === p.id} onClick={() => toggleConnect(p.id, p.label)}>
                    {busy === p.id ? "Working…" : on ? "Disconnect" : <><Plus /> Connect</>}
                  </Button>
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-[12px] text-muted-foreground">Connections are simulated in this preview — no accounts are contacted.</p>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 pt-3">
          <Card>
            <CardHeader>
              <div className="eyebrow">Members · {team.length} of 5 seats</div>
              <div className="flex w-full max-w-sm gap-2">
                <Input placeholder="name@firm.com" value={invite} onChange={(e) => setInvite(e.target.value)} className="h-8 text-[13px]" />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!/\S+@\S+/.test(invite)) return toast.error("Enter a valid email");
                    setTeam((t) => [...t, { id: invite, name: invite.split("@")[0], email: invite, role: "Assistant", initials: invite.slice(0, 2).toUpperCase(), owner: false }]);
                    toast.success("Invitation sent", { description: invite });
                    setInvite("");
                  }}
                >
                  <UserPlus /> Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {team.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-navy-foreground dark:bg-secondary">{m.initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium">{m.name}{"owner" in m && m.owner && <Badge variant="brass">Owner</Badge>}</div>
                    <div className="flex items-center gap-1 text-[12px] text-muted-foreground"><Mail className="size-3" /> {m.email}</div>
                  </div>
                  <Select value={m.role} disabled={"owner" in m && !!m.owner} onValueChange={(v) => { setTeam((t) => t.map((x) => (x.id === m.id ? { ...x, role: v } : x))); toast.success("Role updated"); }}>
                    <SelectTrigger size="sm" className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r} className="rounded-lg border border-border bg-card p-4">
                <div className="text-[13px] font-medium">{r}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">{ROLE_DESC[r]}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="pt-3">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card className="overflow-hidden">
              <div className="bg-navy p-6 text-navy-foreground dark:bg-secondary">
                <div className="text-[11px] tracking-[0.14em] text-[#D2B07A] uppercase">Current plan</div>
                <div className="mt-2 flex items-baseline gap-2"><span className="font-serif text-3xl">Practice</span><span className="text-sm opacity-70">annual</span></div>
                <div className="mt-1 font-serif text-xl tnum">$349<span className="font-sans text-sm opacity-70"> / month</span></div>
              </div>
              <CardContent className="space-y-4 pt-5">
                {[
                  ["Videos this month", 9, 20],
                  ["Professional edits", 1, 4],
                  ["Team seats", team.length, 5],
                ].map(([l, u, m]) => (
                  <div key={l as string}>
                    <div className="mb-1.5 flex justify-between text-[13px]"><span>{l}</span><span className="text-muted-foreground tnum">{u} / {m}</span></div>
                    <Progress value={((u as number) / (m as number)) * 100} />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => toast("Plans", { description: "Billing is mocked in this preview." })}>Change plan</Button>
                  <Button variant="ghost" size="sm" onClick={() => toast("Invoices", { description: "Billing is mocked in this preview." })}>View invoices</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><div className="eyebrow">Payment method</div></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-md border border-border p-3">
                  <CreditCard className="size-5 text-muted-foreground" />
                  <div className="flex-1 text-[13px]"><div className="font-medium tnum">Visa ending 4417</div><div className="text-[12px] text-muted-foreground tnum">Expires 08/28</div></div>
                  <Button size="xs" variant="ghost">Update</Button>
                </div>
                <div className="text-[12px] text-muted-foreground">Next invoice <span className="font-medium text-foreground tnum">$4,188.00</span> on Jan 14, 2027</div>
                <ul className="space-y-1.5 border-t border-border pt-4 text-[12px]">
                  {["Unlimited AI ideas, scripts and descriptions", "4 professional edits / month", "Compliance workflow & archive", "Up to 5 seats"].map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check className="size-3.5 text-success" />{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="pt-3">
          <Card className="max-w-3xl">
            <CardContent className="p-0">
              <div className="grid grid-cols-[1fr_80px_80px] border-b border-border px-5 py-3 text-[11px] tracking-[0.1em] text-muted-foreground uppercase"><span>Event</span><span className="text-center">Email</span><span className="text-center">In-app</span></div>
              {[
                ["Compliance decision on my video", true, true],
                ["New comment from reviewer", true, true],
                ["Scheduled post published", false, true],
                ["Inquiry attributed to content", true, true],
                ["Weekly performance digest", true, false],
                ["Professional edit delivered", true, true],
              ].map(([l, e, a]) => (
                <div key={l as string} className={cn("grid grid-cols-[1fr_80px_80px] items-center border-b border-border px-5 py-3.5 last:border-0")}>
                  <span className="text-[13px]">{l}</span>
                  <span className="flex justify-center"><Switch defaultChecked={e as boolean} onCheckedChange={() => toast.success("Saved")} /></span>
                  <span className="flex justify-center"><Switch defaultChecked={a as boolean} onCheckedChange={() => toast.success("Saved")} /></span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
