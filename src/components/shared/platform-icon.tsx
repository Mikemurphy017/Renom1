import type { PlatformId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Monochrome platform marks (simplified) — inherit currentColor. */
const PATHS: Record<PlatformId, React.ReactNode> = {
  youtube: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="var(--pi-bg, #fff)" />
    </>
  ),
  youtube_shorts: (
    <>
      <path d="M15.6 2.6a3.3 3.3 0 0 1 3 5.8l-1.3.7 1.1.6a3.3 3.3 0 0 1-.1 5.8l-7.9 4.1a3.3 3.3 0 0 1-3-5.8l1.3-.7-1.1-.6a3.3 3.3 0 0 1 .1-5.8z" fill="currentColor" />
      <path d="M10.2 9.4v5.2l4.4-2.6z" fill="var(--pi-bg, #fff)" />
    </>
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path
      d="M14.5 3h2.6c.2 1.9 1.5 3.4 3.4 3.7v2.7c-1.3 0-2.5-.4-3.5-1v6.4a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.7 2.7 0 1 0 2 2.6z"
      fill="currentColor"
    />
  ),
  facebook: (
    <path d="M13.5 21v-7.3h2.5l.4-2.9h-2.9V9c0-.8.3-1.4 1.5-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.1v2.9h2.5V21z" fill="currentColor" />
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" />
      <path d="M7.2 10h2.2v7H7.2zm1.1-3.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6M11 10h2.1v1c.3-.6 1.1-1.2 2.2-1.2 2.3 0 2.7 1.5 2.7 3.5V17h-2.2v-3.3c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.8V17H11z" fill="var(--pi-bg, #fff)" />
    </>
  ),
  x: <path d="M4 4h4.6l3.9 5.3L17 4h2.6l-5.9 6.8L20.4 20h-4.6l-4.2-5.7L6.6 20H4l6.4-7.3z" fill="currentColor" />,
};

export function PlatformIcon({ id, className, style }: { id: PlatformId; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4 shrink-0", className)} style={style}>
      {PATHS[id]}
    </svg>
  );
}

/** Rounded tile with platform icon — used in calendars and cards. */
export function PlatformTile({ id, className }: { id: PlatformId; className?: string }) {
  return (
    <span
      className={cn("inline-flex size-6 items-center justify-center rounded-md border border-border bg-card text-foreground", className)}
      style={{ ["--pi-bg" as string]: "var(--card)" }}
    >
      <PlatformIcon id={id} className="size-3.5" />
    </span>
  );
}
