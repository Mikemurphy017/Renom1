import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { CinematicError, act, advance, getJob, removeJob, view } from "@/lib/cinematic/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const fail = (e: unknown) => (e instanceof CinematicError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[cinematic]", e), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 })));

/** Where one video is. Looking at it also moves it along. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const job = await getJob(id);
  if (!job || job.userId !== user.id) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const moved = job.status === "uploading" || job.status === "scene" || job.status === "filming" ? await advance(id) : job;
  return NextResponse.json({ ok: true, job: view(moved ?? job) }, { headers: { "Cache-Control": "no-store" } });
}

/** Body: { action: "approve" | "regenerate" | "retry" }. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const b = (await request.json().catch(() => null)) as { action?: string } | null;
  if (b?.action !== "approve" && b?.action !== "regenerate" && b?.action !== "retry") return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, job: view(await act(user, id, b.action)) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  try {
    await removeJob(user, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
