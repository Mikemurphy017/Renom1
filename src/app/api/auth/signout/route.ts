import { NextResponse } from "next/server";
import { clearedCookie, endSession, readCookie } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await endSession(readCookie(request));
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearedCookie() } });
}
