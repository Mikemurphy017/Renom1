import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { resetLink, sendResetEmail } from "@/lib/auth/reset-email";
import { sendCredentialsEmail } from "@/lib/auth/credentials-email";
import { emailConfigured } from "@/lib/email";
import { signInUrl } from "@/lib/auth/workspace";
import { AuthError, createResetToken, deleteUser, setDisabled, setGrantedPlan, setTempPassword, signOutEverywhere, userById } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const ADMIN_RESET_MINUTES = 24 * 60;

/** Account actions: reset link, new temporary password, disable/enable, sign out everywhere, delete. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await ctx.params;
  const { action, plan } = (await request.json().catch(() => ({}))) as { action?: string; plan?: string | null };
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
      case "password": {
        // A new temporary password to copy and send; the old one stops working.
        if (self) throw new AuthError("Change your own password in Settings.", 409);
        const password = await setTempPassword(id);
        return NextResponse.json({ ok: true, password, signInUrl: signInUrl(request) });
      }
      case "email-credentials": {
        // A new temporary password, emailed to the client (the old one can't be read back: only its hash is kept).
        if (self) throw new AuthError("Change your own password in Settings.", 409);
        if (!emailConfigured()) throw new AuthError("Email isn’t set up for this studio yet, so nothing was sent. Use “New password” and send the details yourself.", 409);
        const password = await setTempPassword(id);
        try {
          await sendCredentialsEmail(request, user, password);
        } catch (e) {
          console.error("[admin] credentials email failed:", e);
          // The password changed; hand it to the admin so the client isn't locked out.
          return NextResponse.json({ ok: true, emailed: false, password, signInUrl: signInUrl(request) });
        }
        return NextResponse.json({ ok: true, emailed: true });
      }
      case "plan": {
        // Grant Starter or Pro features, or (null) go back to what their subscription gives.
        await setGrantedPlan(id, plan === "pro" || plan === "starter" ? plan : null);
        return NextResponse.json({ ok: true });
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
