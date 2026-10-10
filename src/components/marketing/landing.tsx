import Link from "next/link";
import {
  ArrowRight,
  Captions,
  Check,
  FileText,
  Image as ImageIcon,
  CalendarClock,
  Mic,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { FlowTabs, RoiCalculator } from "./landing-interactive";

/**
 * The public sales page (signed-out visitors to "/"). Every call to action
 * leads to /signup. Free during early access; pricing after that is still to
 * be decided, and the ROI calculator says it uses a sample price.
 */

/** The price the ROI calculator illustrates with (pricing itself is TBD). */
const SAMPLE_PRICE = 500;
const NAME = BRAND.name;

const FEATURES = [
  { icon: FileText, title: "Scripts in your voice", body: "Built from your answers about who you serve and how you talk. Narrative scripts that flow, not slogans stitched together." },
  { icon: Mic, title: "A teleprompter that keeps up", body: "Adjustable speed and size, mirror mode, a countdown, and it works on your phone in portrait." },
  { icon: Captions, title: "Captions that follow your voice", body: "Speech recognition times each word as you said it, so captions land on the beat, never ahead of you." },
  { icon: Sparkles, title: "Edit styles", body: "Impact, Ignite, Focus and more. One pick sets the captions, punch-in zooms, keyword cards, b-roll and music." },
  { icon: ImageIcon, title: "Covers that get the click", body: "Dozens of thumbnail styles built around you, plus AI scenes: you in an office, a study or outdoors, with a prop that fits the topic." },
  { icon: Smartphone, title: "See it on a phone first", body: "Preview every video the way it will look in the feed on TikTok, Reels or Shorts, with your caption, before it goes anywhere." },
  { icon: CalendarClock, title: "Post now or schedule it", body: "Connect your own Buffer once and send each video to your channels right away or at the time you choose. Or our team posts it for you." },
  { icon: ShieldCheck, title: "Built for a regulated business", body: "Your disclosure on every post, an optional approval step for your reviewer, and an archive of everything that went out." },
];

const REPLACES = [
  ["Staring at a blank page every week", "Four finished scripts, written for you"],
  ["Booking a videographer or a studio day", "Record at your desk, in your browser"],
  ["Waiting days on an editor", "Edited video in minutes"],
  ["Writing captions, hashtags and covers", "Written and designed for you, AI cover scenes included"],
  ["Logging in to every network to post", "Post or schedule everywhere at once"],
  ["Remembering the disclosure", "Added to every post automatically"],
];

const INCLUDED = [
  "Unlimited ideas and scripts",
  "In-browser teleprompter and recording",
  "Automatic editing with captions, b-roll and music",
  "All edit styles, including Impact and Ignite",
  "Cover thumbnails and AI cover scenes",
  "Phone preview of every post",
  "Post copy, hashtags and disclosures",
  "Post or schedule from your own accounts",
  "Our team posts it for you, or download the MP4",
  "Approval step and archive",
  "Works on your laptop and your phone",
];

const FAQ = [
  {
    q: "Do I need any equipment?",
    a: "No. The camera on your laptop or phone works. A clip-on microphone and a window in front of you make a noticeable difference, but neither is required to start.",
  },
  {
    q: "How long does a video take?",
    a: `Most of the time is the recording itself. Choosing a script takes a few minutes, and once you stop recording ${NAME} edits the video for you while you review the post copy.`,
  },
  {
    q: "Will it sound like me?",
    a: "Scripts start from your answers about your clients, your specialty and how you speak, and you can edit any line before you record. The more you use it, the more you'll recognise your own voice on the page.",
  },
  {
    q: "Is it compliant?",
    a: `${NAME} adds your disclosure to every post, can route each video to a reviewer before it goes out, and keeps an archive of everything you publish. Your firm's own compliance review still applies, and ${NAME} is built to make it easy.`,
  },
  {
    q: "Where can I post?",
    a: "LinkedIn, Instagram, Facebook, YouTube, TikTok and X. Connect your own Buffer account once (Buffer’s free plan covers three channels) and post or schedule each video from your studio. Or have our team post it for you, or download the finished MP4 and upload it anywhere you like.",
  },
  {
    q: "What happens when early access ends?",
    a: `${NAME} is free while we're in early access. Pricing after early access is still being decided. We'll tell you well before anything changes, and nothing is ever charged without you choosing a plan.`,
  },
  {
    q: "Do I own my videos?",
    a: "Yes. Every video you make is yours. Download the MP4s any time.",
  },
];

function CTA({ className, children = "Start free", variant = "primary" }: { className?: string; children?: React.ReactNode; variant?: "primary" | "light" }) {
  return (
    <Link
      href="/signup"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-medium transition-colors",
        variant === "primary" ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "bg-white text-[#0B1F3A] hover:bg-white/90",
        className,
      )}
    >
      {children} <ArrowRight className="size-4" />
    </Link>
  );
}

/** Headline with the closing phrase in brass italic serif. */
function H2({ children, accent, className, light }: { children: React.ReactNode; accent: string; className?: string; light?: boolean }) {
  return (
    <h2 className={cn("font-serif text-[34px] leading-[1.08] tracking-tight sm:text-[46px]", light && "text-white", className)}>
      {children} <em className={cn("italic", light ? "text-[#D2B07A]" : "text-primary")}>{accent}</em>
    </h2>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("eyebrow mb-3 text-primary", className)}>{children}</div>;
}

/** A drawn preview of a finished video: no stock photo needed. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,var(--brass-soft),transparent)] opacity-80" />
      {/* Phone */}
      <div className="relative mx-auto w-[250px] rounded-[38px] border border-black/10 bg-[#0B1F3A] p-2.5 shadow-[0_30px_80px_-20px_rgba(11,31,58,0.45)] sm:w-[270px]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[30px] bg-[linear-gradient(160deg,#1d3a63_0%,#0B1F3A_55%,#081629_100%)]">
          {/* The advisor */}
          <div className="absolute bottom-0 left-1/2 h-[62%] w-[78%] -translate-x-1/2">
            <div className="absolute top-0 left-1/2 size-[38%] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#d9c3a0,#b99a72)]" />
            <div className="absolute bottom-0 left-0 h-[62%] w-full rounded-t-[48%] bg-[linear-gradient(180deg,#22385a,#162943)]" />
            <div className="absolute bottom-0 left-1/2 h-[58%] w-[16%] -translate-x-1/2 bg-[linear-gradient(180deg,#e9e5dc,#cfc8b9)] [clip-path:polygon(0_0,100%_0,60%_100%,40%_100%)]" />
          </div>
          {/* Keyword card */}
          <div className="absolute top-[13%] left-1/2 -translate-x-1/2 text-center font-[Anton] text-[34px] leading-none tracking-wide text-[#3CF2B4] [text-shadow:0_0_18px_rgba(60,242,180,0.55),0_2px_0_#000]">
            ROTH WINDOW
          </div>
          {/* Caption */}
          <div className="absolute bottom-[27%] left-0 w-full px-3 text-center font-sans text-[20px] font-black tracking-wide text-white uppercase [text-shadow:0_2px_0_#000,0_0_6px_#000]">
            before <span className="text-[#D9B97E]">RMDs</span>
          </div>
          {/* Name title */}
          <div className="absolute bottom-[19%] left-3 rounded bg-[#0B1F3A]/90 px-2 py-1 text-[9px] font-bold tracking-wide text-white">
            YOUR NAME, CFP®
          </div>
          <div className="absolute top-3 left-1/2 h-1 w-14 -translate-x-1/2 rounded-full bg-white/25" />
        </div>
      </div>

      {/* Script card */}
      <div className="absolute top-[42%] left-0 hidden w-[150px] rotate-[-3deg] rounded-2xl border border-border bg-card p-3.5 text-foreground shadow-soft sm:block">
        <div className="eyebrow text-[10px] text-primary">The Story</div>
        <p className="mt-1.5 font-serif text-[12px] leading-snug">
          “A surgeon I’ll call David sat across from me last spring with a spreadsheet he’d built himself…”
        </p>
      </div>

      {/* Ready card */}
      <div className="absolute right-0 -bottom-3 hidden w-[160px] rotate-[2deg] rounded-2xl border border-border bg-card p-3.5 text-foreground shadow-soft sm:block">
        <div className="flex items-center gap-2 text-[12px] font-medium">
          <span className="flex size-5 items-center justify-center rounded-full bg-success-soft text-success"><Check className="size-3" /></span>
          Ready to post
        </div>
        <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          <div>Captions, b-roll, music</div>
          <div className="font-medium text-foreground">1080×1920 MP4 · 1:14</div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/" aria-label={`${NAME} home`}><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-6 text-[14px] text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#results" className="hover:text-foreground">Results</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/signin" className="px-2 py-2 text-[14px] whitespace-nowrap text-muted-foreground hover:text-foreground sm:px-3">Sign in</Link>
            <Link href="/signup" className="inline-flex h-9 items-center rounded-full bg-[#0B1F3A] px-3.5 text-[14px] font-medium whitespace-nowrap sm:px-4 text-white hover:bg-[#16304f] dark:bg-primary dark:text-primary-foreground">Start free</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 pt-16 pb-14 text-center sm:px-6 md:pt-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground shadow-soft">
            <span className="size-1.5 rounded-full bg-success" /> Free during early access
          </div>
          <h1 className="font-serif text-[44px] leading-[1.03] tracking-tight sm:text-[64px] lg:text-[76px]">
            The advisor people trust most is the one <em className="text-primary italic">they’ve already met.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground sm:text-[19px]">
            Video lets prospects meet you before the first meeting. {NAME} writes the script in your voice, puts it on a teleprompter in your browser, edits your take and hands you a video that’s ready to post.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <CTA>Start free</CTA>
            <a href="#how" className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-card px-7 text-[15px] font-medium hover:bg-accent">See how it works</a>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">No credit card. Pricing after early access: TBD.</p>
        </section>

        {/* You record. We do the rest. */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <H2 accent={`${NAME} does the rest.`}>You record.</H2>
            <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">You bring the expertise and a few minutes in front of the camera. Everything before and after is handled.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-3xl bg-[#0B1F3A] p-7 text-white md:col-span-2 lg:row-span-2">
              <div className="eyebrow text-[#D2B07A]">Finished video</div>
              <h3 className="mt-3 max-w-xs font-serif text-[26px] leading-tight">Edited, captioned and ready to post.</h3>
              <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[#AAB4C4]">Pauses and retakes cut, captions timed to every word, b-roll and music on the big moments, your name on screen.</p>
              <div className="mt-8"><ProductPreview /></div>
            </div>
            {FEATURES.map((f) => (
              <Feature key={f.title} f={f} />
            ))}
          </div>
        </section>

        {/* One flow */}
        <section id="how" className="scroll-mt-16 bg-[#0B1F3A]">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mb-10 max-w-2xl">
              <Eyebrow className="text-[#D2B07A]">How it works</Eyebrow>
              <H2 light accent="Idea to posted.">One flow.</H2>
              <p className="mt-4 text-[16px] leading-relaxed text-[#AAB4C4]">No juggling a writer, a videographer, an editor, a designer and a scheduling tool. Every step lives in one studio, and each one feeds the next.</p>
            </div>
            <FlowTabs />
            <div className="mt-10 text-center"><CTA>Start free</CTA></div>
          </div>
        </section>

        {/* Results */}
        <section id="results" className="scroll-mt-16">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>Results</Eyebrow>
              <H2 accent="what’s working.">Numbers that show you</H2>
              <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
                Our team tracks views, reach, engagement and clicks on everything we post for you, and uses them to steer what you make next. Topics that land with your audience come back around.
              </p>
              <ul className="mt-6 space-y-2.5">
                {["Every post and platform tracked", "Reviewed by our team", "More of what works"].map((x) => (
                  <li key={x} className="flex gap-2.5 text-[15px]"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {x}</li>
                ))}
              </ul>
            </div>
            <AnalyticsPreview />
          </div>
        </section>

        {/* What it replaces */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
            <div className="text-center">
              <Eyebrow>What it replaces</Eyebrow>
              <H2 accent="without the team.">A production team,</H2>
            </div>
            <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-background shadow-soft">
              <div className="grid grid-cols-2 border-b border-border bg-muted/60 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
                <div className="px-4 py-3 sm:px-6">The usual way</div>
                <div className="border-l border-border px-4 py-3 sm:px-6">With {NAME}</div>
              </div>
              {REPLACES.map(([before, after]) => (
                <div key={before} className="grid grid-cols-2 border-b border-border text-[14px] last:border-0 sm:text-[15px]">
                  <div className="px-4 py-4 text-muted-foreground sm:px-6">{before}</div>
                  <div className="flex gap-2 border-l border-border px-4 py-4 sm:px-6">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span>{after}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow>Pricing</Eyebrow>
              <H2 accent="free for now.">Everything included,</H2>
              <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
                We’re opening {NAME} to a small group of advisors first. Use all of it, free, and help shape what comes next.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-[1.15fr_1fr]">
              <div className="rounded-3xl border-2 border-primary bg-card p-7 shadow-soft sm:p-9">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-medium">{NAME} Studio</div>
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">Early access</span>
                </div>
                <div className="mt-6 flex items-end gap-3">
                  <span className="font-serif text-[60px] leading-none">$0</span>
                  <span className="pb-2 text-[15px] text-muted-foreground">/ month during early access</span>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">Pricing after early access: TBD. Nothing is charged unless you choose a plan.</p>
                <ul className="mt-7 grid gap-2.5 sm:grid-cols-1">
                  {INCLUDED.map((i) => (
                    <li key={i} className="flex gap-2.5 text-[14px]"><Check className="mt-0.5 size-4 shrink-0 text-primary" /> {i}</li>
                  ))}
                </ul>
                <CTA className="mt-8 w-full">Start free</CTA>
                <p className="mt-3 text-center text-[12px] text-muted-foreground">No credit card needed.</p>
              </div>
              <div className="rounded-3xl border border-border bg-muted/50 p-7 sm:p-9">
                <div className="text-[15px] font-medium">The usual way</div>
                <p className="mt-2 text-[13px] text-muted-foreground">What advisors typically pay for separately to post video every week.</p>
                <ul className="mt-6 space-y-4">
                  {[
                    ["Scriptwriter or copywriter", "Ideas and scripts, every week"],
                    ["Videographer or studio days", "Filming, lighting, sound"],
                    ["Video editor", "Cuts, captions, b-roll, music"],
                    ["Designer and social manager", "Covers, post copy, scheduling"],
                  ].map(([t, d]) => (
                    <li key={t} className="flex items-start justify-between gap-4 border-b border-border pb-4 last:border-0">
                      <div>
                        <div className="text-[14px] font-medium">{t}</div>
                        <div className="text-[12px] text-muted-foreground">{d}</div>
                      </div>
                      <span className="shrink-0 text-[12px] text-muted-foreground">Included</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Pays for itself */}
        <section className="bg-[#0B1F3A]">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <div>
              <Eyebrow className="text-[#D2B07A]">The math</Eyebrow>
              <H2 light accent="Calculator">{NAME} ROI</H2>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-[#AAB4C4]">
                Video is how people decide whether they want to meet you. If being seen every week brings in even one new relationship, the studio pays for itself many times over. Put in your own numbers.
              </p>
            </div>
            <RoiCalculator price={SAMPLE_PRICE} />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16">
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <div className="text-center">
              <H2 accent="questions">Frequently asked</H2>
            </div>
            <div className="mt-12 divide-y divide-border border-y border-border">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 pr-10 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Ready */}
        <section className="bg-[#0B1F3A]">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
            <H2 light accent="get started?">Ready to</H2>
            <p className="mx-auto mt-4 max-w-xl text-[16px] text-[#AAB4C4]">Set up your voice in five minutes, pick a script and record your first video. Free during early access.</p>
            <CTA variant="light" className="mt-8">Create your studio</CTA>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted-foreground">Video for financial advisors: ideas, scripts, recording, editing and posting in one studio.</p>
          </div>
          <div>
            <div className="eyebrow mb-3">Product</div>
            <ul className="space-y-2 text-[14px] text-muted-foreground">
              <li><a href="#how" className="hover:text-foreground">How it works</a></li>
              <li><a href="#results" className="hover:text-foreground">Results</a></li>
              <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
              <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow mb-3">Account</div>
            <ul className="space-y-2 text-[14px] text-muted-foreground">
              <li><Link href="/signup" className="hover:text-foreground">Start free</Link></li>
              <li><Link href="/signin" className="hover:text-foreground">Sign in</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">Privacy policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground sm:px-6">
            <span>© {year} {NAME}. All rights reserved.</span>
            <Link href="/privacy" className="hover:text-foreground">Privacy policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ f, className }: { f: (typeof FEATURES)[number]; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-border bg-card p-6 shadow-soft", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-brass-soft text-primary"><f.icon className="size-5" /></span>
      <h3 className="mt-5 text-[17px] font-medium">{f.title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{f.body}</p>
    </div>
  );
}

/** Example numbers only, drawn to show the Analyze page's shape. */
function AnalyticsPreview() {
  const bars = [32, 45, 38, 60, 52, 74, 66, 88, 71, 95, 84, 100];
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-7">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium">Last 30 days</div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Example data</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Views", "18.4K"],
          ["Reach", "9.7K"],
          ["Engagement", "4.8%"],
          ["Clicks", "312"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-muted/60 p-3.5">
            <div className="text-[11px] text-muted-foreground">{l}</div>
            <div className="mt-1 font-serif text-[22px] leading-none tnum">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex h-32 items-end gap-1.5" aria-hidden>
        {bars.map((h, i) => (
          <div key={i} className={cn("flex-1 rounded-t-md", i === bars.length - 1 ? "bg-primary" : "bg-primary/30")} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {[
          ["The Roth window most retirees miss", "6.1K views"],
          ["Your RSUs vest in March. Now what?", "4.3K views"],
          ["Why your 401(k) isn’t on autopilot", "2.9K views"],
        ].map(([t, v], i) => (
          <div key={t} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5 text-[13px]">
            <span className="flex min-w-0 items-center gap-2.5"><span className="font-serif text-muted-foreground tnum">{i + 1}</span><span className="truncate">{t}</span></span>
            <span className="shrink-0 text-muted-foreground tnum">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
