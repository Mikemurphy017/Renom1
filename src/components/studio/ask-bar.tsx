"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LoaderCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/** A single floating line for changes: "Make it shorter", "Punchier hook"… */
export function AskBar({
  onAsk,
  busy,
  status,
  note,
  suggestions = [],
  placeholder = `Ask ${BRAND.name} to change anything…`,
  className,
}: {
  onAsk: (text: string) => void;
  busy: boolean;
  status?: string | null;
  note?: string | null;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = React.useState("");
  const submit = (text = value) => {
    const t = text.trim();
    if (!t || busy) return;
    onAsk(t);
    setValue("");
  };
  return (
    <div className={cn("sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-background via-background/95 to-transparent px-4 pt-10 pb-6", className)}>
      <div className="mx-auto w-full max-w-[680px]">
      <AnimatePresence>
        {(busy || note) && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 flex justify-center">
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[12px] text-muted-foreground shadow-soft backdrop-blur">
              {busy ? <LoaderCircle className="size-3.5 animate-spin text-primary" /> : <Sparkles className="size-3.5 text-primary" />}
              <span className="truncate">{busy ? status ?? "Working…" : note}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="rounded-full border border-border bg-card/95 p-1.5 shadow-[0_8px_30px_-8px_rgba(11,31,58,.25)] backdrop-blur-xl">
        <div className="flex items-center gap-2 pl-4">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={placeholder}
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/70"
          />
          <button
            onClick={() => submit()}
            disabled={!value.trim() || busy}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:cursor-default disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
      {suggestions.length > 0 && !busy && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => submit(s)} className="cursor-pointer rounded-full border border-border bg-card/90 px-3 py-1 text-[12px] text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/** Shimmering status line shown while Renom writes. */
export function Writing({ status, className }: { status?: string | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 py-2 text-[14px] text-muted-foreground", className)}>
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" />
        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>
      <span className="italic">{status ?? "Writing…"}</span>
    </div>
  );
}

/** Small, quiet line echoing what was sent to the writer. */
export function RequestLine({ items, source }: { items: string[]; source?: "claude" | "sample" | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted-foreground">
      {items.map((it, i) => (
        <span key={i}>{it}{i < items.length - 1 && <span className="ml-1.5 opacity-50">·</span>}</span>
      ))}
      {source && (
        <span className={cn("ml-1 rounded-full px-2 py-0.5 text-[11px]", source === "claude" ? "bg-brass-soft text-[#7d6238] dark:text-primary" : "bg-muted")}>
          {source === "claude" ? "Written by Claude" : "Examples while writing is off"}
        </span>
      )}
    </div>
  );
}
