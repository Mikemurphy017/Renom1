"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Row { label: string; value: number }

function Tip({ active, payload, format }: { active?: boolean; payload?: { payload: Row }[]; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="text-[11px] text-muted-foreground">{r.label}</div>
      <div className="font-serif text-lg tnum">{format(r.value)}</div>
    </div>
  );
}

/** Single-measure comparison across platforms — one hue, direct labels. */
export function PlatformBars({ data, format, height = 260 }: { data: Row[]; format: (n: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 8 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={104} />
        <Tooltip content={<Tip format={format} />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
          <LabelList dataKey="value" position="right" formatter={(v: unknown) => format(Number(v))} className="fill-foreground text-[11px]" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
