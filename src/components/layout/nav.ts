import { House, Clapperboard, ChartLine, ShieldCheck } from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/analyze", label: "Analyze", icon: ChartLine },
  { href: "/approve", label: "Approve", icon: ShieldCheck },
] as const;
