import { NextResponse } from "next/server";
import { publicLink } from "@/lib/storage/link";
import { isMediaId, mediaKey } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isMediaId(id)) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return publicLink(mediaKey(id));
}
