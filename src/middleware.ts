import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, SESSION_COOKIE, userForToken } from "@/lib/auth/server";

/**
 * Everything is behind sign-in except the sales page, the sign-in and password
 * reset pages, and the auth API. Signed-out visitors to "/" see the sales page.
 * Runs on the Node.js runtime so it can check the session against the store.
 */
const PUBLIC = [/^\/signin$/, /^\/signup$/, /^\/forgot$/, /^\/reset$/, /^\/landing$/, /^\/privacy$/, /^\/terms$/, /^\/api\/auth\//];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const user = await userForToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.some((p) => p.test(pathname))) {
    // Already signed in: skip the sign-in pages.
    if (user && (pathname === "/signin" || pathname === "/signup" || pathname === "/forgot")) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  // The admin pages don't exist for anyone else (the page and its API check again).
  if (user && /^\/admin(\/|$)/.test(pathname) && !isAdmin(user)) return NextResponse.rewrite(new URL("/_admin-not-found", req.url));
  // Buffer is the team's tool: advisors never see its accounts or posts.
  if (user && pathname.startsWith("/api/buffer/") && !isAdmin(user)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  if (user) return NextResponse.next();

  // Signed-out visitors to the home page get the sales page.
  if (pathname === "/") return NextResponse.rewrite(new URL("/landing", req.url));

  // The app shell asks for the studio on every page, the sales and sign-in pages
  // included: "nobody signed in" is an answer there, not an error.
  if (pathname === "/api/state" && req.method === "GET") return new NextResponse(null, { status: 204 });
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const to = new URL("/signin", req.url);
  to.searchParams.set("next", pathname + search);
  return NextResponse.redirect(to);
}

export const config = {
  runtime: "nodejs",
  // Skip Next's own files and static assets. The two upload routes check the
  // session themselves: running middleware on them would buffer the body and
  // cut it off at 10 MB.
  matcher: ["/((?!_next/|fonts/|favicon|icon|apple-icon|brand/|manifest.webmanifest|robots.txt|sitemap.xml|api/video/upload$|api/media$|api/social/file/).*)"],
};
