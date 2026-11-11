"use client";

import * as React from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { CinematicSetup } from "./cinematic-setup";

/** What cinematic videos cost per advisor and per video, against the Pro plan's price. */

interface VideoRow {
  id: string;
  createdAt: string;
  status: string;
  script: string;
  setting: string;
  stills: number;
  usd: number;
  unpriced: boolean;
  adminError?: string;
  models: string[];
  requestIds: string[];
}
interface Advisor {
  userId: string;
  email: string;
  name: string;
  videos: VideoRow[];
}
interface Data {
  configured: boolean;
  models: { image: string; video: string };
  proMonthly: number;
  advisors: Advisor[];
}

const usd = (n: number) => `$${n.toFixed(2)}`;

export function CinematicUsage() {
  const [data, setData] = React.useState<Data | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const load = React.useCallback(() => {
    fetch("/api/admin/cinematic", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j.ok && setData(j))
      .catch(() => {});
  }, []);
  React.useEffect(load, [load]);
  if (!data) return <LoaderCircle className="size-5 animate-spin text-muted-foreground" />;

  const month = new Date().toISOString().slice(0, 7);
  const rows = data.advisors
    .map((a) => {
      const mine = a.videos.filter((v) => v.createdAt.startsWith(month));
      const cost = mine.reduce((s, v) => s + v.usd, 0);
      const done = mine.filter((v) => v.status === "ready").length;
      return { ...a, mine, cost, done, margin: data.proMonthly - cost };
    })
    .sort((x, y) => y.cost - x.cost);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const finished = rows.reduce((s, r) => s + r.done, 0);
  const errors = data.advisors
    .flatMap((a) => a.videos.filter((v) => v.adminError).map((v) => ({ ...v, email: a.email })))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .slice(0, 12);
  const cards: [string, string][] = [
    ["Cost this month", usd(total)],
    ["Videos finished", String(finished)],
    ["Average per finished video", finished ? usd(total / finished) : "—"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-[30px] leading-tight">Cinematic usage</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          This month’s generation cost per advisor against the Pro price of {usd(data.proMonthly)}. Costs are Higgsfield’s own estimates at the time each request was made; failed and moderated requests aren’t charged.
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Still: <code>{data.models.image}</code> · Video: <code>{data.models.video}</code>
        </p>
      </div>

      <CinematicSetup onChange={load} />

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="text-[13px] text-muted-foreground">{l}</div>
            <div className="mt-1 font-serif text-[30px] leading-tight tnum">{v}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Advisor</th>
              <th className="px-4 py-2.5 font-medium">Videos</th>
              <th className="px-4 py-2.5 font-medium">Cost</th>
              <th className="px-4 py-2.5 font-medium">Per video</th>
              <th className="px-4 py-2.5 font-medium">Margin on {usd(data.proMonthly)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No cinematic videos yet.</td>
              </tr>
            )}
            {rows.map((r) => (
              <React.Fragment key={r.userId}>
                <tr className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40" onClick={() => setOpen(open === r.userId ? null : r.userId)}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.name || r.email}</div>
                    <div className="text-[12px] text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-2.5 tnum">{r.done} finished · {r.mine.length} started</td>
                  <td className="px-4 py-2.5 tnum">{usd(r.cost)}</td>
                  <td className="px-4 py-2.5 tnum">{r.done ? usd(r.cost / r.done) : "—"}</td>
                  <td className={cn("px-4 py-2.5 font-medium tnum", r.margin < 0 ? "text-destructive" : r.margin < data.proMonthly * 0.5 ? "text-[#7d6238] dark:text-primary" : "text-success")}>
                    {usd(r.margin)} <span className="font-normal text-muted-foreground">({Math.round((r.margin / data.proMonthly) * 100)}%)</span>
                  </td>
                </tr>
                {open === r.userId &&
                  r.videos.map((v) => (
                    <tr key={v.id} className="border-b border-border bg-muted/30 text-[12px]">
                      <td className="px-4 py-2 pl-8" colSpan={2}>
                        <div className="line-clamp-1">“{v.script}”</div>
                        <div className="text-muted-foreground">{v.setting} · {v.status} · {relativeTime(v.createdAt)} · {v.stills} {v.stills === 1 ? "still" : "stills"}</div>
                      </td>
                      <td className="px-4 py-2 tnum">
                        {usd(v.usd)}
                        {v.unpriced && <span className="text-muted-foreground"> +?</span>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground" colSpan={2}>
                        <div className="line-clamp-1 font-mono text-[11px]">{v.requestIds.join(", ") || "no requests"}</div>
                        {v.adminError && <div className="text-destructive">{v.adminError}</div>}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><TriangleAlert className="size-4 text-destructive" /> Recent failures</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-[13px]">
            {errors.map((e) => (
              <li key={e.id} className="px-4 py-2.5">
                <span className="font-medium">{e.email}</span> <span className="text-muted-foreground">· {relativeTime(e.createdAt)}</span>
                <div className="text-destructive">{e.adminError}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
