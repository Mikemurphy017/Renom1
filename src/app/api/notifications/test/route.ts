import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { emailConfigured } from "@/lib/email";
import { sendTestReminder } from "@/lib/notify/server";

export const dynamic = "force-dynamic";

const recent = new Map<string, number[]>();

/** Send yourself this week's record-day reminder now, to see it (notice, and email when set up). */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= 3) return NextResponse.json({ ok: false, error: "That’s 3 test reminders this hour. Try again later." }, { status: 429 });
  recent.set(user.id, [...mine, now]);
  const r = await sendTestReminder(user);
  return NextResponse.json({ ok: true, emailed: r.emailed, emailSetUp: emailConfigured() });
}
