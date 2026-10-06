"use client";

import * as React from "react";
import { agent } from "@/lib/ai/mock-agent";
import type { AgentRequest } from "@/lib/ai/types";

export type Turn =
  | { id: string; role: "user"; summary?: Record<string, string>; text?: string }
  | { id: string; role: "assistant"; status?: string; text: string; done: boolean };

let n = 0;
const uid = () => `t${Date.now()}${n++}`;

/** Drives one agent conversation: request summary → status line → streamed reply. */
export function useAgentSession(initial: Turn[] = []) {
  const [turns, setTurns] = React.useState<Turn[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const run = React.useCallback(async (req: AgentRequest, opts?: { userText?: string; onDone?: () => void }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const aid = uid();
    setTurns((t) => [
      ...t,
      req.task === "chat" ? { id: uid(), role: "user", text: opts?.userText ?? req.prompt } : { id: uid(), role: "user", summary: req.summary },
      { id: aid, role: "assistant", status: "Starting…", text: "", done: false },
    ]);
    setBusy(true);
    const patch = (fn: (t: Extract<Turn, { role: "assistant" }>) => Partial<Extract<Turn, { role: "assistant" }>>) =>
      setTurns((ts) => ts.map((t) => (t.id === aid && t.role === "assistant" ? { ...t, ...fn(t) } : t)));
    try {
      for await (const ev of agent.stream(req, ctrl.signal)) {
        if (ev.type === "status") patch(() => ({ status: ev.text }));
        else if (ev.type === "delta") patch((t) => ({ text: t.text + ev.text }));
        else if (ev.type === "done") patch(() => ({ done: true, status: undefined }));
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setBusy(false);
        opts?.onDone?.();
      }
    }
  }, []);

  const reset = React.useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
    setBusy(false);
  }, []);

  return { turns, busy, run, reset };
}
