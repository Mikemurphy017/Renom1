import { serveObject } from "@/lib/storage/objects";
import { getUpload, uploadKey } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/**
 * Streams a stored video (a take or a rendered MP4), with Range support for seeking.
 * `?download=<name>` saves it as a file instead of playing it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getUpload(id);
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
  const name = new URL(request.url).searchParams.get("download");
  const ext = uploadKey(rec).split(".").pop();
  const safe = name ? `${name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "video"}.${ext}` : null;
  return serveObject(request, uploadKey(rec), "private, max-age=86400, immutable", safe ? { "Content-Disposition": `attachment; filename="${safe}"` } : {});
}
