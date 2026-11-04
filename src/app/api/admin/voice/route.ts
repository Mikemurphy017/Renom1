import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { voiceAccount } from "@/lib/voice/server";

export const dynamic = "force-dynamic";

/** Admin check: the plan behind the studio's AI voice key. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, voice: await voiceAccount() }, { headers: { "Cache-Control": "no-store" } });
}
