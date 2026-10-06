import { NextResponse } from "next/server";
import { getAggregatedMetrics } from "@/lib/buffer/server";
import { fail, fromError, isBufferId, listParam, notConnected, parseDate } from "@/lib/buffer/route";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

/**
 * GET /api/buffer/metrics?days=30            last N days (1–365), ending now
 * GET /api/buffer/metrics?from=ISO&to=ISO    an explicit range (up to 366 days)
 * Optional &channelId=a,b to limit to some channels. Totals across posts published in the range.
 */
export async function GET(request: Request) {
  const off = notConnected();
  if (off) return off;
  const q = new URL(request.url).searchParams;

  let start: string | null;
  let end: string | null;
  if (q.has("from") || q.has("to")) {
    start = parseDate(q.get("from"));
    end = q.has("to") ? parseDate(q.get("to")) : new Date().toISOString();
    if (!start || !end) return fail("from and to must be dates");
    if (start >= end) return fail("from must be before to");
    if (Date.parse(end) - Date.parse(start) > 366 * DAY) return fail("Range can be at most 366 days");
  } else {
    const days = q.has("days") ? Number(q.get("days")) : 30;
    if (!Number.isInteger(days) || days < 1 || days > 365) return fail("days must be 1–365");
    const now = Date.now();
    start = new Date(now - days * DAY).toISOString();
    end = new Date(now).toISOString();
  }
  const channelIds = listParam(q, "channelId");
  if (!channelIds.every(isBufferId)) return fail("channelId is invalid");

  try {
    return NextResponse.json({ ok: true, ...(await getAggregatedMetrics({ start, end, channelIds })) });
  } catch (e) {
    return fromError(e);
  }
}
