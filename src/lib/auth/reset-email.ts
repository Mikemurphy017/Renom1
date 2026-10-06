import { BRAND } from "@/lib/brand";
import { appUrl, buttonEmail, sendEmail } from "@/lib/email";
import { RESET_MINUTES, type User } from "./server";

export const resetLink = (request: Request, token: string) => `${appUrl(request)}/reset?token=${encodeURIComponent(token)}`;

/** Emails a reset link. False when email isn't set up. */
export function sendResetEmail(request: Request, user: User, token: string, minutes = RESET_MINUTES) {
  const url = resetLink(request, token);
  const hours = minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`;
  return sendEmail({
    to: user.email,
    subject: `Reset your ${BRAND.name} password`,
    ...buttonEmail({
      heading: "Reset your password",
      body: `Hi ${user.name.split(" ")[0] || "there"}, use the button below to choose a new password for your ${BRAND.name} studio.`,
      button: "Choose a new password",
      url,
      footer: `This link works once and expires in ${hours}. If you didn’t ask for it, you can ignore this email; your password won’t change.`,
    }),
  });
}
