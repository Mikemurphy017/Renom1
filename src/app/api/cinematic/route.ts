import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { higgsfieldConfigured } from "@/lib/cinematic/higgsfield";
import { videoModel } from "@/lib/cinematic/models";
import { maxWordsFor } from "@/lib/cinematic/core";
import { CinematicError, CONSENT_TEXT, advance, createJob, listJobs, monthlyLimit, view } from "@/lib/cinematic/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (e: unknown) => (e instanceof CinematicError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[cinematic]", e), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 })));

/**
 * Cinematic videos are an admin tool (Admin → Cinematic); nothing here is open to advisors.
 * The admin's own videos, newest first, and the limits the form works to.
 */
export async function GET(request: Request) {
  const { admin: user, denied } = await requireAdmin(request);
  if (denied) return denied;
  const jobs = await listJobs(user.id);
  const m = videoModel();
  return NextResponse.json(
    { ok: true, available: await higgsfieldConfigured(), jobs: jobs.map(view), limits: { maxSeconds: m.maxSeconds, maxWords: maxWordsFor(m.maxSeconds), perMonth: monthlyLimit() }, consentText: CONSENT_TEXT },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Start one: headshots (their own media ids), script, setting, wardrobe, voice, shape, consent. */
export async function POST(request: Request) {
  const { admin: user, denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    const job = await createJob(user, (await request.json().catch(() => ({}))) ?? {});
    // Start the still now; the page follows it from here.
    const moved = await advance(job.id);
    return NextResponse.json({ ok: true, job: view(moved ?? job) });
  } catch (e) {
    return fail(e);
  }
}
