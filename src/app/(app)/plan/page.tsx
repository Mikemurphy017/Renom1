import { Suspense } from "react";
import { PlanPage } from "@/components/plan/plan-page";

export const metadata = { title: "Plan" };

export default function Page() {
  return (
    <Suspense>
      <PlanPage />
    </Suspense>
  );
}
