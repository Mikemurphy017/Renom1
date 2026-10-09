"use client";

import * as React from "react";
import { Link2, LoaderCircle, Plug, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { NETWORKS, NETWORK_LABEL, PLATFORM_OF, disconnect, openConnect, useSocialStatus } from "@/lib/social/use-social";
import { cn } from "@/lib/utils";

/** The advisor's own social accounts: connect, see what's connected, disconnect. */
export function ConnectedAccounts({ back = "/settings#publishing" }: { back?: string }) {
  const { status, error, refresh } = useSocialStatus();
  const [busy, setBusy] = React.useState<string | null>(null);

  const connect = async () => {
    setBusy("connect");
    try {
      await openConnect(back);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };
  const remove = async (network: string) => {
    if (!window.confirm(`Disconnect ${NETWORK_LABEL[network] ?? network}? Scheduled posts to it won’t go out.`)) return;
    setBusy(network);
    try {
      await disconnect(network);
      toast.success(`${NETWORK_LABEL[network] ?? network} disconnected`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!status) return <LoaderCircle className="size-5 animate-spin text-muted-foreground" />;
  if (!status.configured) {
    return <p className="text-[13px] text-muted-foreground">Connecting your own accounts isn’t switched on for this studio yet. Your administrator can turn it on.</p>;
  }
  const connected = new Map(status.accounts.map((a) => [a.network, a]));
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {NETWORKS.filter((n) => !status.unavailable.includes(n) || connected.has(n)).map((n) => {
          const a = connected.get(n);
          const p = PLATFORM_OF[n];
          return (
            <li key={n} className={cn("flex min-h-[52px] items-center gap-3 rounded-xl border px-3 py-2", a ? "border-success/40 bg-success-soft/40" : "border-border")} style={{ ["--pi-bg" as string]: "var(--card)" }}>
              {a?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar} alt="" className="size-8 shrink-0 rounded-full" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">{p ? <PlatformIcon id={p} className="size-4" /> : null}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">{p && a?.avatar && <PlatformIcon id={p} className="size-3.5" />}{NETWORK_LABEL[n] ?? n}</div>
                <div className="truncate text-[12px] text-muted-foreground">{a ? a.name : "Not connected"}</div>
              </div>
              {a && (
                <button onClick={() => void remove(n)} disabled={!!busy} className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Disconnect ${NETWORK_LABEL[n] ?? n}`}>
                  {busy === n ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {/* Accounts connected on networks we don't post videos to still show. */}
      {status.accounts.filter((a) => !NETWORKS.includes(a.network)).length > 0 && (
        <p className="text-[12px] text-muted-foreground">Also connected: {status.accounts.filter((a) => !NETWORKS.includes(a.network)).map((a) => NETWORK_LABEL[a.network] ?? a.network).join(", ")}.</p>
      )}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button className="rounded-full" onClick={() => void connect()} disabled={!!busy}>
          {busy === "connect" ? <LoaderCircle className="animate-spin" /> : status.accounts.length ? <Link2 /> : <Plug />} {status.accounts.length ? "Connect or manage accounts" : "Connect your accounts"}
        </Button>
        <span className="text-[12px] text-muted-foreground">You sign in to each network on a secure page. We never see your passwords.</span>
      </div>
    </div>
  );
}
