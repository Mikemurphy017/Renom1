import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthError, userById } from "@/lib/auth/server";
import { readWorkspace, writeWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => {
  if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  console.error("[admin] workspace failed:", e);
  return NextResponse.json({ ok: false, error: "That didn’t work. Please try again." }, { status: 500 });
};

/** A client's workspace setup, for the admin to edit. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    const user = await userById((await ctx.params).id);
    return NextResponse.json({ ok: true, user, ...(await readWorkspace(user.id)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as { profile?: unknown; requireApproval?: boolean; reviewer?: string };
  try {
    const user = await userById((await ctx.params).id);
    await writeWorkspace(user.id, b);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
