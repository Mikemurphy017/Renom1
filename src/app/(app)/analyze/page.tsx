"use client";

import Link from "next/link";
import { ChartLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer, EmptyState } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { useStore } from "@/lib/store";
import { fmtDateTime } from "@/lib/utils";

/**
 * The advisor's own posting record. Per-post views and engagement will come
 * from the advisor's own accounts; the team's Buffer numbers stay on the admin side.
 */
export default function AnalyzePage() {
  const { videos } = useStore();
  const posted = videos.filter((v) => v.status === "published").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const scheduled = videos.filter((v) => v.status === "scheduled");
  const withTeam = videos.filter((v) => v.teamPost && ["submitted", "in_buffer"].includes(v.teamPost.status));
  const month = posted.filter((v) => v.publishedAt && Date.now() - Date.parse(v.publishedAt) < 30 * 86400000).length;

  return (
    <PageContainer className="max-w-[1080px] space-y-12 pt-10">
      <div>
        <h1 className="font-serif text-[40px] leading-tight tracking-tight">Analyze</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">What you’ve put out, and what’s on its way. Views and engagement for each video are coming soon.</p>
      </div>

      {/* A new studio skips the row of zeros; the empty state below says it better. */}
      {posted.length + scheduled.length + withTeam.length > 0 && <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Posted", posted.length],
          ["Last 30 days", month],
          ["Scheduled", scheduled.length],
          ["With your team", withTeam.length],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card px-5 py-4">
            <div className="text-[13px] text-muted-foreground">{l}</div>
            <div className="mt-1 font-serif text-[34px] leading-tight tnum">{v}</div>
          </div>
        ))}
      </section>}

      <section>
        <h2 className="mb-4 font-serif text-2xl">Posted videos</h2>
        {posted.length === 0 ? (
          <EmptyState
            className="rounded-2xl border border-dashed border-border"
            icon={ChartLine}
            title="Nothing posted yet"
            description="When your first video goes out, it shows up here."
            action={<Button className="rounded-full" asChild><Link href="/videos">Your videos</Link></Button>}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {posted.map((v) => (
              <li key={v.id}>
                <Link href={`/studio/${v.id}/post`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{v.title}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">
                      {v.publishedAt ? fmtDateTime(v.publishedAt) : ""}
                      {v.posts?.some((p) => p.how === "team") ? " · posted by your team" : v.posts?.some((p) => p.how === "manual" || p.how === "direct") ? " · posted by you" : ""}
                    </div>
                  </div>
                  <div className="flex gap-1.5 text-muted-foreground" style={{ ["--pi-bg" as string]: "var(--card)" }}>
                    {v.platforms.slice(0, 5).map((p) => <PlatformIcon key={p} id={p} className="size-4" />)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
