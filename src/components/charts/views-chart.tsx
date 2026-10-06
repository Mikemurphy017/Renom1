"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtNumber } from "@/lib/utils";

interface Point { date: string; views: number }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-[11px] text-muted-foreground">
        {new Date(label + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
      <div className="mt-0.5 font-serif text-lg tnum">{fmtNumber(payload[0].value)} <span className="font-sans text-xs text-muted-foreground">views</span></div>
    </div>
  );
}

export function ViewsChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="0" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={36}
          tickFormatter={(d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmtCompact(v)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="views"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#viewsFill)"
          activeDot={{ r: 4.5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--chart-2)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
