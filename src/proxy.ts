// Proxy (Next.js 16: renamed from middleware)
// Light-touch auth gate for dashboard routes. Full session checks happen
// server-side in page loaders / server actions via auth().
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/sign-in",
  "/onboarding",
  "/api/auth",
  "/api/integrations/eod",
  "/_next",
  "/favicon",
  "/logo",
  "/images",
];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // NextAuth v5 JWT session cookie. When the JWT payload is large (we embed
  // role/department/profile-completeness claims), @auth/core splits it into
  // chunks — "authjs.session-token.0", ".1", etc. — and never sets the plain
  // "authjs.session-token" cookie. An exact-name lookup then misses logged-in
  // users, so match either the unchunked cookie or any of its chunks.
  const hasSessionCookie = request.cookies.getAll().some(
    (c) =>
      c.name === "authjs.session-token" ||
      c.name === "__Secure-authjs.session-token" ||
      c.name.startsWith("authjs.session-token.") ||
      c.name.startsWith("__Secure-authjs.session-token."),
  );

  if (!hasSessionCookie && pathname !== "/") {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.*|images/.*).*)"],
};
