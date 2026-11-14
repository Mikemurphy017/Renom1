import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { isPro, proOnly } from "@/lib/billing/tier";
import { TwinError } from "@/lib/twin/heygen";
import { lookTemplates, viewTemplate } from "@/lib/twin/server";

export const dynamic = "force-dynamic";

/** The look templates and look packs an advisor can apply to their AI twin. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await isPro(user))) return proOnly("Looks for your AI twin");
  try {
    return NextResponse.json({ ok: true, templates: (await lookTemplates()).map(viewTemplate) }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (e) {
    const err = e instanceof TwinError ? e : null;
    if (!err) console.error("[twin templates]", e);
    return NextResponse.json({ ok: false, error: err?.message ?? "The templates couldn’t be loaded. Try again." }, { status: err?.status ?? 500 });
  }
}
