import { NextResponse } from "next/server";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { isStorageId } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/** Current status of one job. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isStorageId(id)) return NextResponse.json({ ok: false, error: "Invalid job id" }, { status: 400 });
  try {
    const status = await (await getProcessor()).getStatus(id);
    if (!status) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const status = e instanceof VideoProcessorError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof VideoProcessorError ? e.message : "Couldn’t read the job" }, { status });
  }
}
