"use client";

/* eslint-disable @next/next/no-img-element -- the advisor's own pictures */
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, CircleCheck, Copy, Download, ExternalLink, ImagePlus, LoaderCircle, Plug, Send, Sparkles, TriangleAlert, Type, Image as ImageIcon, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PlatformIcon } from "@/components/shared/platform-icon";
import { AskBar } from "@/components/studio/ask-bar";
import { useStore, voiceProfileOf } from "@/lib/store";
import { isAbort, useWriter } from "@/lib/ai/writer";
import { activeDisclosure, composeCaption } from "@/lib/compose";
import { getPlatform } from "@/lib/mock/platforms";
import { uploadImage } from "@/lib/media/upload";
import { SERVICE_OF } from "@/lib/social/types";
import { connectBuffer, publishPost, useSocialPosts, useSocialStatus } from "@/lib/social/use-social";
import { POST_PLATFORMS, type PostAspect, type PostCopy, type PostDraft, type PostImage, type PostPlatform } from "@/lib/types";
import { cn, fmtDateTime } from "@/lib/utils";

const ASPECTS: { id: PostAspect; label: string }[] = [
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "Portrait" },
  { id: "16:9", label: "Landscape" },
];
const aspectClass = (a?: PostAspect) => (a === "4:5" ? "aspect-[4/5]" : a === "16:9" ? "aspect-video" : "aspect-square");

/** The finished text for one platform: the post, hashtags, booking link and disclosure. */
function finalText(c: PostCopy, profile: ReturnType<typeof useStore>["profile"]) {
  return composeCaption({ description: c.text, hashtags: c.hashtags }, c.platform, profile, profile.calendarUrl);
}

function Step({ n, title, desc, children, right }: { n: number; title: string; desc?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-navy-foreground dark:bg-primary dark:text-primary-foreground">{n}</span>
            <h2 className="text-[16px] font-semibold">{title}</h2>
          </div>
          {desc && <p className="mt-1 ml-8 text-[13px] text-muted-foreground">{desc}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PostComposer({ id }: { id: string }) {
  const { posts, updatePost, profile, hydrated } = useStore();
  const post = posts.find((p) => p.id === id);
  if (!hydrated) return <div className="flex items-center gap-2 py-16 text-[14px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading…</div>;
  if (!post)
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-xl">This post isn’t here anymore</p>
        <Link href="/posts" className="mt-3 inline-block text-[14px] text-primary underline underline-offset-2">Back to posts</Link>
      </div>
    );
  return <Composer post={post} update={(patch) => updatePost(post.id, patch)} profile={profile} />;
}

function Composer({ post, update, profile }: { post: PostDraft; update: (patch: Partial<PostDraft> | ((p: PostDraft) => Partial<PostDraft>)) => void; profile: ReturnType<typeof useStore>["profile"] }) {
  const { posts } = useStore();
  const { write, busy, status } = useWriter();
  const [tab, setTab] = React.useState<PostPlatform>(post.copy[0]?.platform ?? post.platforms[0] ?? "linkedin");
  const image = post.kind === "image";
  const allowed = POST_PLATFORMS.filter((p) => image || p !== "instagram");
  const chosen = post.platforms.filter((p) => allowed.includes(p));

  const generate = async (instruction?: string) => {
    if (!post.topic.trim()) return toast.error("Say what the post is about first.");
    if (!chosen.length) return toast.error("Pick at least one platform.");
    try {
      const others = posts.filter((p) => p.id !== post.id && p.copy[0]?.text).slice(0, 15).map((p) => p.copy[0].text.split("\n")[0].slice(0, 200));
      const out = await write({ task: "post", profile: voiceProfileOf(profile), topic: post.topic, kind: post.kind, platforms: chosen, others, current: instruction && post.copy.length ? post.copy : undefined, instruction });
      const copy = out.posts.filter((p) => chosen.includes(p.platform)).map((p) => ({ platform: p.platform, text: p.text, hashtags: p.hashtags.map((h) => h.replace(/^#/, "")) }));
      update({ copy, imageIdea: out.imageScene || post.imageIdea });
      setTab(copy[0]?.platform ?? chosen[0]);
    } catch (e) {
      if (!isAbort(e)) toast.error("Couldn’t write the post", { description: (e as Error).message });
    }
  };

  const setCopy = (platform: PostPlatform, patch: Partial<PostCopy>) => update((p) => ({ copy: p.copy.map((c) => (c.platform === platform ? { ...c, ...patch } : c)) }));
  const current = post.copy.find((c) => c.platform === tab) ?? post.copy[0];

  return (
    <div className="mx-auto max-w-[880px] space-y-5 pb-24">
      <Link href="/posts" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Posts</Link>
      <div>
        <h1 className="font-serif text-[30px] leading-tight sm:text-[36px]">{image ? "Text + image post" : "Text post"}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">Written in your voice, with your disclosure added when it goes out.</p>
      </div>

      <Step n={1} title="What’s it about?">
        <Textarea
          rows={2}
          value={post.topic}
          onChange={(e) => update({ topic: e.target.value })}
          placeholder="e.g. Why a Roth conversion in your early 60s can save you thousands"
          className="font-serif text-[18px]"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" value={post.kind} onValueChange={(v) => v && update({ kind: v as PostDraft["kind"] })} className="rounded-full">
            <ToggleGroupItem value="text" className="rounded-full"><Type /> Text only</ToggleGroupItem>
            <ToggleGroupItem value="image" className="rounded-full"><ImageIcon /> Text + image</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex flex-wrap gap-1.5">
            {POST_PLATFORMS.map((p) => {
              const on = chosen.includes(p);
              const off = !allowed.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  disabled={off}
                  title={off ? "Instagram posts need a picture: switch to Text + image" : undefined}
                  onClick={() => update({ platforms: on ? post.platforms.filter((x) => x !== p) : [...post.platforms, p] })}
                  className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40", on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <PlatformIcon id={p} className="size-3.5" /> {getPlatform(p).short}
                </button>
              );
            })}
          </div>
          <Button className="ml-auto rounded-full px-5" disabled={busy} onClick={() => generate()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {post.copy.length ? "Write it again" : "Write the post"}
          </Button>
        </div>
        {busy && status && <p className="mt-3 text-[13px] text-muted-foreground">{status}</p>}
      </Step>

      {post.copy.length > 0 && (
        <Step n={2} title="The words" desc="Edit anything. Hashtags, your booking link and disclosure are added when it goes out.">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.copy.map((c) => (
              <button key={c.platform} type="button" onClick={() => setTab(c.platform)} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors", tab === c.platform ? "bg-navy text-navy-foreground dark:bg-primary dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <PlatformIcon id={c.platform} className="size-3.5" /> {getPlatform(c.platform).short}
              </button>
            ))}
          </div>
          {current && (
            <div className="space-y-3">
              <Textarea rows={Math.min(16, Math.max(5, current.text.split("\n").length + 2))} value={current.text} onChange={(e) => setCopy(current.platform, { text: e.target.value })} className="text-[14px] leading-relaxed" />
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[12px] text-muted-foreground">Hashtags</span>
                <Input value={current.hashtags.map((h) => `#${h}`).join(" ")} onChange={(e) => setCopy(current.platform, { hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#/, "")).filter(Boolean) })} className="h-8 text-[13px]" />
              </div>
              {current.platform === "x" && finalText(current, profile).length > 280 && (
                <p className="flex items-center gap-1.5 text-[12px] text-destructive"><TriangleAlert className="size-3.5" /> {finalText(current, profile).length - 280} characters over X’s limit, with the disclosure.</p>
              )}
            </div>
          )}
          <div className="mt-4">
            <AskBar busy={busy} status={status} onAsk={(t) => generate(t)} suggestions={["Shorter", "More personal", "Add a client story", "Stronger first line"]} placeholder="Ask for changes…" />
          </div>
        </Step>
      )}

      {image && post.copy.length > 0 && <ImageStep post={post} update={update} />}

      {post.copy.length > 0 && <PublishStep post={post} update={update} n={image ? 4 : 3} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The picture                                                         */
/* ------------------------------------------------------------------ */

type Scene = { id: string; label: string; brief: string };

function ImageStep({ post, update }: { post: PostDraft; update: (patch: Partial<PostDraft> | ((p: PostDraft) => Partial<PostDraft>)) => void }) {
  const { profile } = useStore();
  const headshots = profile.headshots.filter((h) => h.url);
  const [mode, setMode] = React.useState<"ai" | "upload">("ai");
  const [scenes, setScenes] = React.useState<Scene[]>([]);
  const [configured, setConfigured] = React.useState<boolean | null>(null);
  const [scene, setScene] = React.useState(post.imageIdea ?? "");
  const [aspect, setAspect] = React.useState<PostAspect>(post.image?.aspect ?? (post.platforms.includes("instagram") ? "4:5" : "1:1"));
  const [making, setMaking] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/posts/image", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        setConfigured(!!j.configured);
        setScenes(j.scenes ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);
  // Claude's suggestion fills the box the first time it arrives.
  React.useEffect(() => {
    if (post.imageIdea) setScene((s) => s || post.imageIdea!);
  }, [post.imageIdea]);

  const add = (img: PostImage) => update((p) => ({ image: img, images: [img, ...(p.images ?? []).filter((x) => x.id !== img.id)].slice(0, 12) }));

  const make = async () => {
    setMaking(true);
    try {
      const res = await fetch("/api/posts/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ headshots: headshots.slice(0, 4).map((h) => h.id), scene, aspect }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "Couldn’t make the image.");
      add(j.image as PostImage);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMaking(false);
    }
  };

  const upload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadImage(file, "thumbnail", "post");
      add({ id: up.id, url: up.url, source: "upload" });
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const gallery = post.images ?? (post.image ? [post.image] : []);

  return (
    <Step n={3} title="The picture" desc="A photo of you made from your headshots, or one of your own.">
      <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "ai" | "upload")} className="mb-4 rounded-full">
        <ToggleGroupItem value="ai" className="rounded-full"><Wand2 /> AI photo of you</ToggleGroupItem>
        <ToggleGroupItem value="upload" className="rounded-full"><ImagePlus /> Upload your own</ToggleGroupItem>
      </ToggleGroup>

      {mode === "ai" ? (
        configured === false ? (
          <p className="text-[13px] text-muted-foreground">AI images aren’t set up for this studio yet (it needs a Gemini key). You can upload your own picture instead.</p>
        ) : !headshots.length ? (
          <p className="text-[13px] text-muted-foreground">
            The picture is made from your headshots. <Link href="/settings#covers" className="text-primary underline underline-offset-2">Add 2–4 headshots in Settings</Link>, then come back.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {post.imageIdea && (
                <button type="button" onClick={() => setScene(post.imageIdea!)} className={cn("flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-[12px]", scene === post.imageIdea ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
                  <Sparkles className="size-3" /> Fits this post
                </button>
              )}
              {scenes.map((s) => (
                <button key={s.id} type="button" onClick={() => setScene(s.brief)} className={cn("cursor-pointer rounded-full border px-3 py-1 text-[12px]", scene === s.brief ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}>
                  {s.label}
                </button>
              ))}
            </div>
            <Textarea rows={2} value={scene} onChange={(e) => setScene(e.target.value)} placeholder="Describe the scene: e.g. presenting a chart to clients in a glass-walled boardroom" className="text-[13px]" />
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup type="single" value={aspect} onValueChange={(v) => v && setAspect(v as PostAspect)}>
                {ASPECTS.map((a) => <ToggleGroupItem key={a.id} value={a.id} className="text-[12px]">{a.label}</ToggleGroupItem>)}
              </ToggleGroup>
              <Button className="ml-auto rounded-full" disabled={making || scene.trim().length < 8} onClick={make}>
                {making ? <><LoaderCircle className="animate-spin" /> Making it (about 20 seconds)…</> : <><Wand2 /> {gallery.some((g) => g.source === "ai") ? "Make another" : "Make the picture"}</>}
              </Button>
            </div>
            <p className="text-[12px] text-muted-foreground">AI-made: check it looks like you before you post it.</p>
          </div>
        )
      ) : (
        <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center text-[13px] text-muted-foreground hover:border-primary/50 hover:text-foreground", uploading && "pointer-events-none opacity-60")}>
          {uploading ? <LoaderCircle className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          {uploading ? "Uploading…" : "Choose a photo (PNG, JPEG or WebP)"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      )}

      {gallery.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[12px] text-muted-foreground">{gallery.length > 1 ? "Pick the one to post" : "Your picture"}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((g) => {
              const on = post.image?.id === g.id;
              return (
                <button key={g.id} type="button" onClick={() => update({ image: g })} className={cn("group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-colors", on ? "border-primary" : "border-transparent hover:border-border")} aria-pressed={on}>
                  <div className={cn("relative bg-muted", aspectClass(g.aspect))}>
                    <img src={g.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  {on && <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}
                  <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{g.source === "ai" ? "AI" : "Yours"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Step>
  );
}

/* ------------------------------------------------------------------ */
/* Preview and posting                                                 */
/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (d: Date) => ({ date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` });

function PublishStep({ post, update, n }: { post: PostDraft; update: (patch: Partial<PostDraft>) => void; n: number }) {
  const { profile } = useStore();
  const { status } = useSocialStatus();
  const { posts: sent, setPosts } = useSocialPosts(post.id);
  const [preview, setPreview] = React.useState<PostPlatform>(post.copy[0].platform);
  const [when, setWhen] = React.useState<"now" | "at">("now");
  const later = localParts(new Date(Date.now() + 3600_000));
  const [date, setDate] = React.useState(later.date);
  const [time, setTime] = React.useState(later.time);
  const [off, setOff] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const needsImage = post.kind === "image" && !post.image;
  const c = post.copy.find((x) => x.platform === preview) ?? post.copy[0];
  const text = finalText(c, profile);
  const initials = profile.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Keep the post's status in step with what went out.
  React.useEffect(() => {
    if (!sent?.length) return;
    const live = sent.filter((p) => p.status !== "cancelled" && p.status !== "failed");
    const posted = live.find((p) => p.status === "posted");
    const next = live.filter((p) => p.status === "scheduled" && p.scheduledFor).map((p) => p.scheduledFor!).sort()[0];
    if (posted && post.status !== "published") update({ status: "published", publishedAt: posted.postedAt ?? posted.createdAt });
    else if (!posted && next && (post.status !== "scheduled" || post.scheduledFor !== next)) update({ status: "scheduled", scheduledFor: next });
  }, [sent, post.status, post.scheduledFor, update]);

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn’t copy", { description: "Select the text and copy it instead." });
    }
  };

  const targets = (status?.channels ?? [])
    .filter((ch) => !ch.disconnected)
    .flatMap((ch) => {
      const platform = post.copy.find((x) => SERVICE_OF[x.platform] === ch.service)?.platform;
      return platform && (platform !== "instagram" || post.image) ? [{ channel: ch, platform }] : [];
    });
  const picked = targets.filter((t) => !off.includes(t.channel.id));
  const at = when === "at" ? new Date(`${date}T${time}`) : null;
  const blocker = needsImage ? "Add the picture first." : !picked.length ? "Pick at least one of your channels." : at && (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 5 * 60_000) ? "Pick a time at least 5 minutes from now." : null;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await publishPost({
        postId: post.id,
        title: post.topic.slice(0, 120),
        imageId: post.kind === "image" ? post.image?.id : undefined,
        posts: picked.map(({ channel, platform }) => ({ channelId: channel.id, platform, text: finalText(post.copy.find((x) => x.platform === platform)!, profile) })),
        disclosureVersion: activeDisclosure(profile)?.version ?? "none",
        scheduleAt: at ? at.toISOString() : undefined,
      });
      setPosts((cur) => [...r.posts, ...(cur ?? [])]);
      if (r.posts.length) toast.success(at ? `Scheduled for ${fmtDateTime(at.toISOString())}` : "Posting now", { description: r.posts.map((p) => p.channelName).join(", ") });
      for (const e of r.errors) toast.error(`${getPlatform(e.platform).label}: ${e.error}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Step n={n} title="Preview & post">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {post.copy.map((x) => (
              <button key={x.platform} type="button" onClick={() => setPreview(x.platform)} className={cn("flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]", preview === x.platform ? "bg-muted font-medium text-foreground" : "text-muted-foreground")}>
                <PlatformIcon id={x.platform} className="size-3" /> {getPlatform(x.platform).short}
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex items-center gap-2.5 px-4 pt-3.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D2B07A] to-[#9C7A47] font-serif text-[13px] text-[#0B1F3A]">{initials || "·"}</span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{profile.name || "You"}</div>
                <div className="truncate text-[11px] text-muted-foreground">{[profile.credentials, profile.firm].filter(Boolean).join(" · ") || "Just now"}</div>
              </div>
            </div>
            <p className="max-h-72 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap">{text}</p>
            {post.kind === "image" && (post.image ? <img src={post.image.url} alt="" className={cn("w-full object-cover", aspectClass(post.image.aspect))} /> : <div className="flex aspect-video items-center justify-center bg-muted text-[12px] text-muted-foreground">Your picture goes here</div>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => copy(`${getPlatform(c.platform).short} text`, text)}><Copy /> Copy text</Button>
            {post.image && (
              <Button size="sm" variant="outline" className="rounded-full" asChild>
                <a href={post.image.url} download={`post-${post.id}.jpg`}><Download /> Download picture</a>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {!status ? (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Checking your Buffer…</div>
          ) : !status.available || !status.connected ? (
            <div className="rounded-xl border border-border p-4">
              <div className="text-[14px] font-medium">Post it from here</div>
              <p className="mt-1 text-[13px] text-muted-foreground">Connect your Buffer to post or schedule to your own channels. Or copy the text{post.image ? " and download the picture" : ""} and post it yourself.</p>
              {status.available && <Button size="sm" className="mt-3 rounded-full" onClick={() => connectBuffer(`/posts/${post.id}`)}><Plug /> Connect Buffer</Button>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[13px] font-medium">Your channels</div>
              {!targets.length && <p className="text-[13px] text-muted-foreground">None of your Buffer channels match these platforms{post.kind === "text" ? " (Instagram needs a picture)" : ""}.</p>}
              {targets.map(({ channel, platform }) => (
                <label key={channel.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2">
                  <input type="checkbox" checked={!off.includes(channel.id)} onChange={(e) => setOff((o) => (e.target.checked ? o.filter((x) => x !== channel.id) : [...o, channel.id]))} className="size-4 accent-[var(--primary)]" />
                  <PlatformIcon id={platform} className="size-4" />
                  <span className="truncate text-[13px]">{channel.name}</span>
                </label>
              ))}
              <ToggleGroup type="single" value={when} onValueChange={(v) => v && setWhen(v as "now" | "at")} className="w-full">
                <ToggleGroupItem value="now" className="flex-1"><Send /> Post now</ToggleGroupItem>
                <ToggleGroupItem value="at" className="flex-1"><CalendarClock /> Schedule</ToggleGroupItem>
              </ToggleGroup>
              {when === "at" && (
                <div className="flex gap-2">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              )}
              {blocker && <p className="text-[12px] text-muted-foreground">{blocker}</p>}
              <Button className="w-full rounded-full" disabled={busy || !!blocker} onClick={submit}>
                {busy ? <LoaderCircle className="animate-spin" /> : at ? <CalendarClock /> : <Send />} {at ? "Schedule it" : "Post it now"}
              </Button>
            </div>
          )}

          {!!sent?.length && (
            <ul className="space-y-1.5">
              {sent.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[12px]">
                  <PlatformIcon id={s.platform} className="size-3.5" />
                  <span className="truncate">{s.channelName}</span>
                  <span className={cn("ml-auto", s.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                    {s.status === "posted" ? <span className="inline-flex items-center gap-1 text-success"><CircleCheck className="size-3.5" /> Posted</span> : s.status === "scheduled" && s.scheduledFor ? `Scheduled ${fmtDateTime(s.scheduledFor)}` : s.status === "failed" ? s.error || "Failed" : s.status}
                  </span>
                  {s.postUrl && <a href={s.postUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-3.5" /></a>}
                </li>
              ))}
            </ul>
          )}

          {post.status !== "published" && (
            <button type="button" className="cursor-pointer text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => update({ status: "published", publishedAt: new Date().toISOString() })}>
              I posted it myself: mark as posted
            </button>
          )}
        </div>
      </div>
    </Step>
  );
}
