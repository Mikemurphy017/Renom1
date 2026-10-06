"use client";

import Link from "next/link";
import { ArrowRight, Clapperboard, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader, SectionLabel, EmptyState } from "@/components/shared/page";
import { VideoThumb } from "@/components/shared/video-thumb";
import { CategoryTag, FormatBadge } from "@/components/shared/badges";
import { useShell } from "@/components/layout/shell-context";
import { useStore } from "@/lib/store";
import { STAGES, stageIndex } from "@/lib/stages";
import { inPipeline } from "@/lib/selectors";
import { relativeTime, cn } from "@/lib/utils";

export default function StudioIndexPage() {
  const { videos } = useStore();
  const { openNewVideo } = useShell();
  const active = videos.filter(inPipeline).sort((a, b) => b.lastEdited.localeCompare(a.lastEdited));
  const [latest, ...rest] = active;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        eyebrow="Studio"
        title="Pick up where you left off"
        description="Every video moves through the same seven steps. Jump back into any of them."
        actions={<Button onClick={openNewVideo}><Plus /> New Video</Button>}
      />

      {!latest ? (
        <Card><EmptyState icon={Clapperboard} title="Nothing in the studio" description="Start a video and Renom will walk you from idea to post." action={<Button onClick={openNewVideo}><Plus /> New Video</Button>} /></Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[1fr_1.4fr]">
              <div className="flex items-center justify-center bg-navy p-8 dark:bg-secondary">
                <VideoThumb spec={latest.thumbnail} format={latest.format} size="md" className={latest.format === "short" ? "w-40" : "w-full max-w-sm"} />
              </div>
              <div className="flex flex-col justify-center p-8">
                <div className="eyebrow">Most recent · {relativeTime(latest.lastEdited)}</div>
                <h2 className="mt-2 font-serif text-2xl">{latest.title}</h2>
                <div className="mt-2 flex items-center gap-3"><FormatBadge format={latest.format} /><CategoryTag category={latest.category} /></div>
                <ol className="mt-6 flex flex-wrap gap-1.5">
                  {STAGES.map((s, i) => (
                    <li key={s.id} className={cn("rounded px-2 py-1 text-[11px]", i < stageIndex(latest.stage) ? "bg-brass-soft text-[#7d6238] dark:text-primary" : i === stageIndex(latest.stage) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {s.label}
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <Button asChild><Link href={`/studio/${latest.id}/${latest.stage}`}>Resume at {STAGES[stageIndex(latest.stage)].label} <ArrowRight /></Link></Button>
                </div>
              </div>
            </div>
          </Card>

          <div>
            <SectionLabel>In progress</SectionLabel>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((v) => {
                const s = STAGES[stageIndex(v.stage)];
                return (
                  <Link key={v.id} href={`/studio/${v.id}/${v.stage}`} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-soft transition-colors hover:border-primary/40">
                    <VideoThumb spec={v.thumbnail} format={v.format} size="xs" className={v.format === "short" ? "w-10" : "w-20"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{v.title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <s.icon className="size-3.5" /> {s.label} · {relativeTime(v.lastEdited)}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
