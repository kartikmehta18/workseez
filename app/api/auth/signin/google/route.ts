import { NextResponse, type NextRequest } from "next/server"
import { authorizationUrl } from "@/lib/google"
import { safeNextPath } from "@/lib/session"

export const OAUTH_STATE_COOKIE = "workseez_oauth_state"

export async function GET(request: NextRequest) {
  // `state` is echoed back by Google and compared against this cookie to block CSRF.
  const state = crypto.randomUUID()
  // Only same-origin relative paths, so `next` can't be used as an open redirect.
  const redirectTo = safeNextPath(request.nextUrl.searchParams.get("next"))

  const response = NextResponse.redirect(authorizationUrl(state))
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}:${redirectTo}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })
  return response
}
