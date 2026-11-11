/**
 * Higgsfield smoke test: one Seedance 2.5 text-to-video generation through the
 * official SDK's subscribe(), waiting for it to finish.
 *
 *   node --env-file=.env.local scripts/higgsfield/index.ts
 *
 * Needs HF_CREDENTIALS="key-id:key-secret" (read by the SDK from the
 * environment; never printed here). This makes one billable request.
 * Exits 0 only when a video URL came back.
 */
import { higgsfield } from "@higgsfield/client/v2";

const MODEL = "bytedance/seedance-2.5/text-to-video";

type Result = {
  status?: string;
  request_id?: string;
  video?: { url?: string };
  // Older SDK shape, kept in case subscribe() returns a JobSet.
  isCompleted?: boolean;
  isFailed?: boolean;
  isNsfw?: boolean;
  isCanceled?: boolean;
  jobs?: { results?: { raw?: { url?: string } } }[];
};

async function main() {
  if (!process.env.HF_CREDENTIALS?.includes(":")) {
    console.error('HF_CREDENTIALS is not set. Add HF_CREDENTIALS="key-id:key-secret" to .env.local.');
    process.exit(2);
  }
  console.log(`Submitting to ${MODEL} (5s, 720p, 16:9)…`);
  const r = (await higgsfield.subscribe(MODEL, {
    input: { prompt: "A cinematic scene at sunset", duration: 5, resolution: "720p", aspect_ratio: "16:9" },
    withPolling: true,
  })) as unknown as Result;

  const status = r.status ?? (r.isCompleted ? "completed" : r.isNsfw ? "nsfw" : r.isCanceled ? "canceled" : r.isFailed ? "failed" : "unknown");
  const url = r.video?.url ?? r.jobs?.[0]?.results?.raw?.url;
  if (r.request_id) console.log(`Request: ${r.request_id}`);

  if (status === "completed" && url) {
    console.log(`Completed. Video URL: ${url}`);
    return;
  }
  if (status === "nsfw") console.error("Not generated: the request was rejected by moderation (credits are refunded).");
  else if (status === "canceled" || status === "cancelled") console.error("Not generated: the request was canceled.");
  else if (status === "failed") console.error("Not generated: the generation failed (credits are refunded).");
  else if (status === "completed") console.error("Finished, but no video URL came back.");
  else console.error(`Not generated: ended with status "${status}".`);
  process.exit(1);
}

main().catch((e: { name?: string; message?: string; statusCode?: number; status?: number; data?: unknown; response?: { status?: number; data?: unknown } }) => {
  const code = e.statusCode ?? e.status ?? e.response?.status;
  const detail = e.data ?? e.response?.data;
  const text = `${e.message ?? ""} ${typeof detail === "string" ? detail : JSON.stringify(detail ?? "")}`;
  console.error(`Request failed${code ? ` (HTTP ${code})` : ""}: ${e.name ?? "Error"}: ${e.message ?? e}`);
  if (detail) console.error(`Details: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`.slice(0, 600));
  if (/plan|entitle|upgrade|subscription/i.test(text)) console.error("This looks like a plan or entitlement limit on the Higgsfield account (a billing matter, not a setup problem).");
  process.exit(1);
});
