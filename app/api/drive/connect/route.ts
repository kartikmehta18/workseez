import { NextResponse } from "next/server"
import { getCurrentActor } from "@/lib/auth"
import { DRIVE_SCOPE } from "@/lib/drive"
import { driveAuthorizationUrl } from "@/lib/google"
import { DRIVE_OAUTH_STATE_COOKIE } from "@/lib/post-upload"

/**
 * Starts connecting the Google account uploads go through. Run once by the
 * Super Admin, and again only if that connection is ever revoked.
 */
export async function GET() {
  const actor = await getCurrentActor()
  if (actor?.status !== "ACTIVE" || actor.role !== "SUPER_ADMIN") {
    return new Response("Only the Super Admin can connect Google Drive.", { status: 403 })
  }

  // `state` is echoed back by Google and compared against this cookie to block CSRF.
  const state = crypto.randomUUID()
  const response = NextResponse.redirect(driveAuthorizationUrl(state, DRIVE_SCOPE))
  response.cookies.set(DRIVE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/drive",
    maxAge: 600,
  })
  return response
}
