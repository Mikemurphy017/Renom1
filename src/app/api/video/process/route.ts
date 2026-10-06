import { NextResponse } from "next/server";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { getUpload } from "@/lib/video/storage";
import { validateProcessRequest } from "@/lib/video/validate";

export const dynamic = "force-dynamic";

/** Start an analyze (transcript + suggested cuts) or render (final video) job. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const req = validateProcessRequest(body);
  if (typeof req === "string") return NextResponse.json({ ok: false, error: req }, { status: 400 });

  const source = await getUpload(req.sourceId);
  if (!source) return NextResponse.json({ ok: false, error: "That upload wasn’t found" }, { status: 404 });
  if (req.cuts?.some((c) => c.end > source.durationSec + 1)) return NextResponse.json({ ok: false, error: "A cut runs past the end of the video" }, { status: 400 });

  const processor = await getProcessor();
  const ready = processor.readiness();
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.reason }, { status: 503 });
  try {
    const { jobId } = await processor.process(req, source);
    return NextResponse.json({ ok: true, jobId, processor: processor.id });
  } catch (e) {
    const status = e instanceof VideoProcessorError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof VideoProcessorError ? e.message : "Couldn’t start processing" }, { status });
  }
}

/** Lets the UI show which processor is on and whether it can run. */
export async function GET() {
  const processor = await getProcessor();
  const ready = processor.readiness();
  return NextResponse.json({ processor: processor.id, ready: ready.ok, reason: ready.ok ? undefined : ready.reason });
}
