import { NextResponse } from "next/server";
import { bufferConfigured, createBufferPost, listPosts } from "@/lib/buffer/server";
import { fail, fromError, isBufferId, listParam, notConnected, parseDate, SERVICES } from "@/lib/buffer/route";
import { BUFFER_POST_STATUSES, type BufferPostStatus, type CreateBufferPostRequest, type ListBufferPostsParams } from "@/lib/buffer/types";

export const dynamic = "force-dynamic";
const isHttpsUrl = (u: unknown) => {
  if (typeof u !== "string") return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * GET /api/buffer/posts?status=scheduled,sent&channelId=…&tagId=…&from=ISO&to=ISO&sort=dueAt|createdAt&direction=asc|desc&first=20&after=cursor
 * Lists posts in the organization, newest page first by the chosen sort. `from`/`to` bound dueAt.
 */
export async function GET(request: Request) {
  const off = notConnected();
  if (off) return off;
  const q = new URL(request.url).searchParams;
  const errors: string[] = [];

  const status = listParam(q, "status");
  if (status.some((s) => !(BUFFER_POST_STATUSES as readonly string[]).includes(s))) errors.push(`status must be one of ${BUFFER_POST_STATUSES.join(", ")}`);
  const channelIds = listParam(q, "channelId");
  if (!channelIds.every(isBufferId)) errors.push("channelId is invalid");
  const tagIds = listParam(q, "tagId");
  if (!tagIds.every(isBufferId)) errors.push("tagId is invalid");

  const from = q.get("from") ? parseDate(q.get("from")) : undefined;
  const to = q.get("to") ? parseDate(q.get("to")) : undefined;
  if (from === null) errors.push("from must be a date");
  if (to === null) errors.push("to must be a date");
  if (from && to && from > to) errors.push("from must be before to");

  const sort = q.get("sort") ?? "dueAt";
  if (!["dueAt", "createdAt"].includes(sort)) errors.push("sort must be dueAt or createdAt");
  const direction = q.get("direction") ?? "asc";
  if (!["asc", "desc"].includes(direction)) errors.push("direction must be asc or desc");
  const first = q.has("first") ? Number(q.get("first")) : 20;
  if (!Number.isInteger(first) || first < 1 || first > 100) errors.push("first must be 1–100");
  const after = q.get("after") ?? undefined;
  if (after !== undefined && !/^[A-Za-z0-9+/=_-]{1,512}$/.test(after)) errors.push("after is invalid");
  if (errors.length) return fail(errors.join("; "));

  try {
    const params: ListBufferPostsParams = {
      status: status as BufferPostStatus[],
      channelIds,
      tagIds,
      dueFrom: from ?? undefined,
      dueTo: to ?? undefined,
      sort: sort as ListBufferPostsParams["sort"],
      direction: direction as ListBufferPostsParams["direction"],
      first,
      after,
    };
    return NextResponse.json({ ok: true, ...(await listPosts(params)) });
  } catch (e) {
    return fromError(e);
  }
}

/** POST /api/buffer/posts creates one post (see CreateBufferPostRequest). */
export async function POST(request: Request) {
  if (!bufferConfigured()) return NextResponse.json({ ok: false, error: "Buffer is not connected" }, { status: 503 });

  let body: Partial<CreateBufferPostRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const errors: string[] = [];
  if (!isBufferId(body.channelId)) errors.push("channelId is invalid");
  if (!body.service || !SERVICES.includes(body.service)) errors.push("service is invalid");
  if (typeof body.text !== "string" || !body.text.trim()) errors.push("text is required");
  else if (body.text.length > 10000) errors.push("text is too long");
  if (!body.mode || !["draft", "now", "schedule", "queue"].includes(body.mode)) errors.push("mode is invalid");
  if (body.mode === "schedule") {
    const t = body.dueAt ? Date.parse(body.dueAt) : NaN;
    if (Number.isNaN(t)) errors.push("dueAt is required to schedule");
    else if (t < Date.now() + 60_000) errors.push("dueAt must be in the future");
  }
  if (body.videoUrl && !isHttpsUrl(body.videoUrl)) errors.push("videoUrl must be a public https:// link");
  if (body.thumbnailOffsetMs !== undefined && !(Number.isInteger(body.thumbnailOffsetMs) && body.thumbnailOffsetMs >= 0 && body.thumbnailOffsetMs < 3_600_000)) errors.push("thumbnailOffsetMs is invalid");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });

  const result = await createBufferPost({
    channelId: body.channelId!,
    service: body.service!,
    text: body.text!,
    mode: body.mode!,
    dueAt: body.mode === "schedule" ? new Date(body.dueAt!).toISOString() : undefined,
    videoUrl: body.videoUrl || undefined,
    thumbnailOffsetMs: body.thumbnailOffsetMs,
    title: typeof body.title === "string" ? body.title : undefined,
    draft: !!body.draft,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
