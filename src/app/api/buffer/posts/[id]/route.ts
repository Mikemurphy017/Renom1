import { NextResponse } from "next/server";
import { deletePost, editPost, getPost } from "@/lib/buffer/server";
import { fail, fromError, isBufferId, notConnected, parseDate, readJson } from "@/lib/buffer/route";
import type { EditBufferPostRequest } from "@/lib/buffer/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function postId(ctx: Ctx) {
  const { id } = await ctx.params;
  return isBufferId(id) ? id : null;
}

/** GET /api/buffer/posts/:id */
export async function GET(_request: Request, ctx: Ctx) {
  const off = notConnected();
  if (off) return off;
  const id = await postId(ctx);
  if (!id) return fail("Post id is invalid");
  try {
    return NextResponse.json({ ok: true, post: await getPost(id) });
  } catch (e) {
    return fromError(e);
  }
}

/** PATCH /api/buffer/posts/:id  { text?, dueAt? }: change the text and/or reschedule to a set time. */
export async function PATCH(request: Request, ctx: Ctx) {
  const off = notConnected();
  if (off) return off;
  const id = await postId(ctx);
  if (!id) return fail("Post id is invalid");
  const body = await readJson<EditBufferPostRequest>(request);
  if (!body) return fail("Invalid JSON");

  const errors: string[] = [];
  const edit: EditBufferPostRequest = {};
  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) errors.push("text can't be empty");
    else if (body.text.length > 10000) errors.push("text is too long");
    else edit.text = body.text;
  }
  if (body.dueAt !== undefined) {
    const dueAt = parseDate(body.dueAt);
    if (!dueAt) errors.push("dueAt must be a date");
    else if (Date.parse(dueAt) < Date.now() + 60_000) errors.push("dueAt must be in the future");
    else edit.dueAt = dueAt;
  }
  if (!errors.length && edit.text === undefined && edit.dueAt === undefined) errors.push("Nothing to change: send text and/or dueAt");
  if (errors.length) return fail(errors.join("; "));

  try {
    return NextResponse.json({ ok: true, post: await editPost(id, edit) });
  } catch (e) {
    return fromError(e);
  }
}

/** DELETE /api/buffer/posts/:id */
export async function DELETE(_request: Request, ctx: Ctx) {
  const off = notConnected();
  if (off) return off;
  const id = await postId(ctx);
  if (!id) return fail("Post id is invalid");
  try {
    return NextResponse.json({ ok: true, ...(await deletePost(id)) });
  } catch (e) {
    return fromError(e);
  }
}
