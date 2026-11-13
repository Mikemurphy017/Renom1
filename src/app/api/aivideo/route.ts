import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { TwinError, twinConfigured } from "@/lib/twin/heygen";
import { MAX_SCRIPT_WORDS, TwinUserError, isReady, listJobs, monthlyLimit, readTwin, startAiVideo, viewJob } from "@/lib/twin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fail = (e: unknown) =>
  e instanceof TwinUserError || e instanceof TwinError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[aivideo]", e), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 }));

/** The advisor's AI videos and whether they can make one now. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const [jobs, twin, pro] = await Promise.all([listJobs(user.id), readTwin(user.id), isPro(user)]);
  return NextResponse.json({ ok: true, available: twinConfigured(), pro, twinReady: isReady(twin), limits: { maxWords: MAX_SCRIPT_WORDS, perMonth: monthlyLimit() }, jobs: jobs.map(viewJob) }, { headers: { "Cache-Control": "no-store" } });
}

/** Start one: { script, videoId?, aspect?, lookId?, title? }. */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("AI videos");
  try {
    const job = await startAiVideo(user, (await request.json().catch(() => ({}))) ?? {});
    return NextResponse.json({ ok: true, job: viewJob(job) });
  } catch (e) {
    return fail(e);
  }
}
