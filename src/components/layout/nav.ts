import { House, CalendarDays, Clapperboard, ChartLine, CircleHelp, PenLine, ShieldCheck } from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/posts", label: "Posts", icon: PenLine },
  { href: "/analyze", label: "Analyze", icon: ChartLine },
  { href: "/approve", label: "Approve", icon: ShieldCheck },
  { href: "/help", label: "Help", icon: CircleHelp },
] as const;
