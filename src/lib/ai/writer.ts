"use client";

import * as React from "react";
import type { WriteEvent, WriteRequest, WriteResult } from "./write-types";

/** Calls /api/write and exposes the live status line and result. */
export function useWriter() {
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [source, setSource] = React.useState<"claude" | "sample" | null>(null);
  const ctrlRef = React.useRef<AbortController | null>(null);

  const write = React.useCallback(async <R extends WriteRequest>(req: R): Promise<WriteResult<R["task"]>> => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    setStatus("Starting…");
    try {
      const res = await fetch("/api/write", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as WriteEvent;
          if (ev.type === "status") setStatus(ev.text);
          else if (ev.type === "error") throw new Error(ev.message);
          else if (ev.type === "result") {
            setSource(ev.source);
            return ev.data as WriteResult<R["task"]>;
          }
        }
      }
      throw new Error("The writer stopped without a result.");
    } finally {
      if (ctrlRef.current === ctrl) {
        setBusy(false);
        setStatus(null);
      }
    }
  }, []);

  return { write, status, busy, source };
}

/** True when a request was superseded by a newer one — not worth telling the user about. */
export const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";
