"use client";

import * as React from "react";
import Link from "next/link";
import { AlignLeft, ArrowRight, Check, Copy, Hash, Link2, Lock, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/page";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { AgentPanel } from "@/components/agent/agent-panel";
import { useAgentSession } from "@/components/agent/use-agent";
import { useDraft } from "@/lib/drafts";
import { generateDescriptions, type PlatformCopy } from "@/lib/ai/content";
import { PLATFORMS, getPlatform } from "@/lib/mock/platforms";
import { activeDisclosure, disclosureFor } from "@/lib/compose";
import type { PlatformId } from "@/lib/types";
import { cn, fmtNumber } from "@/lib/utils";
import { stageIndex } from "@/lib/stages";
import { StepLayout, StepSection, FieldLabel } from "../step-layout";
import type { StepProps } from "../studio-view";

const disclosure = activeDisclosure();
const lockedFor = disclosureFor;

function Counter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, (used / limit) * 100);
  const over = used > limit;
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] tnum", over ? "text-destructive" : "text-muted-foreground")}>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", over ? "bg-destructive" : pct > 85 ? "bg-primary" : "bg-success")} style={{ width: `${pct}%` }} />
      </span>
      {fmtNumber(used)} / {fmtNumber(limit)}
    </span>
  );
}

export function DescriptionsStep({ video, complete }: StepProps) {
  const defaults: PlatformId[] = video.platforms.length ? video.platforms : video.format === "short" ? ["youtube_shorts", "instagram", "linkedin"] : ["youtube", "linkedin"];
  const [selected, setSelected] = useDraft<PlatformId[]>(video.id, "desc.platforms", defaults);
  const [copies, setCopies] = useDraft<PlatformCopy[]>(video.id, "desc.copies", () =>
    stageIndex(video.stage) > stageIndex("descriptions") ? generateDescriptions(video, defaults.map(getPlatform)) : []
  );
  const [tab, setTab] = React.useState<string>(copies[0]?.platform ?? "");
  const [pending, setPending] = React.useState(false);
  const { turns, busy, run } = useAgentSession();

  const toggle = (id: PlatformId) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const generate = () => {
    if (!selected.length) return toast.error("Choose at least one platform");
    setPending(true);
    run(
      {
        task: "descriptions",
        summary: {
          Video: video.title,
          Platforms: selected.map((p) => getPlatform(p).short).join(", "),
          "Use Profile": "Yes",
          Disclosure: `${disclosure.version} (auto)`,
        },
      },
      {
        onDone: () => {
          const out = generateDescriptions(video, selected.map(getPlatform));
          setCopies(out);
          setTab(out[0].platform);
          setPending(false);
        },
      }
    );
  };

  const update = (p: PlatformId, patch: Partial<PlatformCopy>) => setCopies((cs) => cs.map((c) => (c.platform === p ? { ...c, ...patch } : c)));

  return (
    <StepLayout
      panel={
        <AgentPanel
          turns={turns}
          busy={busy}
          onSend={(t) => run({ task: "chat", summary: {}, prompt: t, context: { step: "descriptions" } })}
          suggestions={copies.length ? ["Shorter LinkedIn post", "Add a question to drive comments", "More formal"] : []}
          emptyHint="Pick platforms and generate. Disclosures from your Profile are appended automatically."
        />
      }
    >
      <StepSection title="Platforms">
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors",
                  on ? "border-primary bg-brass-soft/70 text-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
                style={{ ["--pi-bg" as string]: on ? "var(--brass-soft)" : "var(--card)" }}
              >
                <PlatformIcon id={p.id} />
                {p.label}
                {on && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
          <span className="text-[12px] text-muted-foreground">
            <span className="tnum">{selected.length}</span> selected · Disclosure <span className="font-medium text-foreground">{disclosure.version}</span> will be appended
          </span>
          <Button onClick={generate} disabled={busy}><Sparkles /> {copies.length ? "Regenerate" : "Generate descriptions"}</Button>
        </div>
      </StepSection>

      <StepSection title="Copy by platform">
        {pending ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : copies.length === 0 ? (
          <EmptyState icon={AlignLeft} title="No descriptions yet" description="One click writes titles, descriptions and hashtags tuned to each platform's limits." action={<Button onClick={generate}><Sparkles /> Generate descriptions</Button>} />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="line" className="scrollbar-thin overflow-x-auto">
              {copies.map((c) => {
                const p = getPlatform(c.platform);
                const total = c.description.length + c.hashtags.join(" #").length + lockedFor(c.platform).length + 4;
                return (
                  <TabsTrigger key={c.platform} value={c.platform} style={{ ["--pi-bg" as string]: "var(--card)" }}>
                    <PlatformIcon id={c.platform} className="!size-3.5" /> {p.label}
                    {total > p.descLimit && <span className="size-1.5 rounded-full bg-destructive" />}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {copies.map((c) => {
              const p = getPlatform(c.platform);
              const locked = lockedFor(c.platform);
              const tagText = c.hashtags.map((h) => `#${h}`).join(" ");
              const total = c.description.length + (tagText ? tagText.length + 2 : 0) + locked.length + 2;
              return (
                <TabsContent key={c.platform} value={c.platform} className="space-y-4 pt-2">
                  {p.titleLimit ? (
                    <div>
                      <FieldLabel hint={<Counter used={c.title?.length ?? 0} limit={p.titleLimit} />}>Title</FieldLabel>
                      <Input value={c.title ?? ""} onChange={(e) => update(c.platform, { title: e.target.value })} />
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">{p.label} doesn&rsquo;t support a separate title — the first line of the description acts as the hook.</p>
                  )}
                  <div>
                    <FieldLabel hint={<Counter used={total} limit={p.descLimit} />}>Description <span className="font-normal text-muted-foreground">(count includes hashtags and disclosure)</span></FieldLabel>
                    <Textarea rows={p.id === "x" ? 3 : 7} value={c.description} onChange={(e) => update(c.platform, { description: e.target.value })} />
                    {total > p.descLimit && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-destructive">
                        <TriangleAlert className="size-3.5" /> Over the {p.label} limit by <span className="tnum">{total - p.descLimit}</span> characters.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel hint={p.hashtagLimit ? `max ${p.hashtagLimit}` : undefined}>Hashtags</FieldLabel>
                      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5">
                        {c.hashtags.map((h) => (
                          <span key={h} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[12px]">
                            <Hash className="size-3 text-muted-foreground" />{h}
                            <button className="cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => update(c.platform, { hashtags: c.hashtags.filter((x) => x !== h) })} aria-label={`Remove ${h}`}><X className="size-3" /></button>
                          </span>
                        ))}
                        <input
                          placeholder="Add…"
                          className="min-w-16 flex-1 bg-transparent text-[12px] outline-none"
                          onKeyDown={(e) => {
                            const v = e.currentTarget.value.replace(/^#/, "").trim();
                            if (e.key === "Enter" && v) {
                              update(c.platform, { hashtags: [...c.hashtags, v] });
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel hint="Resolved at publish">CTA link</FieldLabel>
                      <div className="relative">
                        <Link2 className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8 font-mono text-[12px]" value={c.cta} onChange={(e) => update(c.platform, { cta: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md border border-primary/30 bg-brass-soft/60 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#7d6238] uppercase dark:text-primary">
                        <Lock className="size-3" /> Compliance disclosure · {disclosure.version}
                      </span>
                      <Link href="/profile#disclosures" className="text-[11px] text-muted-foreground hover:text-foreground">Managed in Profile</Link>
                    </div>
                    <p className="text-[12px] leading-relaxed whitespace-pre-line text-foreground/80 select-none">{locked}</p>
                    {c.platform === "x" && (
                      <p className="mt-2 text-[11px] text-muted-foreground">X&rsquo;s 280-character limit can&rsquo;t hold the full disclosure, so a link to your approved disclosures page is used instead.</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText([c.title, c.description, tagText, locked].filter(Boolean).join("\n\n")).catch(() => {});
                        toast.success(`${p.label} copy copied`);
                      }}
                    >
                      <Copy /> Copy all
                    </Button>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
        {copies.length > 0 && !pending && (
          <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => toast.success("Descriptions saved")}>Save draft</Button>
            <Button onClick={() => complete({ platforms: copies.map((c) => c.platform) })}>Continue to Record <ArrowRight /></Button>
          </div>
        )}
      </StepSection>
    </StepLayout>
  );
}
