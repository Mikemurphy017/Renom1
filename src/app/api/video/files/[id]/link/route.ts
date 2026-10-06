import { NextResponse } from "next/server";
import { publicLink } from "@/lib/storage/link";
import { getUpload, uploadKey } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getUpload(id);
  if (!rec) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return publicLink(uploadKey(rec));
}
