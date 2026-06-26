import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const SESSION_COOKIE = "ramen_session";
const PUBLIC_PATHS = ["/login"];
// Fully open, no-auth pages — accessible to anyone, with no auth redirects in
// either direction (e.g. the public order page shared with customers).
const OPEN_PATHS = ["/p/"];

/**
 * Coarse route protection. Pages additionally call requireUser() for the
 * authoritative check (and signed-token verification in dev mode).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Open pages bypass all auth logic (including the logged-in → "/" redirect).
  if (OPEN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const mode = process.env.AUTH_MODE === "supabase" ? "supabase" : "dev";

  if (mode === "supabase") {
    const { response, hasUser } = await updateSupabaseSession(request);
    if (!hasUser && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (hasUser && isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Dev mode: presence check only (full verification happens server-side).
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (hasCookie && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
