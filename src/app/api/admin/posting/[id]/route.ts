import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { updateRequest } from "@/lib/posting/server";
import type { PostRequestBufferPost } from "@/lib/posting/types";

export const dynamic = "force-dynamic";

const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

/**
 * The team's side of a request:
 * - buffer: record the posts just created in Buffer (status follows: drafts → in_buffer, timed → scheduled, now → posted)
 * - scheduled / posted: set by hand (posted somewhere other than Buffer)
 * - return: send it back to the advisor with a note
 * - reopen: put it back in the queue
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => ({}))) as { action?: string; note?: string; at?: string; posts?: PostRequestBufferPost[] };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : undefined;

  let patch: Parameters<typeof updateRequest>[1];
  switch (b.action) {
    case "buffer": {
      const posts = (Array.isArray(b.posts) ? b.posts : []).slice(0, 20);
      if (!posts.length) return NextResponse.json({ ok: false, error: "No posts to record." }, { status: 400 });
      const now = posts.some((p) => p.mode === "now");
      const timed = posts.filter((p) => p.mode !== "draft").map((p) => iso(p.dueAt)).filter(Boolean).sort() as string[];
      patch = {
        buffer: posts,
        status: now ? "posted" : timed.length || posts.some((p) => p.mode === "queue") ? "scheduled" : "in_buffer",
        scheduledFor: timed[0],
        postedAt: now ? new Date().toISOString() : undefined,
        teamNote: note,
      };
      break;
    }
    case "scheduled":
      if (!iso(b.at)) return NextResponse.json({ ok: false, error: "Pick the date and time." }, { status: 400 });
      patch = { status: "scheduled", scheduledFor: iso(b.at), teamNote: note };
      break;
    case "posted":
      patch = { status: "posted", postedAt: iso(b.at) ?? new Date().toISOString(), teamNote: note };
      break;
    case "return":
      if (!note) return NextResponse.json({ ok: false, error: "Tell the advisor what to change." }, { status: 400 });
      patch = { status: "returned", teamNote: note };
      break;
    case "reopen":
      patch = { status: "submitted" };
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  const r = await updateRequest(id, patch);
  if (!r) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, request: r });
}
