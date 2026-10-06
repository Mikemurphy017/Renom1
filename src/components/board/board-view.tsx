"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search, SquareKanban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader, EmptyState } from "@/components/shared/page";
import { CategoryTag, ComplianceBadge, FormatBadge } from "@/components/shared/badges";
import { VideoThumb } from "@/components/shared/video-thumb";
import { VideoCard } from "./video-card";
import { useStore } from "@/lib/store";
import { useShell } from "@/components/layout/shell-context";
import { STAGES, getStage, stageIndex } from "@/lib/stages";
import { CATEGORIES } from "@/lib/mock/videos";
import { inPipeline } from "@/lib/selectors";
import { relativeTime, cn } from "@/lib/utils";

export function BoardView() {
  const params = useSearchParams();
  const focusStage = params.get("stage");
  const { videos } = useStore();
  const { openNewVideo } = useShell();
  const [view, setView] = React.useState<"board" | "list">("board");
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [fmt, setFmt] = React.useState("all");

  const pipeline = videos.filter(inPipeline);
  const filtered = pipeline.filter(
    (v) =>
      (cat === "all" || v.category === cat) &&
      (fmt === "all" || v.format === fmt) &&
      (!q || v.title.toLowerCase().includes(q.toLowerCase()))
  );
  const publishedCount = videos.length - pipeline.length;
  const hasFilters = q || cat !== "all" || fmt !== "all";

  return (
    <PageContainer className="max-w-none space-y-6">
      <PageHeader
        eyebrow="Video Board"
        title="Every video, every stage"
        description="Ideas move left to right until they're published. Click any card to open it in the Studio."
        actions={
          <Button onClick={openNewVideo}>
            <Plus /> New Video
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title" className="h-8 pl-9 text-[13px]" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fmt} onValueChange={setFmt}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All formats</SelectItem>
            <SelectItem value="short">Short-form 9:16</SelectItem>
            <SelectItem value="long">Long-form 16:9</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setCat("all"); setFmt("all"); }}>
            <X /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Link href="/library" className="text-xs text-muted-foreground hover:text-foreground">
            <span className="tnum">{publishedCount}</span> published → Library
          </Link>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "board" | "list")}>
            <ToggleGroupItem value="board" aria-label="Board view"><LayoutGrid /> Board</ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view"><List /> List</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={SquareKanban}
            title={hasFilters ? "Nothing matches those filters" : "Your board is empty"}
            description={hasFilters ? "Try a different category or format." : "Start with an idea — Renom will help shape it."}
            action={hasFilters ? <Button variant="outline" onClick={() => { setQ(""); setCat("all"); setFmt("all"); }}>Clear filters</Button> : <Button onClick={openNewVideo}><Plus /> New Video</Button>}
          />
        </Card>
      ) : view === "board" ? (
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          <div className="flex gap-3">
            {STAGES.map((s, i) => {
              const items = filtered.filter((v) => v.stage === s.id);
              return (
                <div
                  key={s.id}
                  className={cn("flex w-[248px] shrink-0 flex-col rounded-lg border border-transparent bg-muted/50 p-2", focusStage === s.id && "border-primary/40 bg-brass-soft/40")}
                >
                  <div className="flex items-center gap-2 px-1.5 pt-1 pb-3">
                    <span className="size-2 rounded-[2px]" style={{ background: `var(--stage-${i + 1})` }} />
                    <span className="text-[12px] font-semibold tracking-wide">{s.label}</span>
                    <span className="ml-auto rounded bg-card px-1.5 text-[11px] text-muted-foreground tnum">{items.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5">
                    {items.map((v) => (
                      <VideoCard key={v.id} video={v} />
                    ))}
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">No videos</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[44%]">Video</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead className="text-right">Last edited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filtered]
                .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage))
                .map((v) => {
                  const s = getStage(v.stage);
                  return (
                    <TableRow key={v.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/studio/${v.id}/${v.stage}`} className="flex items-center gap-3">
                          <VideoThumb spec={v.thumbnail} format={v.format} size="xs" className={v.format === "short" ? "w-7" : "w-12"} />
                          <span className="truncate font-medium">{v.title}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <s.icon className="size-3.5 text-muted-foreground" /> {s.label}
                        </span>
                      </TableCell>
                      <TableCell><FormatBadge format={v.format} /></TableCell>
                      <TableCell><CategoryTag category={v.category} /></TableCell>
                      <TableCell><ComplianceBadge status={v.compliance} /></TableCell>
                      <TableCell className="text-right text-muted-foreground tnum">{relativeTime(v.lastEdited)}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  );
}
