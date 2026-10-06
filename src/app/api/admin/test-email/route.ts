import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { BRAND } from "@/lib/brand";
import { appUrl, buttonEmail, emailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Sends a test email to the admin, to check the email settings. */
export async function POST(request: Request) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  if (!emailConfigured()) return NextResponse.json({ ok: false, error: "Email isn’t set up yet. Add RESEND_API_KEY and EMAIL_FROM (or SMTP_URL)." }, { status: 409 });
  try {
    await sendEmail({
      to: admin.email,
      subject: `${BRAND.name} test email`,
      ...buttonEmail({ heading: "Email is working.", body: "Password reset and invite emails will be delivered like this one.", button: `Open ${BRAND.name}`, url: appUrl(request), footer: "Sent from the admin dashboard." }),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message.slice(0, 300) }, { status: 502 });
  }
}
