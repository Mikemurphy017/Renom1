import { NextResponse } from "next/server";
import { isPro } from "@/lib/billing/tier";
import { getProcessor, VideoProcessorError } from "@/lib/video/processor";
import { getUpload } from "@/lib/video/storage";
import { validateProcessRequest } from "@/lib/video/validate";
import { currentUser } from "@/lib/auth/server";
import { BillingError, checkRender, countRender } from "@/lib/billing/server";

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

  // Finishing a video needs a plan (or the trial, up to its video limit). Reading a take doesn't.
  const user = await currentUser(request);
  // Motion graphics and 4K are Pro: a Starter render goes out without them.
  if (user && !(await isPro(user))) {
    if (req.overlays.extras) req.overlays.extras = { ...req.overlays.extras, graphics: false };
    if (req.resolution === "2160p") req.resolution = "1080p";
  }
  if (req.kind === "render" && user) {
    try {
      await checkRender(user, source.id);
    } catch (e) {
      if (e instanceof BillingError) return NextResponse.json({ ok: false, error: e.message, billing: true }, { status: e.status });
      throw e;
    }
  }

  const processor = await getProcessor();
  const ready = processor.readiness();
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.reason }, { status: 503 });
  try {
    const { jobId } = await processor.process(req, source);
    if (req.kind === "render" && user) await countRender(user, source.id).catch((e) => console.warn("[billing] couldn’t count the render:", e));
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
