import { NextResponse, type NextRequest } from "next/server"
import { exchangeCode, verifyIdToken } from "@/lib/google"
import {
  encodeSession,
  safeNextPath,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session"
import { resolveUserForSignIn } from "@/lib/auth"
import { OAUTH_STATE_COOKIE } from "../../signin/google/route"

function failure(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url)
  url.searchParams.set("error", reason)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  if (params.get("error")) return failure(request, "access_denied")

  const code = params.get("code")
  const state = params.get("state")
  const stored = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (!code || !state || !stored) return failure(request, "invalid_request")

  // Split on the FIRST colon only: the path may legitimately contain one, and
  // a plain split() would silently truncate the redirect target.
  const separator = stored.indexOf(":")
  const expectedState = separator === -1 ? stored : stored.slice(0, separator)
  const redirectTo = safeNextPath(separator === -1 ? null : stored.slice(separator + 1))

  // Constant-time-ish equality is unnecessary here (the state is single-use and
  // short-lived), but the check itself must never be skipped.
  if (!expectedState || state !== expectedState) return failure(request, "state_mismatch")

  try {
    const profile = await verifyIdToken(await exchangeCode(code))
    const result = await resolveUserForSignIn(profile)

    // Invite-only: an unknown Google account never gets a session.
    if ("error" in result) return failure(request, result.error)

    const response = NextResponse.redirect(new URL(redirectTo, request.url))
    response.cookies.set(
      SESSION_COOKIE,
      await encodeSession({
        sub: result.id,
        email: result.email,
        name: result.name ?? result.email,
        picture: result.avatarUrl ?? undefined,
      }),
      sessionCookieOptions,
    )
    response.cookies.delete(OAUTH_STATE_COOKIE)
    return response
  } catch (error) {
    console.error("Google sign-in failed:", error)
    return failure(request, "sign_in_failed")
  }
}
