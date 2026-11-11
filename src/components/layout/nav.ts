import { House, CalendarDays, Clapperboard, ChartLine, Film, PenLine, ShieldCheck } from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/videos", label: "Videos", icon: Clapperboard },
  { href: "/posts", label: "Posts", icon: PenLine },
  { href: "/cinematic", label: "Cinematic", icon: Film },
  { href: "/analyze", label: "Analyze", icon: ChartLine },
  { href: "/approve", label: "Approve", icon: ShieldCheck },
] as const;
