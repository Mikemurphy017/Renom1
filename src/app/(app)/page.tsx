"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Monitor, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageContainer } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { StepDots } from "@/components/shared/step-dots";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStartVideo } from "@/components/layout/use-start-video";
import { useStore } from "@/lib/store";
import { getStage, stageIndex } from "@/lib/stages";
import { inPipeline, isPublished } from "@/lib/selectors";
import type { PlatformId, VideoFormat } from "@/lib/types";
import { TODAY, relativeTime } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

function greeting() {
  // Now, not TODAY (set when the app loaded): a tab left open overnight still greets correctly.
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomePage() {
  const { videos, reviews, profile, requireApproval } = useStore();
  const start = useStartVideo();
  const [topic, setTopic] = React.useState("");
  const [format, setFormat] = React.useState<VideoFormat>("short");

  const inProgress = videos.filter(inPipeline).filter((v) => v.status === "in_progress").sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || b.lastEdited.localeCompare(a.lastEdited)).slice(0, 3);
  const waiting = reviews.filter((r) => r.status === "submitted").length;
  const needsChanges = reviews.filter((r) => r.status === "changes_requested").length;
  const withTeam = videos.filter((v) => v.teamPost && ["submitted", "in_buffer"].includes(v.teamPost.status)).length;
  const published = videos.filter(isPublished).length + videos.filter((v) => v.status === "scheduled").length;

  type Upcoming = { id: string; at: string; title: string; platforms: PlatformId[]; href: string; source: string };
  const upcoming: Upcoming[] = videos
    .filter((v) => v.status === "scheduled" && v.scheduledFor && new Date(v.scheduledFor) >= TODAY)
    .map((v) => ({ id: v.id, at: v.scheduledFor!, title: v.title, platforms: v.platforms, href: `/studio/${v.id}/post`, source: v.teamPost?.status === "scheduled" ? "Scheduled by your team" : BRAND.name }))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5);

  const summary = [
    videos.length === 0 ? "Your studio is ready. Start with one idea" : inProgress.length ? `${inProgress.length} ${inProgress.length === 1 ? "video is" : "videos are"} in progress` : "Nothing in progress",
    waiting ? `${waiting} waiting on approval` : null,
    needsChanges ? `${needsChanges} needs your changes` : null,
  ].filter(Boolean).join(" · ");

  return (
    <PageContainer className="max-w-[960px] space-y-14 pt-12 sm:pt-16">
      <section>
        <div className="eyebrow mb-3">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        <h1 className="font-serif text-[40px] leading-[1.1] tracking-tight sm:text-[48px]">
          {greeting()}{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">{summary}.</p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-2 shadow-[0_1px_2px_rgba(11,31,58,.04),0_12px_32px_-12px_rgba(11,31,58,.12)]">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start(topic, format);
              }
            }}
            rows={2}
            placeholder="What do you want to talk about this week?"
            className="block w-full resize-none bg-transparent px-4 pt-4 pb-2 font-serif text-xl outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2">
            <ToggleGroup type="single" value={format} onValueChange={(v) => v && setFormat(v as VideoFormat)} className="rounded-full">
              <ToggleGroupItem value="short" className="rounded-full"><Smartphone /> Short</ToggleGroupItem>
              <ToggleGroupItem value="long" className="rounded-full"><Monitor /> Long</ToggleGroupItem>
            </ToggleGroup>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" className="rounded-full text-muted-foreground" onClick={() => start("", format)}>
                <Sparkles /> Suggest ideas
              </Button>
              <Button className="rounded-full px-5" onClick={() => start(topic, format)}>
                Start <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {videos.length === 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Say what’s on your mind", "One sentence. Claude turns it into ideas in your voice, then writes the script."],
            ["2", "Record and trim", "Read from the teleprompter. The edit marks the pauses and retakes for you."],
            ["3", requireApproval ? "Approve and post" : "Post", "Captions for every platform with your disclosure locked on. Our team posts it for you, or download it and post it yourself."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-border bg-card p-5">
              <div className="font-serif text-2xl text-primary">{n}</div>
              <div className="mt-2 text-[15px] font-medium">{t}</div>
              <p className="mt-1 text-[13px] text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      )}

      {inProgress.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Pick up where you left off</h2>
            <Link href="/videos" className="text-[13px] text-muted-foreground hover:text-foreground">All videos</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {inProgress.map((v) => (
              <Link key={v.id} href={`/studio/${v.id}/${v.stage}`} className="group rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted/70">
                  <VideoThumb spec={v.thumbnail} image={v.covers?.[v.format]?.url} format={v.format} size="sm" className={v.format === "short" ? "h-[86%] w-auto" : "w-[90%]"} />
                </div>
                <div className="px-1 pt-3 pb-1">
                  <div className="line-clamp-2 text-[14px] leading-snug font-medium">{v.title}</div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <StepDots stage={v.stage} /> {getStage(v.stage).label}
                    </span>
                    <span className="text-[12px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Continue →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* A brand-new studio gets the three steps above instead of a row of zeros. */}
      {videos.length > 0 && <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "With your team", value: String(withTeam), sub: withTeam ? "waiting to be scheduled" : "nothing waiting to post", href: "/videos" },
          { label: "Published or scheduled", value: String(published), sub: published ? "videos from this studio" : "your first one is a few steps away", href: "/videos" },
          requireApproval
            ? { label: "Waiting on approval", value: String(waiting), sub: needsChanges ? `${needsChanges} sent back for changes` : "nothing sent back", href: "/approve" }
            : { label: "Drafts", value: String(videos.filter((v) => v.status === "draft").length), sub: "saved, not posted yet", href: "/videos?filter=drafts" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40">
            <div className="flex items-center justify-between text-[13px] text-muted-foreground">
              {s.label} <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-1 font-serif text-[34px] leading-tight tnum">{s.value}</div>
            <div className="text-[12px] text-muted-foreground tnum">{s.sub}</div>
          </Link>
        ))}
      </section>}

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-2xl">Coming up</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {upcoming.map((u) => {
              const d = new Date(u.at);
              const inner = (
                <>
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[11px] tracking-wider text-muted-foreground uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className="font-serif text-xl leading-tight tnum">{d.getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{u.title}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground tnum">
                      {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {u.source} · {relativeTime(u.at)}
                    </div>
                  </div>
                  <div className="flex gap-1.5 text-muted-foreground" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                    {u.platforms.slice(0, 4).map((p) => <PlatformIcon key={p} id={p} className="size-4" />)}
                  </div>
                </>
              );
              return (
                <li key={u.id} className="flex items-center hover:bg-muted/50">
                  <Link href={u.href} className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-5 pr-5">{inner}</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
