import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { unseal } from "@/lib/secrets";
import { exchangeCode, originOf, redirectUri } from "@/lib/social/oauth";
import { SocialError, saveConnection } from "@/lib/social/server";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Buffer sends the advisor back here after the consent screen. */
export async function GET(request: Request) {
  const origin = originOf(request);
  const url = new URL(request.url);
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)renom_buffer_oauth=([^;]+)/)?.[1];
  const saved = raw ? (JSON.parse(unseal(decodeURIComponent(raw)) ?? "null") as { state: string; verifier: string; back: string; uid: string; at: number } | null) : null;
  const back = saved?.back ?? "/settings#publishing";
  const done = (result: string) => {
    const [path, hash] = back.split("#");
    const res = NextResponse.redirect(`${origin}${path}${path.includes("?") ? "&" : "?"}buffer=${result}${hash ? `#${hash}` : ""}`);
    res.cookies.set("renom_buffer_oauth", "", { path: "/api/social", maxAge: 0 });
    return res;
  };

  const user = await currentUser(request);
  if (!user) return NextResponse.redirect(`${origin}/signin`);
  if (url.searchParams.get("error")) return done(url.searchParams.get("error") === "access_denied" ? "denied" : "failed");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // The round trip must be the one this advisor started, recently.
  if (!saved || !code || !state || !same(state, saved.state) || saved.uid !== user.id || Date.now() - saved.at > 600_000) return done("failed");

  try {
    const tokens = await exchangeCode(code, saved.verifier, redirectUri(origin));
    await saveConnection(user, tokens);
    return done("connected");
  } catch (e) {
    console.error("[buffer-oauth] callback:", (e as Error).message);
    return done(e instanceof SocialError && e.status === 403 ? "studio" : "failed");
  }
}
