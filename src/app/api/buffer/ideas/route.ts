import { NextResponse } from "next/server";
import { createIdea, listIdeas } from "@/lib/buffer/server";
import { fail, fromError, isBufferId, notConnected, parseDate, readJson, SERVICES } from "@/lib/buffer/route";
import type { BufferService, CreateBufferIdeaRequest } from "@/lib/buffer/types";

export const dynamic = "force-dynamic";

/** GET /api/buffer/ideas?first=20&after=cursor: ideas plus the idea groups (columns). */
export async function GET(request: Request) {
  const off = notConnected();
  if (off) return off;
  const q = new URL(request.url).searchParams;
  const first = q.has("first") ? Number(q.get("first")) : 20;
  if (!Number.isInteger(first) || first < 1 || first > 100) return fail("first must be 1–100");
  const after = q.get("after") ?? undefined;
  if (after !== undefined && !/^[A-Za-z0-9+/=_-]{1,512}$/.test(after)) return fail("after is invalid");
  try {
    return NextResponse.json({ ok: true, ...(await listIdeas({ first, after })) });
  } catch (e) {
    return fromError(e);
  }
}

/** POST /api/buffer/ideas  { title, text?, services?, date?, groupId?, aiAssisted? } */
export async function POST(request: Request) {
  const off = notConnected();
  if (off) return off;
  const body = await readJson<CreateBufferIdeaRequest>(request);
  if (!body) return fail("Invalid JSON");

  const errors: string[] = [];
  if (typeof body.title !== "string" || !body.title.trim()) errors.push("title is required");
  else if (body.title.length > 300) errors.push("title is too long");
  if (body.text !== undefined && (typeof body.text !== "string" || body.text.length > 10000)) errors.push("text is invalid");
  if (body.services !== undefined && (!Array.isArray(body.services) || !body.services.every((s) => SERVICES.includes(s as BufferService)))) errors.push("services is invalid");
  const date = body.date !== undefined ? parseDate(body.date) : undefined;
  if (date === null) errors.push("date must be a date");
  if (body.groupId !== undefined && !isBufferId(body.groupId)) errors.push("groupId is invalid");
  if (errors.length) return fail(errors.join("; "));

  try {
    const idea = await createIdea({
      title: body.title!.trim(),
      text: body.text?.trim() || undefined,
      services: body.services,
      date: date ?? undefined,
      groupId: body.groupId,
      aiAssisted: body.aiAssisted === true,
    });
    return NextResponse.json({ ok: true, idea });
  } catch (e) {
    return fromError(e);
  }
}
