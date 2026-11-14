import { currentUser } from "@/lib/auth/server";
import { templateImage } from "@/lib/twin/server";

export const dynamic = "force-dynamic";

/** A template's cover picture, passed through so the page never loads it from the provider. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser(request))) return new Response(null, { status: 401 });
  const img = await templateImage((await params).id).catch(() => null);
  if (!img) return new Response(null, { status: 404 });
  return new Response(img.bytes as BodyInit, { headers: { "Content-Type": img.type, "Cache-Control": "private, max-age=86400" } });
}
