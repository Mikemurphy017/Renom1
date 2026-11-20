import { BRAND } from "@/lib/brand";
import { appUrl, buttonEmail, sendEmail } from "@/lib/email";
import type { User } from "./server";

/** The sign-in page for emails (never from the request's Host header alone). */
export const emailSignInUrl = (request: Request) => `${appUrl(request)}/signin`;

/** Emails a client their sign-in details: the address, a temporary password and a sign-in button. False when email isn't set up. */
export function sendCredentialsEmail(request: Request, user: Pick<User, "email" | "name">, password: string) {
  const first = user.name.trim().split(/\s+/)[0] || "there";
  return sendEmail({
    to: user.email,
    subject: `Your ${BRAND.name} sign-in details`,
    ...buttonEmail({
      heading: `Your ${BRAND.name} studio is ready`,
      body: `Hi ${first}, your studio is set up and ready for you.\n\nEmail: ${user.email}\nTemporary password: ${password}\n\nOnce you're in, you'll be asked to choose your own password (Settings → Account).`,
      button: "Sign in",
      url: emailSignInUrl(request),
      footer: "Any earlier temporary password no longer works. If you weren't expecting this email, reply and let us know.",
    }),
  });
}
