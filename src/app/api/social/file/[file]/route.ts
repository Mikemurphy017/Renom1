import { readFileLink } from "@/lib/social/ayrshare";
import { serveObject } from "@/lib/storage/objects";
import { mediaKey } from "@/lib/storage/media";
import { getUpload, uploadKey } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/**
 * A finished video or cover, for Ayrshare and the networks to fetch. Public,
 * but only through a signed link that expires (see fileLink).
 */
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const link = readFileLink((await params).file);
  if (!link) return Response.json({ error: "Not found" }, { status: 404 });
  if (link.kind === "c") return serveObject(request, mediaKey(link.id), "public, max-age=86400", { "X-Robots-Tag": "noindex" });
  const rec = await getUpload(link.id);
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
  return serveObject(request, uploadKey(rec), "public, max-age=86400", { "X-Robots-Tag": "noindex" });
}
