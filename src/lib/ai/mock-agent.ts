import type { AgentClient, AgentEvent, AgentRequest } from "./types";
import { sleep } from "../utils";
import { chatReply } from "./content";

const STATUS: Record<string, string[]> = {
  ideas: ["Reviewing your knowledge base…", "Checking your board for overlap…", "Drafting ideas…"],
  thumbnails: ["Loading your headshots…", "Composing poses and layouts…", "Rendering versions…"],
  script: ["Reviewing your knowledge base…", "Matching your voice from sample writing…", "Drafting your script…"],
  descriptions: ["Reading the final script…", "Applying platform limits…", "Appending compliance disclosures…"],
  chat: ["Thinking…"],
};

const NARRATION: Record<string, string> = {
  ideas: "Here are a few angles that fit your niche — tax-aware planning for executives. I flagged anything that overlaps with videos already on your board.",
  thumbnails: "I used your studio headshot with a few poses and kept your brand palette. The headline is set large enough to read on a phone feed.",
  script: "Here's a first draft. I kept the hook under 15 words, used your “CPA who explains things” framing, and avoided language that reads as a specific recommendation.",
  descriptions: "Copy is ready for each platform. Your active disclosure (v3.2) and firm details were appended automatically and are locked.",
};

/** Simulated streaming agent. Replace with a fetch() to a streaming route when wiring real AI. */
export const mockAgent: AgentClient = {
  async *stream<R, C>(req: AgentRequest<C>, signal?: AbortSignal): AsyncIterable<AgentEvent<R>> {
    const statuses = STATUS[req.task] ?? STATUS.chat;
    for (const s of statuses) {
      if (signal?.aborted) return;
      yield { type: "status", text: s };
      await sleep(550 + Math.random() * 350);
    }
    const text = req.task === "chat" ? chatReply(req.prompt ?? "", String((req.context as { step?: string })?.step ?? "")) : NARRATION[req.task];
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (signal?.aborted) return;
      yield { type: "delta", text: w };
      await sleep(18 + Math.random() * 22);
    }
    yield { type: "done" };
  },
};

export const agent: AgentClient = mockAgent;
