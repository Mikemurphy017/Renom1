import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { appUrl } from "@/lib/email";
import { SocialError, cancelPost, fileLink, postsFor, publish, socialStatus } from "@/lib/social/ayrshare";
import { NETWORK } from "@/lib/social/types";
import { isMediaId } from "@/lib/storage/media";
import { getUpload, isStorageId } from "@/lib/video/storage";
import type { PlatformId } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATFORM_IDS = Object.keys(NETWORK) as PlatformId[];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** How far ahead a post can be scheduled. */
const MAX_AHEAD_DAYS = 90;

const fail = (e: unknown) => NextResponse.json({ ok: false, error: e instanceof SocialError ? e.message : "Something went wrong." }, { status: e instanceof SocialError ? e.status : 500 });

/** The advisor's own posts (?videoId= for one video), with in-flight ones re-checked. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const videoId = new URL(request.url).searchParams.get("videoId") ?? undefined;
    return NextResponse.json({ ok: true, posts: await postsFor(user, videoId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/** Post a finished video to the advisor's connected accounts, now or at a set time. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  const outputId = str(b.outputId, 64);
  const rec = isStorageId(outputId) ? await getUpload(outputId) : null;
  const captions = (Array.isArray(b.captions) ? b.captions : [])
    .slice(0, 10)
    .map((c: Record<string, unknown>) => ({ platform: c?.platform as PlatformId, text: str(c?.text, 10000), title: str(c?.title, 300) || undefined }))
    .filter((c) => PLATFORM_IDS.includes(c.platform) && c.text);
  const at = typeof b.scheduleAt === "string" ? Date.parse(b.scheduleAt) : NaN;
  const schedule = !Number.isNaN(at);

  const errors: string[] = [];
  if (!str(b.videoId, 80)) errors.push("videoId is required.");
  if (!rec) errors.push("Finish the edit first: there's no video to post.");
  if (!captions.length) errors.push("Write the captions first.");
  if (schedule && at < Date.now() + 5 * 60_000) errors.push("Pick a time at least 5 minutes from now.");
  if (schedule && at > Date.now() + MAX_AHEAD_DAYS * 86400_000) errors.push(`Pick a time within the next ${MAX_AHEAD_DAYS} days.`);
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  try {
    // Only post where the advisor has an account connected.
    const status = await socialStatus(user);
    if (!status.configured) throw new SocialError("Posting to your accounts isn't set up for this studio yet.", 503);
    const have = new Set(status.accounts.map((a) => a.network));
    const missing = captions.filter((c) => !have.has(NETWORK[c.platform]));
    if (missing.length === captions.length) throw new SocialError("Connect the accounts you want to post to first.", 400);

    const origin = appUrl(request);
    // Links stay valid a few days past the post time, in case a network fetches late.
    const until = (schedule ? at : Date.now()) + 3 * 86400_000;
    const covers: Partial<Record<"short" | "long", string>> = {};
    const raw = (b.covers ?? {}) as Record<string, unknown>;
    for (const shape of ["short", "long"] as const) if (isMediaId(raw[shape])) covers[shape] = fileLink(origin, "c", raw[shape] as string, until, "jpg");

    const result = await publish(user, {
      videoId: str(b.videoId, 80),
      title: str(b.title, 200) || "New video",
      format: b.format === "long" ? "long" : "short",
      videoUrl: fileLink(origin, "v", rec!.id, until, rec!.mimeType.includes("mp4") ? "mp4" : rec!.mimeType.includes("quicktime") ? "mov" : "webm"),
      covers,
      captions: captions.filter((c) => have.has(NETWORK[c.platform])),
      disclosureVersion: str(b.disclosureVersion, 40) || "none",
      scheduleAt: schedule ? new Date(at).toISOString() : undefined,
    });
    return NextResponse.json({
      ok: true,
      posts: result.posts,
      errors: [...result.errors, ...missing.map((m) => ({ platform: m.platform, error: "Not connected." }))],
    });
  } catch (e) {
    return fail(e);
  }
}

/** Cancel a scheduled post (?id=). */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(id)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, post: await cancelPost(user, id) });
  } catch (e) {
    return fail(e);
  }
}
