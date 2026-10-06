import Anthropic from "@anthropic-ai/sdk";
import { claudeConfigured, writeWithClaude } from "@/lib/ai/claude";
import { sampleCaptions, sampleIdeas, sampleScript } from "@/lib/ai/samples";
import type { WriteEvent, WriteRequest } from "@/lib/ai/write-types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STATUS: Record<WriteRequest["task"], string[]> = {
  ideas: ["Reading your profile…", "Checking what you’ve already made…", "Finding the conversation your clients are already having…", "Sharpening the hooks…"],
  script: ["Reading your profile…", "Finding the hook…", "Writing for the ear…", "Tightening every line…", "Checking compliance language…"],
  captions: ["Reading the script…", "Writing for each platform…", "Fitting platform limits…"],
};

function validate(body: unknown): WriteRequest | string {
  const b = body as Partial<WriteRequest>;
  if (!b || typeof b !== "object") return "Invalid request";
  if (!b.task || !["ideas", "script", "captions"].includes(b.task)) return "Unknown task";
  if (!b.profile || typeof b.profile !== "object") return "Missing profile";
  if (JSON.stringify(b).length > 60_000) return "Request too large";
  return b as WriteRequest;
}

export async function POST(request: Request) {
  let parsed: WriteRequest | string;
  try {
    parsed = validate(await request.json());
  } catch {
    parsed = "Invalid JSON";
  }
  if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
  const req = parsed;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: WriteEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const statuses = STATUS[req.task];
      let i = 0;
      send({ type: "status", text: statuses[0] });
      const timer = setInterval(() => {
        i = Math.min(i + 1, statuses.length - 1);
        send({ type: "status", text: statuses[i] });
      }, claudeConfigured() ? 2500 : 600);

      try {
        if (claudeConfigured()) {
          const data = await writeWithClaude(req);
          send({ type: "result", data, source: "claude" });
        } else {
          await new Promise((r) => setTimeout(r, 1800));
          const data = req.task === "ideas" ? sampleIdeas(req) : req.task === "script" ? sampleScript(req) : sampleCaptions(req);
          send({ type: "result", data, source: "sample" });
        }
      } catch (e) {
        let message = (e as Error).message || "Something went wrong";
        if (e instanceof Anthropic.AuthenticationError) message = "The Claude API key was rejected. Check ANTHROPIC_API_KEY.";
        else if (e instanceof Anthropic.RateLimitError) message = "Claude is busy right now. Try again in a moment.";
        else if (e instanceof Anthropic.APIConnectionError) message = "Couldn’t reach Claude. Check the network connection.";
        else if (e instanceof Anthropic.APIError) message = `Claude returned an error (${e.status}).`;
        send({ type: "error", message });
      } finally {
        clearInterval(timer);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Lets the UI show whether real Claude writing is on. */
export async function GET() {
  return Response.json({ claude: claudeConfigured() });
}
