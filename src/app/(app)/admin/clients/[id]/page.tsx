import { ClientSetup } from "@/components/admin/client-setup";

export const metadata = { title: "Client workspace" };

export default async function ClientWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return <ClientSetup id={(await params).id} />;
}
