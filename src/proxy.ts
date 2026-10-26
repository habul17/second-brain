import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

const PUBLIC = ["/login", "/signup", "/forgot-password", "/reset-password", "/check-email"]

// Fast, optimistic check: no session cookie → go log in. Pages still verify the session for real.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/login", request.url))
  return NextResponse.next()
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|sw\\.js|manifest\\.webmanifest|icon|apple-icon|.*\\.(?:svg|png|ico|txt|json)$).*)"],
}
