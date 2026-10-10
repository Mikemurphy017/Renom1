import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { GeminiError, SETTINGS, editImage, geminiConfigured, locateFace, placedFace, scenePrompt } from "@/lib/ai/gemini";
import { objects } from "@/lib/storage/objects";
import { mediaKey, mediaUrl, newMediaId } from "@/lib/storage/media";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Scenes per advisor per hour: each one costs the studio money. */
const PER_HOUR = 20;
const recent = new Map<string, number[]>();

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Whether AI scenes are available. */
export async function GET(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, configured: geminiConfigured(), settings: Object.keys(SETTINGS) });
}

/**
 * A new photo of the advisor in a scene that fits the video, for a cover.
 * Body: { image: data URL (JPEG/PNG/WebP), shape, side, setting, title, topic?, extra? }.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!geminiConfigured()) return NextResponse.json({ ok: false, error: "AI scenes aren’t set up for this studio yet." }, { status: 503 });
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const m = typeof b?.image === "string" ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.image) : null;
  if (!b || !m) return NextResponse.json({ ok: false, error: "Send a photo to start from." }, { status: 400 });
  const image = new Uint8Array(Buffer.from(m[2], "base64"));
  if (image.length > 6 * 1024 * 1024) return NextResponse.json({ ok: false, error: "That photo is too large." }, { status: 413 });

  const now = Date.now();
  const mine = (recent.get(user.id) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= PER_HOUR) return NextResponse.json({ ok: false, error: `That’s ${PER_HOUR} scenes this hour. Try again a little later.` }, { status: 429 });
  recent.set(user.id, [...mine, now]);

  const shape = b.shape === "short" ? "short" : "long";
  const setting = typeof b.setting === "string" && SETTINGS[b.setting] ? b.setting : Object.keys(SETTINGS)[Math.floor(Math.random() * Object.keys(SETTINGS).length)];
  try {
    const out = await editImage({
      image,
      mimeType: m[1],
      aspect: shape === "short" ? "9:16" : "16:9",
      prompt: scenePrompt({ title: str(b.title, 200) || "Financial planning", topic: str(b.topic, 600) || undefined, extra: str(b.extra, 200) || undefined, setting, shape, side: b.side === "left" ? "left" : "right" }),
    });
    const id = newMediaId();
    const side = b.side === "left" ? "left" : "right";
    // Where the face is: browsers guess from skin tones, which wood and brass fool, so ask.
    const [face] = await Promise.all([locateFace(out.bytes, out.mimeType), objects().put(mediaKey(id), out.bytes, out.mimeType)]);
    return NextResponse.json({ ok: true, id, url: mediaUrl(id), setting, face: face ?? placedFace(shape, side) });
  } catch (e) {
    // A failed attempt doesn't count against the hour.
    recent.set(user.id, (recent.get(user.id) ?? []).filter((t) => t !== now));
    if (e instanceof GeminiError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    console.error("[scene]", e);
    return NextResponse.json({ ok: false, error: "Couldn’t make the scene." }, { status: 500 });
  }
}
