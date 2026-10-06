import { promises as fs } from "node:fs";
import { musicBed } from "@/lib/video/local/audio-beds";
import type { MusicMood } from "@/lib/video/styles";

export const dynamic = "force-dynamic";

const MOODS: MusicMood[] = ["calm", "uplift", "pulse", "cinematic"];

/** A listen to a built-in music bed (generated on first request, then cached). */
export async function GET(_: Request, { params }: { params: Promise<{ mood: string }> }) {
  const { mood } = await params;
  if (!MOODS.includes(mood as MusicMood)) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const bytes = await fs.readFile(await musicBed(mood as MusicMood));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    console.error("[music] couldn't make the bed:", e);
    return Response.json({ error: "Couldn’t make the music" }, { status: 500 });
  }
}
