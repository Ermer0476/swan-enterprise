import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "swan_session";

/**
 * Edge gate: redirect unauthenticated requests to /login before any protected
 * page renders. This is a coarse presence check on the session cookie — full
 * JWT verification happens server-side in `getCurrentUser()`. Running here
 * avoids protected pages throwing UNAUTHENTICATED during render.
 */
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except the login page, auth/api routes, and static assets.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
