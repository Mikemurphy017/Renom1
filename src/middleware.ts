import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userForToken } from "@/lib/auth/server";

/**
 * Everything is behind sign-in except the sign-in pages and the auth API.
 * Runs on the Node.js runtime so it can check the session against the store.
 */
const PUBLIC = [/^\/signin$/, /^\/signup$/, /^\/api\/auth\//];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const user = await userForToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.some((p) => p.test(pathname))) {
    // Already signed in: skip the sign-in pages.
    if (user && (pathname === "/signin" || pathname === "/signup")) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const to = new URL("/signin", req.url);
  if (pathname !== "/") to.searchParams.set("next", pathname + search);
  return NextResponse.redirect(to);
}

export const config = {
  runtime: "nodejs",
  // Skip Next's own files and static assets.
  matcher: ["/((?!_next/|fonts/|favicon|icon|apple-icon|robots.txt|sitemap.xml).*)"],
};
