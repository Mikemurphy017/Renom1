import { House, SquareKanban, Clapperboard, Library, ChartLine, ShieldCheck, UserRound, Settings } from "lucide-react";

export const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/board", label: "Video Board", icon: SquareKanban },
  { href: "/studio", label: "Studio", icon: Clapperboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/performance", label: "Performance", icon: ChartLine },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
