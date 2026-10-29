import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthError, createClientAccount, deleteUser } from "@/lib/auth/server";
import { signInUrl, writeWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

/**
 * Sets up a client: their account (with a temporary password to hand over)
 * and their workspace, ready the first time they sign in.
 */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as { email?: string; profile?: { name?: string }; requireApproval?: boolean; reviewer?: string };
  try {
    const { user, password } = await createClientAccount({ email: String(b.email ?? ""), name: String(b.profile?.name ?? "") });
    try {
      await writeWorkspace(user.id, { profile: b.profile, requireApproval: b.requireApproval, reviewer: b.reviewer });
    } catch (e) {
      // Don't leave a half-made account behind.
      await deleteUser(user.id).catch(() => {});
      throw e;
    }
    return NextResponse.json({ ok: true, user, password, signInUrl: signInUrl(request) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin] client setup failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t set up the client. Please try again." }, { status: 500 });
  }
}
