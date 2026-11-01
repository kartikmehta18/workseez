import type { NextRequest } from "next/server"
import { getCurrentActor } from "@/lib/auth"
import { exchangeDriveCode } from "@/lib/google"
import { DRIVE_OAUTH_STATE_COOKIE } from "@/lib/post-upload"

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

function page(body: string, status: number) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Drive — Workseez</title>
    <body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;line-height:1.5">
    ${body}</body>`,
    {
      status,
      // The success page holds a long-lived credential: never keep a copy of it.
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  )
}

/**
 * Finishes connecting Drive by showing the refresh token once, for the Super
 * Admin to set as GOOGLE_DRIVE_REFRESH_TOKEN. It is deliberately not logged, and
 * it lives in the deployment's variables with every other secret.
 */
export async function GET(request: NextRequest) {
  const actor = await getCurrentActor()
  if (actor?.status !== "ACTIVE" || actor.role !== "SUPER_ADMIN") {
    return page("<p>Only the Super Admin can connect Google Drive.</p>", 403)
  }

  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const state = params.get("state")
  const stored = request.cookies.get(DRIVE_OAUTH_STATE_COOKIE)?.value

  if (!code || !state || state !== stored) {
    return page('<p>That didn\'t complete. <a href="/api/drive/connect">Start again</a>.</p>', 400)
  }

  try {
    const { refreshToken, email } = await exchangeDriveCode(code)
    return page(
      `<h1 style="font-size:20px">Google Drive connected</h1>
      <p>Uploads will go through <strong>${escapeHtml(email)}</strong>.</p>
      <p>Add this to the deployment's variables, then redeploy. It works like a password, and it
      won't be shown again.</p>
      <p><strong>GOOGLE_DRIVE_REFRESH_TOKEN</strong></p>
      <textarea readonly rows="4" style="width:100%;font-family:monospace;padding:8px"
        onclick="this.select()">${escapeHtml(refreshToken)}</textarea>`,
      200,
    )
  } catch (error) {
    console.error("[drive] connect failed", error)
    return page(
      '<p>Google didn\'t complete the connection. <a href="/api/drive/connect">Try again</a>.</p>',
      502,
    )
  }
}
