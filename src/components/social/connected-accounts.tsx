"use client";

import * as React from "react";
import { ExternalLink, LoaderCircle, Plug, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { BUFFER_CHANNELS_URL, PLATFORM_OF, SERVICE_LABEL, connectBuffer, disconnectBuffer, useSocialStatus } from "@/lib/social/use-social";
import { cn } from "@/lib/utils";

/** The advisor's own Buffer: connect it, see its channels, disconnect. Only ever their own. */
export function ConnectedAccounts({ back = "/settings#publishing" }: { back?: string }) {
  const { status, error, refresh } = useSocialStatus();
  const [busy, setBusy] = React.useState<string | null>(null);

  // Back from Buffer's consent screen: say how it went.
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("buffer");
    if (!r) return;
    if (r === "connected") toast.success("Buffer connected", { description: "Your channels are listed below." });
    else
      toast.error(
        r === "denied" ? "Buffer wasn’t connected: access wasn’t approved."
        : r === "studio" ? "That’s the studio’s Buffer. Sign in to Buffer with your own account and connect again."
        : r === "unavailable" ? "Connecting Buffer isn’t switched on for this studio yet."
        : "Couldn’t connect Buffer. Try again."
      );
    q.delete("buffer");
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}${window.location.hash}`);
  }, []);

  const remove = async () => {
    if (!window.confirm("Disconnect your Buffer from Renom? Posts already scheduled in Buffer still go out; cancel them in Buffer if you need to.")) return;
    setBusy("disconnect");
    try {
      await disconnectBuffer();
      toast.success("Buffer disconnected");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!status) return <LoaderCircle className="size-5 animate-spin text-muted-foreground" />;
  if (!status.available) return <p className="text-[13px] text-muted-foreground">Posting from your own accounts isn’t switched on for this studio yet. Your administrator can turn it on.</p>;

  if (!status.connected) {
    return (
      <div className="space-y-4">
        <ol className="space-y-2 text-[13px] text-muted-foreground">
          <li><span className="font-medium text-foreground">1.</span> Have a Buffer account with your social accounts connected (LinkedIn, YouTube, Instagram and so on). <a href="https://buffer.com" target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">Buffer’s free plan</a> covers three.</li>
          <li><span className="font-medium text-foreground">2.</span> Click Connect Buffer and approve Renom on Buffer’s page.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button className="rounded-full" onClick={() => { setBusy("connect"); connectBuffer(back); }} disabled={!!busy}>
            {busy === "connect" ? <LoaderCircle className="animate-spin" /> : <Plug />} Connect Buffer
          </Button>
          <span className="text-[12px] text-muted-foreground">Only you see your channels. We never see your passwords.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Connected to <span className="font-medium text-foreground">{status.organization}</span>{status.email ? ` (${status.email})` : ""}.
      </p>
      {status.error && <p className="flex items-center gap-1.5 text-[13px] text-destructive"><TriangleAlert className="size-4" /> {status.error}</p>}
      {status.channels.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {status.channels.map((c) => {
            const p = PLATFORM_OF[c.service];
            return (
              <li key={c.id} className={cn("flex min-h-[52px] items-center gap-3 rounded-xl border px-3 py-2", c.disconnected ? "border-destructive/40" : "border-success/40 bg-success-soft/40")} style={{ ["--pi-bg" as string]: "var(--card)" }}>
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar} alt="" className="size-8 shrink-0 rounded-full" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">{p ? <PlatformIcon id={p} className="size-4" /> : null}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">{p && <PlatformIcon id={p} className="size-3.5" />}{SERVICE_LABEL[c.service] ?? c.service}</div>
                  <div className={cn("truncate text-[12px]", c.disconnected ? "text-destructive" : "text-muted-foreground")}>{c.disconnected ? "Needs reconnecting in Buffer" : c.name}</div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No channels in your Buffer yet. Add your social accounts in Buffer, then come back.</p>
      )}
      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-full" asChild>
          <a href={BUFFER_CHANNELS_URL} target="_blank" rel="noreferrer"><ExternalLink /> Add or manage channels in Buffer</a>
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void refresh(true)}><RefreshCw /> Refresh</Button>
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => void remove()} disabled={!!busy}>
          {busy === "disconnect" ? <LoaderCircle className="animate-spin" /> : null} Disconnect
        </Button>
      </div>
    </div>
  );
}
