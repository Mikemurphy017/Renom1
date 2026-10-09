import { BRAND, isDefaultBrand } from "@/lib/brand";

/**
 * Outgoing email (password resets, invites, tests).
 *
 * - RESEND_API_KEY + EMAIL_FROM → sent through Resend's API.
 * - SMTP_URL (+ EMAIL_FROM) → sent over SMTP, e.g. smtps://user:pass@smtp.example.com:465
 * - Neither → not sent. In development the message is printed to the server log.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function emailProvider(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()) return "resend";
  if (process.env.SMTP_URL?.trim()) return "smtp";
  return null;
}
export const emailConfigured = () => emailProvider() !== null;

const from = () => process.env.EMAIL_FROM?.trim() || `${BRAND.name} <no-reply@localhost>`;

/** Sends one email. Returns false when no provider is configured; throws when sending fails. */
export async function sendEmail(mail: Mail): Promise<boolean> {
  const provider = emailProvider();
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from(), to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return true;
  }
  if (provider === "smtp") {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.SMTP_URL!.trim());
    await transport.sendMail({ from: from(), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return true;
  }
  if (process.env.NODE_ENV !== "production") console.info(`[email] (not configured; would send to ${mail.to})\n${mail.subject}\n\n${mail.text}`);
  else console.warn("[email] not sent: set RESEND_API_KEY + EMAIL_FROM or SMTP_URL");
  return false;
}

/**
 * The app's public address for links in emails. Never taken from the request's
 * Host header alone, so a forged header can't point a reset link elsewhere.
 */
export function appUrl(request: Request) {
  const set = process.env.APP_URL?.trim() || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
  if (set) return set.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The wordmark at the top of every email (images served from the app); the name in type for a reseller's brand. */
function masthead(link: string) {
  const origin = (() => {
    try {
      return new URL(link).origin;
    } catch {
      return "";
    }
  })();
  if (isDefaultBrand && !BRAND.logoUrl && origin) return `<img src="${esc(origin)}/brand/renom-wordmark-navy.png" alt="${esc(BRAND.name)}" width="170" height="24" style="display:block;border:0;height:24px;width:170px;margin-bottom:28px">`;
  return `<div style="font-family:Georgia,serif;font-size:20px;color:#B08D57;margin-bottom:24px">${esc(BRAND.name)}</div>`;
}

/** A plain, branded email with one button. */
export function buttonEmail(o: { heading: string; body: string; button: string; url: string; footer: string }) {
  const text = `${o.heading}\n\n${o.body}\n\n${o.button}: ${o.url}\n\n${o.footer}`;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F3EE;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0B1F3A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
${masthead(o.url)}
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 12px">${esc(o.heading)}</h1>
<p style="font-size:15px;line-height:1.55;margin:0 0 24px;color:#3a4657">${esc(o.body)}</p>
<a href="${esc(o.url)}" style="display:inline-block;background:#0B1F3A;color:#ffffff;text-decoration:none;font-size:15px;padding:12px 22px;border-radius:999px">${esc(o.button)}</a>
<p style="font-size:12px;line-height:1.5;margin:24px 0 0;color:#7a8494">${esc(o.footer)}<br><br>Or paste this link into your browser:<br><span style="word-break:break-all">${esc(o.url)}</span></p>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
