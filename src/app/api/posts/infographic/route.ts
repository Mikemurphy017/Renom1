import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { planInfographics } from "@/lib/ai/infographic";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** { text, topic } → three infographic plans for the post (drawn in the browser). */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const b = (await request.json().catch(() => null)) as { text?: unknown; topic?: unknown } | null;
  const text = typeof b?.text === "string" ? b.text.trim() : "";
  if (text.length < 20) return NextResponse.json({ ok: false, error: "Write the post first: the infographic is made from it." }, { status: 400 });
  try {
    const options = await planInfographics({ text, topic: typeof b?.topic === "string" ? b.topic.slice(0, 200) : "" });
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    console.error("[infographic]", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message || "Couldn’t make the infographic. Try again." }, { status: 502 });
  }
}
