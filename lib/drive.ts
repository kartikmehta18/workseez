import { importPKCS8, SignJWT } from "jose"
import { googleConfig } from "@/lib/google"

/**
 * Google Drive, via one connected Google account or a service account.
 *
 * Written against Drive's REST API directly rather than pulling in `googleapis`
 * — the whole surface used here is a handful of calls, and `jose` (already a
 * dependency for verifying Google's ID tokens) can mint the assertion the token
 * endpoint wants. Adding a 60 MB SDK for that would be a poor trade.
 *
 * Everything here is OPTIONAL. With neither configured `driveConfigured()` is
 * false, uploads are refused with a clear message and the UI falls back to
 * "open the folder in Drive yourself" — which is how the agency worked before
 * this feature and still works if the integration breaks.
 *
 * Configuration (.env), one of:
 *
 *   GOOGLE_DRIVE_REFRESH_TOKEN    from /api/drive/connect. Works with a normal
 *     Google account: uploads count against that account's storage, and each
 *     destination folder must be its own or shared with it as an editor.
 *
 *   GOOGLE_SERVICE_ACCOUNT_JSON   the whole key file, on one line
 *     — or —
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  client_email from the key file
 *   GOOGLE_SERVICE_ACCOUNT_KEY    private_key from the key file (\n escapes ok)
 *     A service account has no Drive storage quota of its own, so its folders
 *     must live in a **Shared Drive** it is a member of. An upload into a plain
 *     "My Drive" folder fails with a storage quota error however the folder is
 *     shared — this is a Google constraint, not a choice made here.
 *
 * And either way:
 *
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID   folder new client folders are created under
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive"
const FOLDER_MIME = "application/vnd.google-apps.folder"
const API = "https://www.googleapis.com/drive/v3"
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

/** Shared Drives are invisible to every call that does not opt in. */
const ALL_DRIVES = "supportsAllDrives=true&includeItemsFromAllDrives=true"

type ServiceAccount = { email: string; privateKey: string }

function serviceAccount(): ServiceAccount | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (json) {
    try {
      const parsed = JSON.parse(json) as { client_email?: string; private_key?: string }
      if (parsed.client_email && parsed.private_key) {
        return { email: parsed.client_email, privateKey: parsed.private_key }
      }
    } catch {
      console.error("[drive] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON — ignoring it")
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !key) return null
  return { email, privateKey: key }
}

function connectedAccountToken() {
  return process.env.GOOGLE_DRIVE_REFRESH_TOKEN || null
}

export function driveConfigured() {
  return connectedAccountToken() !== null || serviceAccount() !== null
}

/** The folder new per-client folders are created under, if one is configured. */
export function driveRootFolderId() {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null
}

export class DriveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DriveError"
  }
}

/**
 * Access tokens are good for an hour, so they are cached on globalThis for the
 * same reason as the Prisma pool and the mail client: a dev hot reload
 * re-evaluates the module, and re-authenticating on every upload would be a
 * round trip to Google for no reason.
 */
const globalForDrive = globalThis as unknown as {
  driveToken?: { value: string; expiresAt: number }
}

/** What the token endpoint needs for a service account: a short-lived signed assertion. */
async function serviceAccountGrant() {
  const account = serviceAccount()
  if (!account) throw new DriveError("Google Drive is not configured on this server.")

  // The private key arrives from .env with literal "\n" sequences; PKCS8 import
  // needs real newlines.
  const key = await importPKCS8(account.privateKey.replace(/\\n/g, "\n"), "RS256")
  const now = Math.floor(Date.now() / 1000)
  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(account.email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  return { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }
}

async function accessToken() {
  const cached = globalForDrive.driveToken
  // 60s of slack, so a token that expires mid-upload is never handed out.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value

  const refreshToken = connectedAccountToken()
  let grant: Record<string, string>
  if (refreshToken) {
    const { clientId, clientSecret } = googleConfig()
    grant = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }
  } else {
    grant = await serviceAccountGrant()
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(grant),
  })

  if (!response.ok) {
    throw new DriveError(`Google refused the Drive credentials: ${await response.text()}`)
  }

  const { access_token: token, expires_in: expiresIn } = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!token) throw new DriveError("Google returned no access token.")

  globalForDrive.driveToken = { value: token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 }
  return token
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await accessToken()
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new DriveError(`Drive request failed (${response.status}): ${await response.text()}`)
  }
  return response
}

export type DriveFile = { id: string; name: string; webViewLink: string | null }

/** The URL a folder id opens at. Drive's own folder links are this shape. */
export function folderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`
}

/**
 * Pulls a folder id out of a pasted Drive URL.
 *
 * Admins paste whatever the Drive address bar gave them, which is one of a
 * handful of shapes; returning null for anything else lets the caller keep the
 * link as a plain "open this" button without pretending it can upload there.
 */
export function folderIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const patterns = [/\/folders\/([a-zA-Z0-9_-]{10,})/, /[?&]id=([a-zA-Z0-9_-]{10,})/]
  for (const pattern of patterns) {
    const match = pattern.exec(url)
    if (match) return match[1]
  }
  return null
}

/**
 * Finds a folder by name inside a parent, creating it if it is not there.
 *
 * Name-based rather than id-based because the folders are also created and
 * renamed by hand in Drive — looking one up by name means an admin who made
 * "Raw" themselves gets adopted instead of ending up with a second one.
 */
export async function ensureFolder(name: string, parentId: string): Promise<DriveFile> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
  const query = [
    `name = '${escaped}'`,
    `'${parentId}' in parents`,
    `mimeType = '${FOLDER_MIME}'`,
    "trashed = false",
  ].join(" and ")

  const found = await driveFetch(
    `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=1&${ALL_DRIVES}`,
  )
  const { files } = (await found.json()) as { files?: DriveFile[] }
  if (files && files.length > 0) return files[0]

  const created = await driveFetch(`${API}/files?fields=id,name,webViewLink&${ALL_DRIVES}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  })
  return (await created.json()) as DriveFile
}

export type UploadSessionInput = {
  parentId: string
  name: string
  mimeType: string
  size: number
  /** The browser's origin. Drive only answers cross-origin requests from this one. */
  origin: string
}

/**
 * Opens a resumable upload for the browser to send one file to directly.
 *
 * The bytes never pass through this server: a large file reaching a route
 * handler is held in memory while it is parsed, and a few at once would take
 * the app down for everyone. The session URL can write this one file and
 * nothing else, so handing it to the uploader is safe.
 *
 * The id is generated up front so the server knows which file to look for
 * afterwards, without relying on the browser reading Drive's final response.
 */
export async function createUploadSession({
  parentId,
  name,
  mimeType,
  size,
  origin,
}: UploadSessionInput) {
  const generated = await driveFetch(`${API}/files/generateIds?count=1&fields=ids`)
  const { ids } = (await generated.json()) as { ids?: string[] }
  const fileId = ids?.[0]
  if (!fileId) throw new DriveError("Drive did not return a file id.")

  const session = await driveFetch(
    `${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(size),
        Origin: origin,
      },
      body: JSON.stringify({ id: fileId, name, parents: [parentId] }),
    },
  )

  const uploadUrl = session.headers.get("location")
  if (!uploadUrl) throw new DriveError("Drive did not return an upload session.")
  return { fileId, uploadUrl }
}

export type UploadedFile = {
  id: string
  name: string
  mimeType: string | null
  size: number | null
  url: string
}

/**
 * Reads back a file the browser says it sent, or null if it is not a live file
 * directly inside `parentId`. That check is what stops an uploader attaching
 * some other file this Google account can see just by naming its id.
 */
export async function findUploadedFile(
  fileId: string,
  parentId: string,
): Promise<UploadedFile | null> {
  let response: Response
  try {
    response = await driveFetch(
      `${API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,trashed&supportsAllDrives=true`,
    )
  } catch (error) {
    // The id exists from before the upload, so a file that never finished
    // arriving reads as not found. Anything else is a real failure.
    if (error instanceof DriveError && error.message.includes("(404)")) return null
    throw error
  }

  const file = (await response.json()) as {
    id: string
    name: string
    mimeType?: string
    size?: string
    parents?: string[]
    trashed?: boolean
  }
  if (file.trashed || !file.parents?.includes(parentId)) return null

  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType ?? null,
    size: file.size ? Number(file.size) : null,
    url: `https://drive.google.com/file/d/${file.id}/view`,
  }
}

/**
 * Turns a Drive failure into something worth showing a client.
 *
 * The raw message quotes Google's JSON, which is noise to whoever is trying to
 * upload a video — but the cases no amount of retrying will fix are worth
 * calling out by name, so the right person hears about them. The raw message
 * always goes to the log.
 */
export function driveErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  console.error("[drive]", raw)

  if (raw.includes("invalid_grant")) {
    return "The portal's Google Drive connection has expired. Ask your admin to reconnect it."
  }
  if (raw.includes("storageQuotaExceeded")) {
    return connectedAccountToken()
      ? "The Google account the portal uploads to is out of storage. Ask your admin to free up space."
      : "Drive rejected the upload: the destination folder has to be on a Shared Drive. Ask your admin to move it."
  }
  if (raw.includes("notFound") || raw.includes("404")) {
    return "That Drive folder no longer exists, or the portal has lost access to it."
  }
  return "Drive wouldn't accept the upload. Try again, or add the file to the folder directly."
}
