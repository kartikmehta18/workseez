import type { NextRequest } from "next/server"

/**
 * The public origin of the deployment, without a trailing slash.
 *
 * `APP_URL` is the source of truth — it is already required for the Google
 * `redirect_uri`, so a working deployment always has it. It is read at request
 * time (never inlined at build time), which matters because the Docker image is
 * built without it and Railway injects it at runtime.
 */
export function configuredOrigin() {
  return process.env.APP_URL?.replace(/\/+$/, "") || null
}

/**
 * Origin to use in a `Location` header for `request`.
 *
 * NOT `request.url`: that is the address the *container* was reached on, not
 * the one the browser used. Behind Railway's edge proxy the app is hit on
 * http://localhost:8080, so a redirect built from `request.url` sends the
 * browser to port 8080 on its own machine. The forwarded headers are only a
 * fallback for deployments that set no APP_URL.
 */
export function publicOrigin(request: NextRequest) {
  const configured = configuredOrigin()
  if (configured) return configured

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return request.nextUrl.origin

  // The header is a comma-separated list when several proxies are chained; the
  // first entry is the one the client actually spoke to.
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  return `${proto || request.nextUrl.protocol.replace(":", "")}://${host}`
}

/** Absolute URL for a same-origin path, safe to put in a `Location` header. */
export function absoluteUrl(path: string, request: NextRequest) {
  return new URL(path, publicOrigin(request))
}
