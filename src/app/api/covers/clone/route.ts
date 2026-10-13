import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { CLONE_LOOKS, GeminiError, clonePrompt, editImage, geminiConfigured, locateFace } from "@/lib/ai/gemini";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey, mediaUrl, newMediaId } from "@/lib/storage/media";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Photos per advisor per hour: each one costs the studio money (a full set is eight). */
const PER_HOUR = 24;
const recent = new Map<string, number[]>();

/** Whether the photo set can be made, and the looks in it. */
export async function GET(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, configured: geminiConfigured(), looks: CLONE_LOOKS.map(({ id, label }) => ({ id, label })) });
}

/**
 * One photo of the advisor's AI photo set, made from their headshots.
 * Body: { headshots: media ids (1–4, the same person), look: one of CLONE_LOOKS }.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!geminiConfigured()) return NextResponse.json({ ok: false, error: "AI photos aren’t set up for this studio yet." }, { status: 503 });
  const b = (await request.json().catch(() => null)) as { headshots?: unknown; look?: unknown } | null;
  const ids = Array.isArray(b?.headshots) ? b.headshots.filter(isMediaId).slice(0, 4) : [];
  const look = CLONE_LOOKS.find((l) => l.id === b?.look);
  if (!ids.length || !look) return NextResponse.json({ ok: false, error: "Add a headshot first." }, { status: 400 });

  const refs: { bytes: Uint8Array; mimeType: string }[] = [];
  for (const id of ids) {
    const r = await objects().read(mediaKey(id)).catch(() => null);
    if (!r || !/^image\/(jpeg|png|webp)$/.test(r.contentType)) continue;
    const bytes = new Uint8Array(await new Response(r.body).arrayBuffer());
    if (bytes.length <= 8 * 1024 * 1024) refs.push({ bytes, mimeType: r.contentType });
  }
  if (!refs.length) return NextResponse.json({ ok: false, error: "Those headshots couldn’t be read. Upload them again in Settings." }, { status: 400 });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= PER_HOUR) return NextResponse.json({ ok: false, error: `That’s ${PER_HOUR} AI photos this hour. Try again a little later.` }, { status: 429 });
  recent.set(user.id, [...mine, now]);

  try {
    const out = await editImage({ images: refs, prompt: clonePrompt(look, refs.length), aspect: "3:4" });
    const id = newMediaId();
    const [face] = await Promise.all([locateFace(out.bytes, out.mimeType), objects().put(mediaKey(id), out.bytes, out.mimeType)]);
    return NextResponse.json({ ok: true, photo: { id, url: mediaUrl(id), look: look.id, label: look.label, face: face ?? null } });
  } catch (e) {
    // A failed attempt doesn't count against the hour.
    recent.set(user.id, (recent.get(user.id) ?? []).filter((t) => t !== now));
    if (e instanceof GeminiError) return NextResponse.json({ ok: false, error: e.message.replace("AI scenes", "AI photos") }, { status: e.status });
    console.error("[clone]", e);
    return NextResponse.json({ ok: false, error: "Couldn’t make that photo." }, { status: 500 });
  }
}
