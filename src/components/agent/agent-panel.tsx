"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LoaderCircle, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RequestSummary } from "./request-summary";
import type { Turn } from "./use-agent";

function RenomMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-navy font-serif text-[12px] text-[#D2B07A] dark:bg-secondary", className)}>
      R
    </span>
  );
}

export function AgentPanel({
  turns,
  busy,
  onSend,
  title = "Renom",
  subtitle = "Your content agent",
  emptyHint = "Configure the request and generate — or just ask me anything.",
  className,
  suggestions = [],
}: {
  turns: Turn[];
  busy: boolean;
  onSend: (text: string) => void;
  title?: string;
  subtitle?: string;
  emptyHint?: string;
  className?: string;
  suggestions?: string[];
}) {
  const [value, setValue] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const submit = () => {
    const v = value.trim();
    if (!v || busy) return;
    onSend(v);
    setValue("");
  };

  return (
    <div className={cn("flex min-h-0 flex-col rounded-lg border border-border bg-card shadow-soft", className)}>
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <RenomMark />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold leading-tight">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", busy ? "animate-pulse bg-primary" : "bg-success")} />
          {busy ? "Working" : "Ready"}
        </span>
      </div>

      <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <RenomMark className="mb-3 size-9 text-base" />
            <p className="font-serif text-lg">How can I help?</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">{emptyHint}</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {t.role === "user" ? (
                t.summary ? (
                  <RequestSummary summary={t.summary} />
                ) : (
                  <div className="ml-8 rounded-lg rounded-br-sm bg-navy px-3 py-2 text-[13px] text-navy-foreground dark:bg-secondary">{t.text}</div>
                )
              ) : (
                <div className="flex gap-2.5">
                  <RenomMark />
                  <div className="min-w-0 flex-1 pt-0.5">
                    {t.status && (
                      <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <LoaderCircle className="size-3 animate-spin text-primary" />
                        <span className="italic">{t.status}</span>
                      </div>
                    )}
                    {t.text && <p className={cn("text-[13px] leading-relaxed", !t.done && "caret")}>{t.text}</p>}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3">
        {suggestions.length > 0 && !busy && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSend(s)}
                className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-lg border border-input bg-background/60 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask for changes or chat with Renom…"
            className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" aria-label="Attach file">
              <Paperclip className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground" aria-label="Voice memo">
              <Mic className="size-3.5" />
            </Button>
            <Button size="icon-sm" className="ml-auto size-7" onClick={submit} disabled={!value.trim() || busy} aria-label="Send">
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
