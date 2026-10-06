import { NextResponse } from "next/server";
import { requireAdmin, serviceStatus } from "@/lib/auth/admin";
import { isAdmin, listUsers, loadState, readInvites } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Everything the admin dashboard shows: accounts with a summary of their studio, invites and service health. */
export async function GET(request: Request) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  const users = await listUsers();
  const rows = await Promise.all(
    users.map(async (u) => {
      const saved = await loadState(u.id).catch(() => null);
      const st = (saved?.state ?? {}) as { onboarded?: boolean; videos?: { status?: string }[]; profile?: { firm?: string } };
      const videos = Array.isArray(st.videos) ? st.videos : [];
      return {
        ...u,
        admin: isAdmin(u),
        you: u.id === admin.id,
        firm: st.profile?.firm || "",
        onboarded: !!st.onboarded,
        videos: videos.length,
        published: videos.filter((v) => v.status === "published" || v.status === "scheduled").length,
        lastActiveAt: saved?.updatedAt ?? null,
      };
    }),
  );
  const invites = (await readInvites()).map((i) => ({ ...i, status: i.revokedAt ? "revoked" : i.usedAt ? "used" : Date.parse(i.expiresAt) < Date.now() ? "expired" : "open" }));
  return NextResponse.json({ users: rows, invites, services: serviceStatus(), envInviteCode: !!process.env.INVITE_CODE?.trim() }, { headers: { "Cache-Control": "no-store" } });
}
