import { serveObject } from "@/lib/storage/objects";
import { getUpload, uploadKey } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/** Streams a stored take (and the mock processor's "rendered" output), with Range support for seeking. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getUpload(id);
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
  return serveObject(request, uploadKey(rec), "private, max-age=86400, immutable");
}
