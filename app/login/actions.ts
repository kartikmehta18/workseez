"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  ACCESS_KEY_LENGTH,
  clearKeyAttempts,
  isValidAccessKeyFormat,
  signInWithAccessKey,
  throttleKeyAttempt,
  THROTTLE_WINDOW_MINUTES,
} from "@/lib/access-key"
import {
  encodeSession,
  safeNextPath,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session"

export type KeySignInState = { error?: string }

/**
 * Signs someone in with their 6-digit key alone.
 *
 * The failure message is deliberately the same for a key that belongs to
 * nobody and one that is mistyped: this form is public, and anything more
 * specific tells a guesser they are close.
 */
export async function signInWithKey(
  _prev: KeySignInState,
  formData: FormData,
): Promise<KeySignInState> {
  const key = String(formData.get("key") ?? "").trim()
  const next = safeNextPath(String(formData.get("next") ?? ""))

  if (!isValidAccessKeyFormat(key)) {
    return { error: `Enter the ${ACCESS_KEY_LENGTH}-digit key from your invite email.` }
  }

  // Throttle before the key is looked at, so a blocked attempt never reaches
  // the database — and count the malformed ones above as free, since they
  // cannot be a guess at a real key.
  const ip = await clientIp()
  if (!throttleKeyAttempt(ip).allowed) {
    return {
      error: `Too many attempts. Wait ${THROTTLE_WINDOW_MINUTES} minutes, or continue with Google.`,
    }
  }

  const result = await signInWithAccessKey(key)

  if (!result.ok) {
    return {
      error:
        result.error === "account_disabled"
          ? "This account has been disabled. Contact your account manager."
          : "That key isn't valid. Check the digits, or ask your account manager for a new one.",
    }
  }

  clearKeyAttempts(ip)

  const store = await cookies()
  store.set(
    SESSION_COOKIE,
    await encodeSession({
      sub: result.user.id,
      email: result.user.email,
      name: result.user.name ?? result.user.email,
      picture: result.user.avatarUrl ?? undefined,
    }),
    sessionCookieOptions,
  )

  // Same session cookie the Google callback writes, so everything downstream —
  // the proxy, getCurrentActor, the role-based dashboard — is unchanged.
  redirect(next)
}

/**
 * Best-effort client address for the throttle. Behind Hostinger's proxy the
 * real address is the first hop in x-forwarded-for; the fallback groups
 * unknowns together, which is the safe direction for a rate limit.
 */
async function clientIp() {
  const list = await headers()
  const forwarded = list.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return list.get("x-real-ip") ?? "unknown"
}
