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

/**
 * The embeddable preview for a Google Drive link, or null when the link is not
 * one Drive can show in a frame.
 *
 * Built from the file or folder id alone rather than by rewriting the pasted
 * URL: the id is checked against Drive's own alphabet, so whatever else was in
 * the link — query strings, a different host path — never reaches the frame's
 * `src`. Drive decides who may see the preview; a file the viewer has no access
 * to shows Google's "request access" page instead.
 */
export function drivePreviewUrl(url: string | null | undefined): string | null {
  if (!url || !isGoogleDriveUrl(url)) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const id = (value: string | null | undefined) =>
    value && /^[A-Za-z0-9_-]{10,}$/.test(value) ? value : null
  const path = parsed.pathname

  // Docs, Sheets and Slides preview on their own host.
  const doc = /^\/(document|spreadsheets|presentation)\/d\/([^/]+)/.exec(path)
  if (parsed.hostname === "docs.google.com" && doc && id(doc[2])) {
    return `https://docs.google.com/${doc[1]}/d/${doc[2]}/preview`
  }

  const folder = id(/\/folders\/([^/]+)/.exec(path)?.[1])
  if (folder) return `https://drive.google.com/embeddedfolderview?id=${folder}#grid`

  const file = id(/\/file\/d\/([^/]+)/.exec(path)?.[1]) ?? id(parsed.searchParams.get("id"))
  return file ? `https://drive.google.com/file/d/${file}/preview` : null
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
