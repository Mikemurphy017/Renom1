import { NextResponse } from "next/server";
import { currentUser, signupPolicy } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Who is signed in (null if nobody), and whether new accounts can be created. */
export async function GET(request: Request) {
  const [user, signup] = await Promise.all([currentUser(request), signupPolicy()]);
  return NextResponse.json({ user, signup }, { headers: { "Cache-Control": "no-store" } });
}
