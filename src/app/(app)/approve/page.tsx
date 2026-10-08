"use client";

import * as React from "react";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer, EmptyState } from "@/components/shared/page";
import { ComplianceBadge } from "@/components/shared/badges";
import { VideoThumb } from "@/components/shared/video-thumb";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { Reviewer } from "@/components/compliance/reviewer";
import { useStore } from "@/lib/store";
import { COMPLIANCE_STATUS_META, type ArchiveRow } from "@/lib/compliance";
import { getPlatform } from "@/lib/mock/platforms";
import type { ComplianceStatus } from "@/lib/types";
import { cn, fmtDate, fmtDateTime, relativeTime } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

const ORDER: ComplianceStatus[] = ["submitted", "changes_requested", "draft", "approved"];

export default function CompliancePage() {
  const { reviews, getVideo, videos, requireApproval } = useStore();
  const showQueue = requireApproval || reviews.length > 0;
  const [filter, setFilter] = React.useState<ComplianceStatus | "all">("all");
  const [selected, setSelected] = React.useState<string>(reviews.find((r) => r.status === "changes_requested")?.id ?? reviews[0]?.id);
  const list = reviews.filter((r) => filter === "all" || r.status === filter).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const current = reviews.find((r) => r.id === selected);

  const archive: ArchiveRow[] = React.useMemo(
    () =>
      videos
        .flatMap((v) => {
          const approval = reviews.find((r) => r.videoId === v.id && r.status === "approved");
          return (v.posts ?? []).map((p, i) => ({
            id: `${v.id}-${i}`,
            videoId: v.id,
            title: v.title,
            platform: p.platform,
            publishedAt: p.at,
            caption: p.caption,
            disclosure: p.disclosureVersion,
            approver: approval?.reviewer ?? "Not required",
            approvedAt: approval?.decidedAt ?? "",
            channel: p.channel,
            how: p.how,
          }));
        })
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [videos, reviews]
  );

  const exportCsv = () => {
    const head = "Post ID,Video,Platform,Published,Final caption,Disclosure version,Approver,Approved";
    const body = archive.map((r) => [r.id, `"${r.title}"`, getPlatform(r.platform).label, r.publishedAt, `"${r.caption.replace(/"/g, '""')}"`, r.disclosure, r.approver, r.approvedAt].join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head, ...body].join("\n")], { type: "text/csv" }));
    a.download = `${BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-books-and-records.csv`;
    a.click();
    toast.success("Archive exported", { description: `${archive.length} posts · CSV` });
  };

  return (
    <PageContainer className="max-w-[1200px] space-y-8 pt-10">
      <div>
        <h1 className="font-serif text-[40px] leading-tight tracking-tight">{requireApproval ? "Approve" : "Archive"}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{requireApproval ? "Nothing goes out until it’s reviewed. Everything that goes out is archived." : "Everything that goes out is archived: the exact caption and disclosure, for your records."}</p>
      </div>
      <Tabs defaultValue={showQueue ? "queue" : "archive"}>
        {/* With approval off there is only the archive: no tabs needed. */}
        {showQueue && (
          <TabsList variant="line">
            <TabsTrigger value="queue">To review</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="queue" className="space-y-5 pt-3">
          <div className="flex flex-wrap gap-2">
            {(["all", ...ORDER] as const).map((s) => {
              const count = s === "all" ? reviews.length : reviews.filter((r) => r.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn("inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors", filter === s ? "border-primary bg-brass-soft/60" : "border-border bg-card hover:border-primary/40")}
                >
                  {s === "all" ? "All" : COMPLIANCE_STATUS_META[s].label}
                  <span className="text-[11px] text-muted-foreground tnum">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-2">
              {list.length === 0 && <Card><EmptyState icon={ShieldCheck} title="Queue is clear" description="Nothing in this status." /></Card>}
              {list.map((r) => {
                const v = getVideo(r.videoId);
                if (!v) return null;
                const openC = r.comments.filter((c) => !c.resolved).length;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-soft transition-colors", selected === r.id ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-primary/30")}
                  >
                    <VideoThumb spec={v.thumbnail} image={v.covers?.[v.format]?.url} format={v.format} size="xs" className={v.format === "short" ? "w-9" : "w-16"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{v.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{r.kind} · {relativeTime(r.submittedAt)}{openC ? ` · ${openC} open` : ""}</div>
                      <div className="mt-1.5"><ComplianceBadge status={r.status} /></div>
                    </div>
                  </button>
                );
              })}
            </div>
            {current ? <Reviewer key={current.id} review={current} /> : <Card><EmptyState title="Select an item" description="Choose something from the queue to review it." /></Card>}
          </div>
        </TabsContent>

        <TabsContent value="archive" className="pt-3">
          <Card>
            <CardHeader>
              <div>
                <div className="eyebrow">Books & records</div>
                <p className="mt-1 text-[13px] text-muted-foreground"><span className="tnum">{archive.length}</span> {archive.length === 1 ? "post" : "posts"} archived · retained 7 years · immutable</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportCsv} disabled={archive.length === 0}><Download /> Export CSV</Button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {archive.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="Nothing archived yet" description="Each time a video goes out, the exact caption and disclosure are saved here for your records." />
              ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5">Platform</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Video</TableHead>
                    <TableHead>Final caption</TableHead>
                    <TableHead>Disclosure</TableHead>
                    <TableHead className="pr-5">Approver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archive.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5"><span className="inline-flex items-center gap-2" style={{ ["--pi-bg" as string]: "var(--card)" }}><PlatformIcon id={r.platform} className="size-3.5" />{getPlatform(r.platform).label}</span></TableCell>
                      <TableCell className="text-muted-foreground tnum">{fmtDateTime(r.publishedAt)}</TableCell>
                      <TableCell className="max-w-[220px] truncate font-medium">{r.title}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground">{r.caption}</TableCell>
                      <TableCell><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{r.disclosure}</span></TableCell>
                      <TableCell className="pr-5">
                        <div>{r.approver}</div>
                        <div className="text-[11px] text-muted-foreground tnum">{r.approvedAt ? fmtDate(r.approvedAt) : ""}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </PageContainer>
  );
}
