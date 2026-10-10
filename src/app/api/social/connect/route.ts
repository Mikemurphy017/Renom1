import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { seal } from "@/lib/secrets";
import { authorizeUrl, originOf, pkce, redirectUri } from "@/lib/social/oauth";
import { socialAvailable } from "@/lib/social/server";

export const dynamic = "force-dynamic";

/** Only ever send the advisor back to a page of this app. */
const safeBack = (v: string | null) => (v && /^\/[A-Za-z0-9/_?=&.#-]{0,200}$/.test(v) && !v.startsWith("//") ? v : "/settings#publishing");

/** Start connecting the advisor's own Buffer: off to Buffer's consent screen. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  const origin = originOf(request);
  if (!user) return NextResponse.redirect(`${origin}/signin`);
  const q = new URL(request.url).searchParams;
  const back = safeBack(q.get("back"));
  const lite = q.get("lite") === "1";
  if (!socialAvailable()) return NextResponse.redirect(`${origin}${back.split("#")[0]}${back.includes("?") ? "&" : "?"}buffer=unavailable`);
  const { verifier, challenge, state } = pkce();
  const res = NextResponse.redirect(authorizeUrl({ redirectUri: redirectUri(origin), state, challenge, lite }));
  // The verifier and state wait here (encrypted, unreadable to page scripts) for Buffer to send the advisor back.
  res.cookies.set("renom_buffer_oauth", seal(JSON.stringify({ state, verifier, back, uid: user.id, at: Date.now(), lite })), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/social",
    maxAge: 600,
  });
  return res;
}
