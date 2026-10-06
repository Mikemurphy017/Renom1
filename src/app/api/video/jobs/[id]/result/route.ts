import { NextResponse } from "next/server";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { isStorageId } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/** The finished job: output URL, transcript with word timings, cuts. 202 while still running. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isStorageId(id)) return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  try {
    const processor = await getProcessor();
    const status = await processor.getStatus(id);
    if (!status) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    if (status.state === "failed") return NextResponse.json({ ok: false, error: status.error ?? "Processing failed", status }, { status: 502 });
    if (status.state !== "done") return NextResponse.json({ ok: false, pending: true, status }, { status: 202 });
    const result = await processor.getResult(id);
    if (!result) return NextResponse.json({ ok: false, pending: true, status }, { status: 202 });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const status = e instanceof VideoProcessorError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof VideoProcessorError ? e.message : "Couldn’t read the result" }, { status });
  }
}
