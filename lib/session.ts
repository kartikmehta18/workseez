import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "workseez_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

export type SessionUser = {
  sub: string
  email: string
  name: string
  picture?: string
}

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value) throw new Error("AUTH_SECRET is not set")
  return new TextEncoder().encode(value)
}

export async function encodeSession(user: SessionUser) {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret())
}

export async function decodeSession(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] })
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

/**
 * Sanitises a `next=` redirect target. Only same-origin absolute paths pass:
 * "//evil.com" and "https://evil.com" are both browser-valid redirect targets,
 * so a bare startsWith("/") check is an open redirect. Everything that fails
 * falls back to the dashboard.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next) return fallback
  if (!next.startsWith("/")) return fallback
  if (next.startsWith("//")) return fallback
  if (next.startsWith("/\\")) return fallback // some browsers treat \ as /
  return next
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
}
