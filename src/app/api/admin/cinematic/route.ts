import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { higgsfieldConfigured } from "@/lib/cinematic/higgsfield";
import { imageModel, videoModel } from "@/lib/cinematic/models";
import { adminUsage } from "@/lib/cinematic/server";
import { PLANS } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Cinematic video usage and cost per advisor and per video, against the Pro plan's price. */
export async function GET(request: Request) {
  const { denied } = await requireAdmin(request);
  if (denied) return denied;
  const pro = PLANS.find((p) => p.id === "pro");
  return NextResponse.json({ ok: true, configured: higgsfieldConfigured(), models: { image: imageModel().id, video: videoModel().id }, proMonthly: pro?.monthly ?? 497, advisors: await adminUsage() }, { headers: { "Cache-Control": "no-store" } });
}
