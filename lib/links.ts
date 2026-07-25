/**
 * Normalisation and validation for admin-entered URLs (Google Drive folders,
 * client social accounts).
 *
 * These values are rendered straight into `href`, so the protocol allowlist is
 * a security boundary, not a nicety: without it `javascript:alert(1)` typed
 * into the edit form would execute for every user who opens the client page.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"])

/**
 * Returns a safe absolute URL, or null if the input can't be one.
 * Bare hosts like "instagram.com/acme" are assumed to be https.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Only prepend a scheme when none is present. Doing this unconditionally
  // would turn "javascript:alert(1)" into "https://javascript:alert(1)" and
  // silently accept it rather than rejecting it below.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null
  if (!url.hostname.includes(".")) return null

  return url.toString()
}

/** True for links that actually point at Google Drive / Docs / Sheets etc. */
export function isGoogleDriveUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === "drive.google.com" || hostname === "docs.google.com"
  } catch {
    return false
  }
}

/** A short, human label for a URL when the admin didn't supply one. */
export function labelFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    const known: Record<string, string> = {
      "instagram.com": "Instagram",
      "youtube.com": "YouTube",
      "youtu.be": "YouTube",
      "x.com": "X",
      "twitter.com": "X",
      "linkedin.com": "LinkedIn",
      "facebook.com": "Facebook",
      "tiktok.com": "TikTok",
      "threads.net": "Threads",
      "pinterest.com": "Pinterest",
    }
    return known[host] ?? host
  } catch {
    return "Link"
  }
}

export const MAX_CLIENT_LINKS = 15
