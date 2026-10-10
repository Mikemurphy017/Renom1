import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { geminiConfigured, locateFace } from "@/lib/ai/gemini";
import { objects } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

/** Where the face is in a stored photo (an AI scene made before scenes came with one). Body: { id }. */
export async function POST(request: Request) {
  if (!(await currentUser(request))) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!geminiConfigured()) return NextResponse.json({ ok: true, face: null });
  const b = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!isMediaId(b?.id)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const got = await objects().read(mediaKey(b.id as string));
  if (!got) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const bytes = new Uint8Array(await new Response(got.body).arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) return NextResponse.json({ ok: true, face: null });
  return NextResponse.json({ ok: true, face: await locateFace(bytes, got.contentType || "image/png") });
}
