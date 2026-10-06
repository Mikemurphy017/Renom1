import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { isAdmin, SESSION_COOKIE, userForToken } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

/** Admins only (ADMIN_EMAILS). Everyone else gets a plain 404. */
export default async function AdminPage() {
  const user = await userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!isAdmin(user)) notFound();
  return <AdminDashboard />;
}
