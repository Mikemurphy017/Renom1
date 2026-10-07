import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageContainer } from "@/components/shared/page";
import { isAdmin, SESSION_COOKIE, userForToken } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Admins only (ADMIN_EMAILS). Everyone else gets a plain 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!isAdmin(user)) notFound();
  return (
    <PageContainer>
      <AdminNav />
      {children}
    </PageContainer>
  );
}
