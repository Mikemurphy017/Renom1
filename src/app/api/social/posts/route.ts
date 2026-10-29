import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { appUrl } from "@/lib/email";
import { SocialError, cancelPost, postsFor, publish } from "@/lib/social/server";
import { SERVICE_OF } from "@/lib/social/types";
import { fileLink } from "@/lib/storage/file-links";
import { getUpload, isStorageId } from "@/lib/video/storage";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";
import type { PlatformId } from "@/lib/types";

export const dynamic = "force-dynamic";

const PLATFORM_IDS = Object.keys(SERVICE_OF) as PlatformId[];
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

/**
 * Post a finished video to the advisor's own Buffer channels, now or at a set time.
 * Body: { videoId, title, outputId, posts: [{ channelId, platform, text, title? }], disclosureVersion, scheduleAt? }
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });

  if (typeof b.postId === "string") return publishPost(request, user, b);

  const outputId = str(b.outputId, 64);
  const rec = isStorageId(outputId) ? await getUpload(outputId) : null;
  const posts = (Array.isArray(b.posts) ? b.posts : [])
    .slice(0, 12)
    .map((p: Record<string, unknown>) => ({ channelId: str(p?.channelId, 64), platform: p?.platform as PlatformId, text: str(p?.text, 10000), title: str(p?.title, 300) || undefined }))
    .filter((p) => p.channelId && PLATFORM_IDS.includes(p.platform) && p.text);
  const at = typeof b.scheduleAt === "string" ? Date.parse(b.scheduleAt) : NaN;
  const schedule = !Number.isNaN(at);

  const errors: string[] = [];
  if (!str(b.videoId, 80)) errors.push("videoId is required.");
  if (!rec) errors.push("Finish the edit first: there's no video to post.");
  if (!posts.length) errors.push("Pick at least one of your channels.");
  if (schedule && at < Date.now() + 5 * 60_000) errors.push("Pick a time at least 5 minutes from now.");
  if (schedule && at > Date.now() + MAX_AHEAD_DAYS * 86400_000) errors.push(`Pick a time within the next ${MAX_AHEAD_DAYS} days.`);
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  try {
    // Buffer fetches the video from here; the link lasts a few days past the post time.
    const until = (schedule ? at : Date.now()) + 3 * 86400_000;
    const ext = rec!.mimeType.includes("mp4") ? "mp4" : rec!.mimeType.includes("quicktime") ? "mov" : "webm";
    const result = await publish(user, {
      videoId: str(b.videoId, 80),
      title: str(b.title, 200) || "New video",
      videoUrl: fileLink(appUrl(request), "v", rec!.id, until, ext),
      posts,
      disclosureVersion: str(b.disclosureVersion, 40) || "none",
      scheduleAt: schedule ? new Date(at).toISOString() : undefined,
      // A video that starts on its cover: the first frame is the thumbnail.
      thumbnailOffsetMs: rec!.coverIntro ? 0 : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}

/** Where text and image posts can go: these take a post without a video. */
const POST_PLATFORMS: PlatformId[] = ["linkedin", "facebook", "instagram", "x"];

/**
 * A text or image post to the advisor's own channels.
 * Body: { postId, title, imageId?, posts: [{ channelId, platform, text }], disclosureVersion, scheduleAt? }
 */
async function publishPost(request: Request, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, b: Record<string, unknown>) {
  const postId = str(b.postId, 80);
  const imageId = isMediaId(b.imageId) ? (b.imageId as string) : null;
  const image = imageId ? await objects().stat(mediaKey(imageId)).catch(() => null) : null;
  const posts = (Array.isArray(b.posts) ? b.posts : [])
    .slice(0, 12)
    .map((p: Record<string, unknown>) => ({ channelId: str(p?.channelId, 64), platform: p?.platform as PlatformId, text: str(p?.text, 10000) }))
    .filter((p) => p.channelId && POST_PLATFORMS.includes(p.platform) && p.text);
  const at = typeof b.scheduleAt === "string" ? Date.parse(b.scheduleAt) : NaN;
  const schedule = !Number.isNaN(at);

  const errors: string[] = [];
  if (!/^p[a-z0-9]{4,40}$/.test(postId)) errors.push("postId is required.");
  if (b.imageId !== undefined && b.imageId !== null && !image) errors.push("That picture couldn’t be found. Add it again.");
  if (!image && posts.some((p) => p.platform === "instagram")) errors.push("Instagram needs a picture.");
  if (!posts.length) errors.push("Pick at least one of your channels.");
  if (schedule && at < Date.now() + 5 * 60_000) errors.push("Pick a time at least 5 minutes from now.");
  if (schedule && at > Date.now() + MAX_AHEAD_DAYS * 86400_000) errors.push(`Pick a time within the next ${MAX_AHEAD_DAYS} days.`);
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });

  try {
    // Buffer fetches the picture from here; the link lasts a few days past the post time.
    const until = (schedule ? at : Date.now()) + 3 * 86400_000;
    const ext = image?.contentType.includes("png") ? "png" : image?.contentType.includes("webp") ? "webp" : "jpg";
    const result = await publish(user, {
      videoId: postId,
      title: str(b.title, 200) || "New post",
      imageUrl: image ? fileLink(appUrl(request), "c", imageId!, until, ext) : undefined,
      posts,
      disclosureVersion: str(b.disclosureVersion, 40) || "none",
      scheduleAt: schedule ? new Date(at).toISOString() : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
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
