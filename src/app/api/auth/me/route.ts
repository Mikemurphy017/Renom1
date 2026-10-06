import { NextResponse } from "next/server";
import { currentUser, isAdmin, signupPolicy } from "@/lib/auth/server";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Who is signed in (null if nobody), whether new accounts can be created, and whether reset emails can be sent. */
export async function GET(request: Request) {
  const [user, signup] = await Promise.all([currentUser(request), signupPolicy()]);
  return NextResponse.json({ user: user && { ...user, admin: isAdmin(user) }, signup, resetByEmail: emailConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
