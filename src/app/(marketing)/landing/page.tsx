import type { Metadata } from "next";
import { Landing } from "@/components/marketing/landing";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name}: video for financial advisors` },
  description: `${BRAND.name} writes the script in your voice, puts it on a teleprompter in your browser, edits your take and hands you a video that's ready to post. Free during early access.`,
};

/** Signed-out visitors to "/" see this page (see src/middleware.ts). */
export default function LandingPage() {
  return <Landing />;
}
