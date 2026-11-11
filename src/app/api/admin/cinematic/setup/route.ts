import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { KeyError, keyStatus, removeKey, saveKey } from "@/lib/cinematic/higgsfield";

export const dynamic = "force-dynamic";

const fail = (e: unknown) => (e instanceof KeyError ? NextResponse.json({ ok: false, error: e.message }, { status: e.status }) : (console.error("[cinematic] setup:", (e as Error).message), NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 })));

/** Whether cinematic videos are switched on, and where the key comes from. Never the key. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, ...(await keyStatus()) }, { headers: { "Cache-Control": "no-store" } });
}

/** Switch on: body { key: "key-id:key-secret" }. Checked with Higgsfield first; saved encrypted only if accepted. */
export async function POST(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const b = (await request.json().catch(() => null)) as { key?: unknown } | null;
  try {
    await saveKey(typeof b?.key === "string" ? b.key : "");
    return NextResponse.json({ ok: true, ...(await keyStatus()) });
  } catch (e) {
    return fail(e);
  }
}

/** Switch off: removes the key saved here (a key in the server's environment stays). */
export async function DELETE(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  try {
    await removeKey();
    return NextResponse.json({ ok: true, ...(await keyStatus()) });
  } catch (e) {
    return fail(e);
  }
}
