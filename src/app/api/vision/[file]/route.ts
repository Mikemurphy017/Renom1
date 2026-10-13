import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * The image-segmentation runtime (MediaPipe's WebAssembly), served from the
 * installed package so the browser can cut the advisor out of a photo for
 * covers without reaching a CDN. Only the package's own files.
 */
const FILES: Record<string, string> = {
  "vision_wasm_internal.js": "text/javascript",
  "vision_wasm_internal.wasm": "application/wasm",
  "vision_wasm_nosimd_internal.js": "text/javascript",
  "vision_wasm_nosimd_internal.wasm": "application/wasm",
};

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const type = FILES[file];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const body = await fs.readFile(path.join(process.cwd(), "node_modules", "@mediapipe", "tasks-vision", "wasm", file));
    return new Response(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
