import Anthropic from "@anthropic-ai/sdk";
import { claudeConfigured, writeWithClaude } from "@/lib/ai/claude";
import type { WriteEvent, WriteRequest } from "@/lib/ai/write-types";
import { WRITERS } from "@/lib/ai/writers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STATUS: Record<WriteRequest["task"], string[]> = {
  ideas: ["Reading your profile…", "Checking what you’ve already made…", "Finding the conversation your clients are already having…", "Sharpening the hooks…"],
  script: ["Reading your profile…", "Finding the hook…", "Writing for the ear…", "Tightening every line…", "Checking compliance language…"],
  captions: ["Reading the script…", "Finding the first line…", "Writing for each platform…", "Writing the taglines…", "Fitting platform limits…"],
  covers: ["Reading the script…", "Finding the stake…", "Cutting it to five words…"],
};

function validate(body: unknown): WriteRequest | string {
  const b = body as Partial<WriteRequest>;
  if (!b || typeof b !== "object") return "Invalid request";
  if (!b.task || !["ideas", "script", "captions", "covers"].includes(b.task)) return "Unknown task";
  if (!b.profile || typeof b.profile !== "object") return "Missing profile";
  if ((b.task === "script" || b.task === "captions") && "writer" in b && b.writer !== undefined && !WRITERS.some((w) => w.id === b.writer)) return "Unknown writer";
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
  if (!claudeConfigured()) {
    console.warn("[write] ANTHROPIC_API_KEY is not set on the server; writing is off for every studio.");
    return Response.json({ error: "Writing isn’t switched on for this studio yet. Your administrator turns it on once for everyone." }, { status: 503 });
  }
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
      }, 2500);

      try {
        const data = await writeWithClaude(req);
        send({ type: "result", data, source: "claude" });
      } catch (e) {
        let message = (e as Error).message || "Something went wrong";
        if (e instanceof Anthropic.AuthenticationError) {
          console.error("[write] Claude rejected the server's ANTHROPIC_API_KEY.");
          message = "Writing is temporarily unavailable. Please try again later.";
        }
        else if (e instanceof Anthropic.RateLimitError) message = "Claude is busy right now. Try again in a moment.";
        else if (e instanceof Anthropic.APIConnectionError) message = "Couldn’t reach Claude. Check the network connection.";
        else if (e instanceof Anthropic.APIError) {
          // Keep the real reason in the server log; advisors get a plain sentence.
          const detail = (e.error as { error?: { message?: string } } | undefined)?.error?.message ?? e.message;
          console.error(`[write] Claude returned ${e.status}: ${detail}`);
          message = /credit balance|billing|usage limit/i.test(detail)
            ? "Writing is paused: the studio’s Claude account needs more credit. Your administrator can top it up, then try again."
            : `Claude couldn’t complete this request (${e.status}). Please try again.`;
        }
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
