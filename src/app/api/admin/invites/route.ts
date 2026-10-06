import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthError, createInvite, revokeInvite } from "@/lib/auth/server";
import { BRAND } from "@/lib/brand";
import { appUrl, buttonEmail, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Makes a single-use invite link, and emails it when an address is given and email is set up. */
export async function POST(request: Request) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => ({}))) as { email?: string; note?: string; days?: number; send?: boolean };
  try {
    const { code, invite } = await createInvite(admin, { email: b.email, note: b.note, days: Number(b.days) || 14 });
    const link = `${appUrl(request)}/signup?invite=${encodeURIComponent(code)}`;
    let emailed = false;
    if (invite.email && b.send !== false) {
      emailed = await sendEmail({
        to: invite.email,
        subject: `You’re invited to ${BRAND.name}`,
        ...buttonEmail({
          heading: `Join ${BRAND.name}`,
          body: `${admin.name} invited you to create your ${BRAND.name} studio: scripts, filming and editing for your advisor videos, in one place.`,
          button: "Create your account",
          url: link,
          footer: `This invite works once and expires on ${new Date(invite.expiresAt).toDateString()}.`,
        }),
      }).catch((e) => {
        console.error("[admin] invite email failed:", e);
        return false;
      });
    }
    return NextResponse.json({ ok: true, link, emailed, invite });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[admin] invite failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t create the invite." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{40}$/.test(id)) return NextResponse.json({ ok: false, error: "Bad invite." }, { status: 400 });
  await revokeInvite(id);
  return NextResponse.json({ ok: true });
}
