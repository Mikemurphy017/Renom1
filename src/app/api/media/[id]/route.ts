import { serveObject } from "@/lib/storage/objects";
import { isMediaId, mediaKey } from "@/lib/storage/media";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isMediaId(id)) return Response.json({ error: "Not found" }, { status: 404 });
  return serveObject(request, mediaKey(id), "private, max-age=31536000, immutable");
}
