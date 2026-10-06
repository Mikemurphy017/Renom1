import { NextResponse } from "next/server";
import { bufferConfigured, createBufferPost } from "@/lib/buffer/server";
import type { BufferService, CreateBufferPostRequest } from "@/lib/buffer/types";

export const dynamic = "force-dynamic";

const SERVICES: BufferService[] = ["bluesky", "facebook", "googlebusiness", "instagram", "linkedin", "mastodon", "pinterest", "startPage", "substack", "threads", "tiktok", "twitter", "whatsapp", "youtube"];
const isHttpsUrl = (u: unknown) => {
  if (typeof u !== "string") return false;
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  if (!bufferConfigured()) return NextResponse.json({ ok: false, error: "Buffer is not connected" }, { status: 503 });

  let body: Partial<CreateBufferPostRequest>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const errors: string[] = [];
  if (typeof body.channelId !== "string" || !/^[a-f\d]{24}$/i.test(body.channelId)) errors.push("channelId is invalid");
  if (!body.service || !SERVICES.includes(body.service)) errors.push("service is invalid");
  if (typeof body.text !== "string" || !body.text.trim()) errors.push("text is required");
  else if (body.text.length > 10000) errors.push("text is too long");
  if (!body.mode || !["now", "schedule", "queue"].includes(body.mode)) errors.push("mode is invalid");
  if (body.mode === "schedule") {
    const t = body.dueAt ? Date.parse(body.dueAt) : NaN;
    if (Number.isNaN(t)) errors.push("dueAt is required to schedule");
    else if (t < Date.now() + 60_000) errors.push("dueAt must be in the future");
  }
  if (body.videoUrl && !isHttpsUrl(body.videoUrl)) errors.push("videoUrl must be a public https:// link");
  if (body.thumbnailUrl && !isHttpsUrl(body.thumbnailUrl)) errors.push("thumbnailUrl must be a public https:// link");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join("; ") }, { status: 400 });

  const result = await createBufferPost({
    channelId: body.channelId!,
    service: body.service!,
    text: body.text!,
    mode: body.mode!,
    dueAt: body.mode === "schedule" ? new Date(body.dueAt!).toISOString() : undefined,
    videoUrl: body.videoUrl || undefined,
    thumbnailUrl: body.thumbnailUrl || undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    draft: !!body.draft,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
