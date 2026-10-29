import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { GeminiError, POST_SCENES, editImage, geminiConfigured, postPhotoPrompt } from "@/lib/ai/gemini";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey, mediaUrl, newMediaId } from "@/lib/storage/media";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Post photos per advisor per hour: each one costs the studio money. */
const PER_HOUR = 30;
const recent = new Map<string, number[]>();
const ASPECTS = ["1:1", "4:5", "16:9"] as const;

/** Whether AI post photos are available, and the ready-made settings. */
export async function GET(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, configured: geminiConfigured(), scenes: POST_SCENES.map(({ id, label, brief }) => ({ id, label, brief })) });
}

/**
 * A photo of the advisor in a scene, made from their headshots, for a post.
 * Body: { headshots: media ids (1–4, the same person), scene: a POST_SCENES id or the advisor's own words, aspect }.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!geminiConfigured()) return NextResponse.json({ ok: false, error: "AI images aren’t set up for this studio yet." }, { status: 503 });
  const b = (await request.json().catch(() => null)) as { headshots?: unknown; scene?: unknown; aspect?: unknown } | null;
  const ids = Array.isArray(b?.headshots) ? b.headshots.filter(isMediaId).slice(0, 4) : [];
  const raw = typeof b?.scene === "string" ? b.scene.trim().slice(0, 600) : "";
  const scene = POST_SCENES.find((s) => s.id === raw)?.brief ?? raw;
  const aspect = ASPECTS.find((a) => a === b?.aspect) ?? "1:1";
  if (!ids.length) return NextResponse.json({ ok: false, error: "Add a headshot in Settings first: the picture is made from your photos." }, { status: 400 });
  if (scene.length < 8) return NextResponse.json({ ok: false, error: "Describe the scene, or pick one." }, { status: 400 });

  const refs: { bytes: Uint8Array; mimeType: string }[] = [];
  for (const id of ids) {
    const r = await objects().read(mediaKey(id)).catch(() => null);
    if (!r) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(r.contentType)) {
      void r.body.cancel().catch(() => {});
      continue;
    }
    const bytes = new Uint8Array(await new Response(r.body).arrayBuffer());
    if (bytes.length <= 8 * 1024 * 1024) refs.push({ bytes, mimeType: r.contentType });
  }
  if (!refs.length) return NextResponse.json({ ok: false, error: "Your headshots couldn’t be read. Upload them again in Settings." }, { status: 400 });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= PER_HOUR) return NextResponse.json({ ok: false, error: `That’s ${PER_HOUR} AI images this hour. Try again a little later.` }, { status: 429 });
  recent.set(user.id, [...mine, now]);

  try {
    const out = await editImage({ images: refs, prompt: postPhotoPrompt(scene, refs.length), aspect });
    const id = newMediaId();
    await objects().put(mediaKey(id), out.bytes, out.mimeType);
    return NextResponse.json({ ok: true, image: { id, url: mediaUrl(id), source: "ai", scene, aspect } });
  } catch (e) {
    // A failed attempt doesn't count against the hour.
    recent.set(user.id, (recent.get(user.id) ?? []).filter((t) => t !== now));
    if (e instanceof GeminiError) return NextResponse.json({ ok: false, error: e.message.replace("AI scenes", "AI images") }, { status: e.status });
    console.error("[posts/image]", e);
    return NextResponse.json({ ok: false, error: "Couldn’t make that image." }, { status: 500 });
  }
}
