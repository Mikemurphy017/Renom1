/**
 * Agent contract shared by every studio step.
 * The UI only depends on these types — swap `mockAgent` for a real
 * implementation (e.g. a server route streaming from an LLM) without
 * touching components.
 */
export type AgentTask = "ideas" | "thumbnails" | "script" | "descriptions" | "chat";

export interface AgentRequest<C = unknown> {
  task: AgentTask;
  /** Shown verbatim in the compact "request summary" card. */
  summary: Record<string, string>;
  prompt?: string;
  context?: C;
}

export type AgentEvent<R = unknown> =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "result"; data: R }
  | { type: "done" };

export interface AgentClient {
  stream<R = unknown, C = unknown>(req: AgentRequest<C>, signal?: AbortSignal): AsyncIterable<AgentEvent<R>>;
}
