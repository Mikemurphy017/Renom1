import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { BRAND } from "@/lib/brand";

/** Pages without their own title (the home page) get "Home"; the rest read "Videos · Renom". */
export const metadata: Metadata = { title: { default: "Home", template: `%s · ${BRAND.name}` } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
