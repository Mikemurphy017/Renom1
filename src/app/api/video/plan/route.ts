import { NextResponse } from "next/server";
import { isPro } from "@/lib/billing/tier";
import { currentUser } from "@/lib/auth/server";
import { getProcessor } from "@/lib/video/processor";
import { getUpload, isStorageId } from "@/lib/video/storage";
import { validateProcessRequest } from "@/lib/video/validate";
import { describePlan, makePlan, verifyPlan } from "@/lib/video/local/plan";
import { editedWords, keepRanges, planKey, type EditPlan } from "@/lib/video/storyboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Plan the edit without rendering it: the storyboard the advisor reviews and
 * approves before the render. Takes the same cuts and look a render would, plus
 * the analysis of the take (for its words). With `instruction` (and the
 * `previous` plan), plans again with the advisor's change.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  let body: { analysisJobId?: unknown; instruction?: unknown; previous?: unknown } & Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { analysisJobId, instruction, previous, ...rest } = body ?? {};
  const req = validateProcessRequest({ ...rest, kind: "render", autoPlan: true });
  if (typeof req === "string") return NextResponse.json({ ok: false, error: req }, { status: 400 });
  if (!isStorageId(analysisJobId)) return NextResponse.json({ ok: false, error: "analysisJobId is required" }, { status: 400 });
  if (instruction !== undefined && (typeof instruction !== "string" || instruction.length > 600)) return NextResponse.json({ ok: false, error: "Keep the request under 600 characters" }, { status: 400 });

  const source = await getUpload(req.sourceId);
  if (!source) return NextResponse.json({ ok: false, error: "That upload wasn’t found" }, { status: 404 });
  // Motion graphics are Pro, exactly as at render time, so the storyboard shows what the render will do.
  if (!(await isPro(user)) && req.overlays.extras) req.overlays.extras = { ...req.overlays.extras, graphics: false };

  const processor = await getProcessor();
  const analysis = await processor.getResult(analysisJobId).catch(() => null);
  if (!analysis || analysis.kind !== "analyze") return NextResponse.json({ ok: false, error: "Your take is still being read. Try again in a moment." }, { status: 409 });

  const durationSec = analysis.durationSec || source.durationSec;
  const cuts = req.cuts ?? [];
  const keep = keepRanges(cuts, durationSec);
  if (!keep.length) return NextResponse.json({ ok: false, error: "Everything was cut. Restore at least one phrase." }, { status: 400 });
  const outDur = keep.reduce((s, k) => s + (k.end - k.start), 0);
  const prev = previous && typeof previous === "object" && (await verifyPlan(previous as EditPlan)) ? (previous as EditPlan) : undefined;
  const ask = typeof instruction === "string" && instruction.trim() ? instruction.trim() : undefined;
  try {
    const plan = await makePlan({
      key: planKey({ sourceId: req.sourceId, aspect: req.aspect, cuts, overlays: req.overlays }),
      words: editedWords(analysis.transcript, keep),
      outDur,
      overlays: req.overlays,
      hint: ask ? { instruction: ask, previous: prev ? describePlan(prev) : undefined } : undefined,
    });
    console.info(`[video] storyboard ${plan.id}: ${plan.beats.length} moments, ${plan.graphics.length} graphics${ask ? ` (re-plan: "${ask.slice(0, 80)}")` : ""}`);
    return NextResponse.json({ ok: true, plan });
  } catch (e) {
    console.error("[video] storyboard failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t plan the storyboard. Try again." }, { status: 500 });
  }
}
