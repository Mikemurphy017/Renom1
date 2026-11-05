/**
 * Server start-up hook. With HEYGEN_PROBE=1, makes a few read-only (or
 * deliberately empty, so invalid and unbilled) requests to the avatar video
 * service and logs status and a short body, to confirm the account and the
 * API's shapes from the live server. Never logs the key.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.HEYGEN_PROBE !== "1" || !process.env.HEYGEN_API_KEY) return;
  const key = process.env.HEYGEN_API_KEY.trim();
  const base = "https://api.heygen.com";
  const probes: [string, string, unknown?][] = [
    ["GET", "/v3/avatars"],
    ["GET", "/v3/avatars/looks"],
    ["GET", "/v3/voices"],
    ["GET", "/v3/videos"],
    ["GET", "/v2/user/remaining_quota"],
    ["POST", "/v3/avatars", {}],
    ["POST", "/v3/avatars", { type: "photo" }],
    ["POST", "/v3/videos", {}],
    ["POST", "/v3/videos", { type: "avatar", engine: { type: "avatar_v" } }],
    ["POST", "/v3/assets", {}],
  ];
  setTimeout(async () => {
    for (const [method, path, body] of probes) {
      try {
        const res = await fetch(base + path, { method, headers: { "x-api-key": key, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
        const text = (await res.text()).replace(key, "[key]").replace(/\s+/g, " ").slice(0, 2500);
        console.log(`[heygen-probe] ${method} ${path} ${body ? JSON.stringify(body) : ""} -> ${res.status} ${text}`);
      } catch (e) {
        console.log(`[heygen-probe] ${method} ${path} -> error ${(e as Error).message}`);
      }
    }
  }, 5000);
}
