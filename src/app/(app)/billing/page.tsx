import { PageContainer } from "@/components/shared/page";
import { BillingPage } from "@/components/billing/billing-page";

export const metadata = { title: "Billing" };

export default function Billing() {
  return (
    <PageContainer className="pt-8">
      <BillingPage />
    </PageContainer>
  );
}
