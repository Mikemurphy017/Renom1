import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { resetLink, sendResetEmail } from "@/lib/auth/reset-email";
import { AuthError, createResetToken, deleteUser, setDisabled, signOutEverywhere, userById } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const ADMIN_RESET_MINUTES = 24 * 60;

/** Account actions: reset link, disable/enable, sign out everywhere, delete. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  try {
    const user = await userById(id);
    const self = user.id === admin.id;
    switch (action) {
      case "reset": {
        const made = await createResetToken(user.email, ADMIN_RESET_MINUTES);
        if (!made) throw new AuthError("This account is disabled. Enable it first.", 409);
        const emailed = await sendResetEmail(request, made.user, made.token, ADMIN_RESET_MINUTES).catch((e) => {
          console.error("[admin] reset email failed:", e);
          return false;
        });
        return NextResponse.json({ ok: true, emailed, link: resetLink(request, made.token) });
      }
      case "disable":
      case "enable":
        if (self) throw new AuthError("You can’t disable your own account.", 409);
        await setDisabled(id, action === "disable");
        return NextResponse.json({ ok: true });
      case "signout":
        await signOutEverywhere(id);
        return NextResponse.json({ ok: true, self });
      case "delete":
        if (self) throw new AuthError("You can’t delete your own account.", 409);
        await deleteUser(id);
        return NextResponse.json({ ok: true });
      default:
        throw new AuthError("Unknown action.");
    }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin] action failed:", e);
    return NextResponse.json({ ok: false, error: "That didn’t work. Please try again." }, { status: 500 });
  }
}
