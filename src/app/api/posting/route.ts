import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { allRequests, requestsFor, submitRequest, updateRequest } from "@/lib/posting/server";
import type { PostRequestCaption, PostRequestCover, PostRequestTiming } from "@/lib/posting/types";
import type { PlatformId } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATFORM_IDS: PlatformId[] = ["youtube", "youtube_shorts", "instagram", "tiktok", "facebook", "linkedin", "x"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Links in a request must point at this app's own files. */
const appPath = (v: unknown) => typeof v === "string" && /^\/api\/[A-Za-z0-9/_.-]{1,200}$/.test(v);

/** The signed-in advisor's posting requests (optionally for one video). */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const videoId = new URL(request.url).searchParams.get("videoId");
  const requests = (await requestsFor(user.id)).filter((r) => !videoId || r.videoId === videoId);
  return NextResponse.json({ ok: true, requests }, { headers: { "Cache-Control": "no-store" } });
}

/** Ask the team to post a finished video. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const out = b.output as Record<string, unknown> | undefined;
  const platforms = (Array.isArray(b.platforms) ? b.platforms : []).filter((p): p is PlatformId => PLATFORM_IDS.includes(p as PlatformId));
  const captions: PostRequestCaption[] = (Array.isArray(b.captions) ? b.captions : [])
    .slice(0, 10)
    .map((c: Record<string, unknown>) => ({ platform: c?.platform as PlatformId, text: str(c?.text, 10000), title: str(c?.title, 300) || undefined }))
    .filter((c) => PLATFORM_IDS.includes(c.platform) && c.text);
  const covers: PostRequestCover[] = (Array.isArray(b.covers) ? b.covers : [])
    .slice(0, 2)
    .filter((c: Record<string, unknown>) => appPath(c?.url) && (c?.shape === "short" || c?.shape === "long"))
    .map((c: Record<string, unknown>) => ({ shape: c.shape as "short", url: c.url as string, frameMs: Number.isInteger(c.frameMs) ? (c.frameMs as number) : undefined }));
  const t = b.timing as Record<string, unknown> | undefined;
  const timing: PostRequestTiming = t?.kind === "at" && typeof t.at === "string" && !Number.isNaN(Date.parse(t.at)) ? { kind: "at", at: new Date(t.at).toISOString() } : { kind: "asap" };

  const errors: string[] = [];
  if (!str(b.videoId, 80)) errors.push("videoId is required");
  if (!out || typeof out.id !== "string" || !/^[A-Za-z0-9_-]{4,64}$/.test(out.id) || !appPath(out.url)) errors.push("Finish the edit first: there's no video to post.");
  if (!platforms.length) errors.push("Pick at least one platform.");
  if (!captions.length) errors.push("Write the captions first.");
  if (timing.kind === "at" && Date.parse(timing.at!) < Date.now()) errors.push("Pick a time in the future.");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  const req = await submitRequest(user, {
    advisorName: str(b.advisorName, 120) || user.name,
    videoId: str(b.videoId, 80),
    title: str(b.title, 200) || "Untitled video",
    format: b.format === "long" ? "long" : "short",
    output: { id: out!.id as string, url: out!.url as string, aspect: out!.aspect === "16:9" ? "16:9" : "9:16", durationSec: Number(out!.durationSec) || 0 },
    covers,
    platforms,
    captions,
    disclosureVersion: str(b.disclosureVersion, 40) || "none",
    timing,
    note: str(b.note, 2000) || undefined,
  });
  return NextResponse.json({ ok: true, request: req });
}

/** Withdraw a request the team hasn't picked up yet. */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const r = (await allRequests()).find((x) => x.id === id && x.userId === user.id);
  if (!r) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  if (r.status !== "submitted" && r.status !== "returned") return NextResponse.json({ ok: false, error: "The team has already scheduled this one. Message them to change it." }, { status: 409 });
  await updateRequest(id, { status: "cancelled" });
  return NextResponse.json({ ok: true });
}
