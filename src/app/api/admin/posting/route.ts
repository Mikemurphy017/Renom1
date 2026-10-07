import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { listUsers } from "@/lib/auth/server";
import { allRequests, channelMap } from "@/lib/posting/server";

export const dynamic = "force-dynamic";

/** Every advisor's posting requests, plus who posts where. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const [requests, channels, users] = await Promise.all([allRequests(), channelMap(), listUsers()]);
  return NextResponse.json(
    { ok: true, requests: requests.filter((r) => r.status !== "cancelled"), channels, users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
