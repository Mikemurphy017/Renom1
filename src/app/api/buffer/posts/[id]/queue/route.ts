import { NextResponse } from "next/server";
import { movePostInQueue } from "@/lib/buffer/server";
import { fail, fromError, isBufferId, notConnected, readJson } from "@/lib/buffer/route";
import type { BufferQueuePosition } from "@/lib/buffer/types";

export const dynamic = "force-dynamic";

/** POST /api/buffer/posts/:id/queue  { position: "top" | "bottom" } */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const off = notConnected();
  if (off) return off;
  const { id } = await ctx.params;
  if (!isBufferId(id)) return fail("Post id is invalid");
  const body = await readJson<{ position: BufferQueuePosition }>(request);
  if (!body) return fail("Invalid JSON");
  if (body.position !== "top" && body.position !== "bottom") return fail("position must be top or bottom");
  try {
    return NextResponse.json({ ok: true, post: await movePostInQueue(id, body.position) });
  } catch (e) {
    return fromError(e);
  }
}
