import { NextResponse } from "next/server";
import { objects } from "./objects";

/** Seven-day public link for handing a file to Buffer or a social network. */
export async function publicLink(key: string) {
  if (!(await objects().stat(key))) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const url = await objects().signedUrl(key, 7 * 24 * 3600);
  if (!url) return NextResponse.json({ ok: false, error: "Public links need the storage bucket to be connected." }, { status: 501 });
  return NextResponse.json({ ok: true, url, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() });
}
