import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { higgsfieldConfigured, HfError } from "@/lib/cinematic/higgsfield";
import { videoModels } from "@/lib/cinematic/models";
import { TestError, listTests, startTest } from "@/lib/cinematic/test-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The admin's test runs (newest first, each moved along), and the models they can use. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json(
    { ok: true, on: await higgsfieldConfigured(), models: videoModels().map((m) => ({ id: m.id, label: m.label, minSeconds: m.minSeconds, maxSeconds: m.maxSeconds })), runs: await listTests() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Start one: multipart with image, prompt, model, seconds, resolution, aspect. */
export async function POST(request: Request) {
  const { admin, denied } = await requireAdmin(request);
  if (denied) return denied;
  if (!(await higgsfieldConfigured())) return NextResponse.json({ ok: false, error: "Switch cinematic videos on first (add the API key above)." }, { status: 503 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn’t read the form." }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof Blob)) return NextResponse.json({ ok: false, error: "Add the still image." }, { status: 400 });
  try {
    const run = await startTest({
      by: admin.email,
      image: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      prompt: String(form.get("prompt") ?? ""),
      model: String(form.get("model") ?? ""),
      seconds: Number(form.get("seconds")),
      resolution: String(form.get("resolution") ?? ""),
      aspect: String(form.get("aspect") ?? ""),
    });
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    if (e instanceof TestError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    if (e instanceof HfError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status && e.status < 500 ? 400 : 502 });
    console.error("[cinematic] test run:", e);
    return NextResponse.json({ ok: false, error: "Couldn’t start the test." }, { status: 500 });
  }
}
