"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Captions, FileText, Lightbulb, MonitorPlay, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The two interactive parts of the sales page: the "one flow" step tabs and
 * the pays-for-itself calculator.
 */

const FLOW = [
  {
    id: "ideas",
    label: "Ideas",
    icon: Lightbulb,
    title: "Never run out of video ideas.",
    body: "Topics drawn from what your clients actually ask about, matched to who you serve. Roth conversions for pre-retirees, equity comp for tech employees, selling the practice for business owners.",
    points: ["Fresh ideas whenever you need them", "Built around your specialty and audience", "Short form or long form"],
  },
  {
    id: "scripts",
    label: "Scripts",
    icon: FileText,
    title: "Four finished scripts. Pick the one that sounds like you.",
    body: "Every idea comes back as four complete drafts, each told a different way: a story, an insight, a plain case, a reframe. Narrative scripts with a beginning, middle and end, written to be spoken.",
    points: ["Written in your voice", "Edit any line, or ask for a new take", "60 to 90 seconds for short form"],
  },
  {
    id: "record",
    label: "Record",
    icon: MonitorPlay,
    title: "A teleprompter right beside the lens.",
    body: "Record in your browser on a laptop or phone. The script scrolls at your pace; tap to pause, adjust speed and size, and just say a line again if you fluff it.",
    points: ["No app to install", "Countdown, mirror mode, portrait on phones", "Every take saved to your studio"],
  },
  {
    id: "edit",
    label: "Edit",
    icon: Captions,
    title: "Edited for you, in the style you choose.",
    body: "Pauses and retakes cut. Captions timed to every word. Pick a style like Impact or Ignite and get punch-in zooms, keyword cards, b-roll, music and sound on the moments that matter.",
    points: ["Captions that follow your voice", "Edit styles with b-roll and music", "Review, tweak and re-render"],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: ShieldCheck,
    title: "Guardrails for a regulated business.",
    body: "Your disclosure goes on every post. Turn on an approval step and each video waits for your reviewer before it can go out. Everything you publish is archived.",
    points: ["Disclosures added automatically", "Optional reviewer approval", "Archive of every post"],
  },
  {
    id: "post",
    label: "Post",
    icon: Send,
    title: "We post it for you. Or you do.",
    body: "A cover thumbnail, the post copy and hashtags, written and designed. Hand it to our team and we post it to your accounts, or download the MP4 and copy the post with one tap.",
    points: ["LinkedIn, Instagram, Facebook, YouTube, TikTok, X", "Our team schedules it for you", "MP4 download if you'd rather post it yourself"],
  },
] as const;

function FlowVisual({ id }: { id: (typeof FLOW)[number]["id"] }) {
  const card = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";
  if (id === "ideas")
    return (
      <div className="space-y-2.5">
        {["The Roth window most retirees miss", "What to do the year before you sell the business", "Your RSUs vest in March. Now what?", "Why your 401(k) isn’t on autopilot"].map((t, i) => (
          <div key={t} className={cn(card, "flex items-center gap-3", i === 0 && "border-[#D2B07A]/60 bg-[#D2B07A]/10")}>
            <Lightbulb className="size-4 shrink-0 text-[#D2B07A]" />
            <span className="text-[14px] text-white">{t}</span>
          </div>
        ))}
      </div>
    );
  if (id === "scripts")
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[
          ["The Story", "A surgeon I’ll call David sat across from me with a spreadsheet he’d built himself…"],
          ["The Insight", "“I’ll deal with taxes when I retire.” That’s the sentence that costs the most…"],
          ["The Case", "There is a window, usually a few years long, when your tax bracket is lower than it will ever be again…"],
          ["The Frame", "The safest-looking move in retirement planning is often where the risk lives…"],
        ].map(([l, t], i) => (
          <div key={l} className={cn(card, i === 0 && "border-[#D2B07A]/60 bg-[#D2B07A]/10")}>
            <div className="text-[10px] font-semibold tracking-[0.14em] text-[#D2B07A] uppercase">{l}</div>
            <p className="mt-2 font-serif text-[13px] leading-snug text-white/90">{t}</p>
          </div>
        ))}
      </div>
    );
  if (id === "record")
    return (
      <div className={cn(card, "relative aspect-video overflow-hidden p-0")}>
        <div className="absolute inset-0 bg-[linear-gradient(160deg,#1d3a63,#081629)]" />
        <div className="absolute inset-x-0 top-0 bg-black/55 px-5 py-4 text-center font-serif text-[15px] leading-relaxed text-white/50 sm:text-[17px]">
          <span className="text-white">There’s a window, usually a few years long,</span> when your tax bracket is lower than it will ever be again.
        </div>
        <div className="absolute bottom-0 left-1/2 h-[55%] w-[34%] -translate-x-1/2">
          <div className="absolute top-0 left-1/2 size-[42%] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#d9c3a0,#b99a72)]" />
          <div className="absolute bottom-0 h-[60%] w-full rounded-t-[48%] bg-[#22385a]" />
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
          <span className="size-2 animate-pulse rounded-full bg-red-500" /> 0:42
        </div>
      </div>
    );
  if (id === "edit")
    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ["Impact", "#3CF2B4", "font-[Anton] tracking-wide"],
            ["Ignite", "#FF2D2D", "font-black"],
            ["Focus", "#FFFFFF", "font-extrabold"],
          ].map(([n, c, f], i) => (
            <div key={n} className={cn(card, "flex aspect-[4/5] flex-col justify-between bg-[linear-gradient(170deg,#1d3a63,#081629)] p-3", i === 0 && "ring-2 ring-[#D2B07A]")}>
              <span className="text-[11px] text-white/70">{n}</span>
              <span className={cn("text-center text-[15px] text-white uppercase", f)}>
                the <span style={{ color: c }}>window</span>
              </span>
            </div>
          ))}
        </div>
        <div className={cn(card, "flex flex-wrap gap-2 text-[12px] text-white/80")}>
          {["Captions", "Punch-ins", "Keyword cards", "B-roll", "Music", "Sound"].map((x) => (
            <span key={x} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><Check className="size-3 text-[#D2B07A]" />{x}</span>
          ))}
        </div>
      </div>
    );
  if (id === "compliance")
    return (
      <div className="space-y-2.5">
        <div className={card}>
          <div className="text-[11px] tracking-[0.14em] text-white/50 uppercase">Disclosure</div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/80">Advisory services offered through your firm. This content is for informational purposes only and is not individualized advice.</p>
        </div>
        {[
          ["The Roth window most retirees miss", "Approved"],
          ["Your RSUs vest in March. Now what?", "Waiting for review"],
        ].map(([t, s]) => (
          <div key={t} className={cn(card, "flex items-center justify-between gap-3")}>
            <span className="text-[13px] text-white">{t}</span>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px]", s === "Approved" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/70")}>{s}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div className={cn(card, "space-y-3")}>
      <div className="flex gap-3">
        <div className="aspect-[9/16] w-20 shrink-0 rounded-lg bg-[linear-gradient(170deg,#1d3a63,#081629)] p-1.5 text-center font-[Anton] text-[10px] leading-tight text-[#3CF2B4]">ROTH WINDOW</div>
        <p className="text-[13px] leading-relaxed text-white/80">Most people think the Roth conversion question is “if.” It’s really “when,” and the best years are often the ones right before required distributions start…</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["LinkedIn", "Instagram", "YouTube", "Facebook"].map((p) => (
          <span key={p} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">{p}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="flex-1 rounded-full bg-[#D2B07A] py-2 text-center text-[12px] font-medium text-[#0B1F3A]">Send to our team</span>
        <span className="flex-1 rounded-full border border-white/20 py-2 text-center text-[12px] text-white">Download MP4</span>
      </div>
    </div>
  );
}

export function FlowTabs() {
  const [active, setActive] = React.useState<(typeof FLOW)[number]["id"]>("ideas");
  const step = FLOW.find((f) => f.id === active)!;
  return (
    <div>
      <div role="tablist" aria-label="Steps" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {FLOW.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={f.id === active}
            onClick={() => setActive(f.id)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[14px] transition-colors",
              f.id === active ? "border-[#D2B07A] bg-[#D2B07A] text-[#0B1F3A]" : "border-white/15 text-white/70 hover:border-white/30 hover:text-white",
            )}
          >
            <f.icon className="size-4" /> {f.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-8 grid items-center gap-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-[26px] leading-tight text-white sm:text-[32px]">{step.title}</h3>
          <p className="mt-4 text-[15px] leading-relaxed text-[#AAB4C4]">{step.body}</p>
          <ul className="mt-6 space-y-2">
            {step.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[14px] text-white/90">
                <Check className="mt-0.5 size-4 shrink-0 text-[#D2B07A]" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <FlowVisual id={step.id} />
      </div>
    </div>
  );
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** What one new client is worth against the planned yearly price. The visitor's numbers, not ours. */
export function PaysForItself({ price }: { price: number }) {
  const [assets, setAssets] = React.useState(500_000);
  const [fee, setFee] = React.useState(1);
  const yearly = price * 12;
  const perClient = (assets * fee) / 100;
  const clients = perClient > 0 ? yearly / perClient : Infinity;
  return (
    <div className="rounded-3xl bg-white p-6 text-[#14213A] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:p-8">
      <div className="text-[15px] font-medium">What one new client is worth</div>
      <label className="mt-6 block">
        <span className="flex justify-between text-[13px]"><span>Assets a typical new client brings</span><span className="font-medium tnum">{money(assets)}</span></span>
        <input type="range" min={100_000} max={5_000_000} step={50_000} value={assets} onChange={(e) => setAssets(Number(e.target.value))} className="mt-2 w-full accent-[#B08D57]" />
      </label>
      <label className="mt-5 block">
        <span className="flex justify-between text-[13px]"><span>Your annual fee</span><span className="font-medium tnum">{fee.toFixed(2)}%</span></span>
        <input type="range" min={0.25} max={2} step={0.05} value={fee} onChange={(e) => setFee(Number(e.target.value))} className="mt-2 w-full accent-[#B08D57]" />
      </label>
      <div className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#F7F5F0] p-4">
          <div className="text-[12px] text-[#6B675E]">One client, per year</div>
          <div className="mt-1 font-serif text-[26px] leading-none tnum">{money(perClient)}</div>
        </div>
        <div className="rounded-2xl bg-[#F7F5F0] p-4">
          <div className="text-[12px] text-[#6B675E]">Studio, per year</div>
          <div className="mt-1 font-serif text-[26px] leading-none tnum">{money(yearly)}</div>
        </div>
      </div>
      <p className="mt-5 text-[14px] leading-relaxed">
        {clients <= 1 ? (
          <>One new client covers <span className="font-semibold">{(1 / clients).toFixed(1)} years</span> of {money(price)}/month, from that client’s first year of fees alone.</>
        ) : (
          <>About <span className="font-semibold">{clients.toFixed(1)} new clients</span> a year cover the planned {money(price)}/month.</>
        )}
      </p>
      <p className="mt-2 text-[11px] text-[#6B675E]">Illustration using the numbers you enter. Free during early access.</p>
      <Link href="/signup" className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0B1F3A] text-[14px] font-medium text-white hover:bg-[#16304f]">
        Start free <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
