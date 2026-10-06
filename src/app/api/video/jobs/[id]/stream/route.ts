import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { isStorageId } from "@/lib/video/storage";
import type { JobEvent } from "@/lib/video/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 700;
const GIVE_UP_MS = 280_000;

/** Streams status lines while the job runs, then the result (NDJSON, like /api/write). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isStorageId(id)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const processor = await getProcessor();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: JobEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const startedAt = Date.now();
      try {
        for (;;) {
          if (request.signal.aborted) return;
          const status = await processor.getStatus(id);
          if (!status) throw new VideoProcessorError("Job not found", 404);
          send({ type: "status", status });
          if (status.state === "failed") throw new VideoProcessorError(status.error ?? "Processing failed");
          if (status.state === "done") {
            const result = await processor.getResult(id);
            if (result) {
              send({ type: "result", data: result });
              return;
            }
          }
          if (Date.now() - startedAt > GIVE_UP_MS) throw new VideoProcessorError("Still processing. Check back in a minute.");
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (e) {
        send({ type: "error", message: e instanceof VideoProcessorError ? e.message : "Something went wrong" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
