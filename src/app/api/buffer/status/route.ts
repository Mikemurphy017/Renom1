import { NextResponse } from "next/server";
import { getBufferStatus } from "@/lib/buffer/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBufferStatus());
}
