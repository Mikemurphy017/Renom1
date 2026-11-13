import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { TwinUserError, advanceJob, getOwnJob, viewJob } from "@/lib/twin/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Where one AI video is. Looking at it also moves it along. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    const job = await getOwnJob(user, (await params).id);
    const moved = job.status === "working" ? await advanceJob(job.id) : job;
    return NextResponse.json({ ok: true, job: viewJob(moved ?? job) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof TwinUserError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[aivideo]", e);
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
