import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { getUpload, uploadFilePath } from "@/lib/video/storage";

export const dynamic = "force-dynamic";

/**
 * Serves a locally stored take (the mock processor's "rendered" output).
 * Supports Range requests so the browser can seek.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getUpload(id);
  if (!rec) return Response.json({ error: "Not found" }, { status: 404 });
  const file = uploadFilePath(rec);
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const headers: Record<string, string> = { "Content-Type": rec.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });
}
