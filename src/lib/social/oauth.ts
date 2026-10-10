import { createHash, randomBytes } from "node:crypto";

/**
 * Buffer app client (OAuth 2.0 authorization code + PKCE), so advisors connect
 * their own Buffer with one click. Env: BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET
 * (from publish.buffer.com/settings/api → App Clients); optional
 * BUFFER_REDIRECT_URI (else this site's address + /api/social/callback; register
 * one per domain the app is served on, exactly).
 */

const AUTH_URL = process.env.BUFFER_AUTH_URL?.trim() || "https://auth.buffer.com/auth";
const TOKEN_URL = process.env.BUFFER_TOKEN_URL?.trim() || "https://auth.buffer.com/token";
/** Read the account and channels, create/check/delete posts, and stay connected (refresh tokens). */
export const SCOPES = "account:read posts:read posts:write offline_access";
/** If the app client can't grant offline_access, connect without it (advisors then reconnect when the token runs out). */
export const SCOPES_LITE = "account:read posts:read posts:write";

const clientId = () => process.env.BUFFER_CLIENT_ID?.trim() || "";
const clientSecret = () => process.env.BUFFER_CLIENT_SECRET?.trim() || "";
export const oauthConfigured = () => !!clientId();

/**
 * The address the advisor is on (renom.video, renom-ai.com…), so Buffer brings
 * them back to the same site, where their session is. Buffer only redirects to
 * URIs registered on the app client, so a forged host just fails.
 */
export function originOf(request: Request) {
  const u = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || u.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function redirectUri(origin: string) {
  return (process.env.BUFFER_REDIRECT_URI?.trim() || `${origin}/api/social/callback`).replace(/\s+/g, "");
}

export function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(18).toString("base64url") };
}

export function authorizeUrl(o: { redirectUri: string; state: string; challenge: string; lite?: boolean }) {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: o.lite ? SCOPES_LITE : SCOPES,
    state: o.state,
    code_challenge: o.challenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });
  return `${AUTH_URL}?${q}`;
}

export interface Tokens {
  access: string;
  /** Empty when Buffer gave none (no offline_access): the connection lasts as long as the access token. */
  refresh: string;
  /** ms epoch, a little early so a token doesn't run out mid-request. */
  expiresAt: number;
}

export class OAuthError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function tokenRequest(fields: Record<string, string>): Promise<Tokens> {
  const body = new URLSearchParams({ ...fields, client_id: clientId() });
  if (clientSecret()) body.set("client_secret", clientSecret());
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new OAuthError("Couldn’t reach Buffer. Try again in a moment.");
  }
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !j.access_token) {
    console.error(`[buffer-oauth] ${res.status} ${j.error ?? ""} ${j.error_description ?? ""}`);
    throw new OAuthError(j.error_description || "Buffer didn’t connect.", j.error);
  }
  // Refresh tokens rotate: a refresh that comes back without a new one can't be refreshed again.
  if (!j.refresh_token && fields.grant_type === "refresh_token") throw new OAuthError("Buffer didn’t return a new refresh token.", "invalid_grant");
  return { access: j.access_token, refresh: j.refresh_token ?? "", expiresAt: Date.now() + Math.max(60, (j.expires_in ?? 3600) - 60) * 1000 };
}

export const exchangeCode = (code: string, verifier: string, redirect: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier });
export const refreshTokens = (refresh: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
