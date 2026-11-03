import { StripeSetup } from "@/components/admin/stripe-setup";

export const metadata = { title: "Billing setup" };

export default function AdminBillingPage() {
  return <StripeSetup />;
}
