/**
 * The 6-digit access key — the second way into the portal, next to Google.
 *
 * Google sign-in only works for people who have a Google account on the address
 * they were invited with. Plenty of clients don't, so every account also gets a
 * short numeric key, mailed to them with their invite. On the login page they
 * type the key on its own: it identifies the account and signs them in.
 *
 * What is stored, and why:
 *   - `accessKeyHash` is a scrypt hash with a per-user salt. Signing in is
 *     checked against this and nothing else.
 *   - `accessKeyFingerprint` is a deterministic HMAC of the key under
 *     AUTH_SECRET, carrying a UNIQUE index. It does the two things a salted
 *     hash cannot: it is the *lookup* for a key-only sign-in (one indexed hit
 *     rather than scrypt against every row in the table), and it is what makes
 *     "unique 6-digit key" true rather than aspirational — issuing simply
 *     redraws when a candidate is already taken.
 *   - `accessKeyCipher` is the key encrypted under AUTH_SECRET, so an admin can
 *     be shown an existing key instead of having to replace it to see it. See
 *     "Keeping a readable copy" below for what that costs.
 *
 * Six digits is a million combinations, and with key-only sign-in a lucky guess
 * lands straight in someone's dashboard. Three things stand in the way, and all
 * three matter: the throttle below, the ~80ms scrypt cost every attempt pays,
 * and the fact that regenerating a key kills the old one instantly. Do not
 * remove any of them without replacing them with something stronger.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import { prisma } from "@/lib/db"
import {
  ACCESS_KEY_LENGTH,
  generateAccessKey,
  isValidAccessKeyFormat,
  isWeakAccessKey,
} from "@/lib/access-key-format"
import { isSuperAdminEmail, type Role } from "@/lib/rbac"

// Re-exported so callers keep importing the whole access-key vocabulary from
// one place; the shape/blocklist half simply also has to run in the browser.
export { ACCESS_KEY_LENGTH, generateAccessKey, isValidAccessKeyFormat, isWeakAccessKey }

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

// Deliberately modest: this runs inside a server action the user is waiting on.
// Roughly 60–100ms, which is both a real cost per guess and an acceptable wait.
const SCRYPT = { N: 16384, r: 8, p: 1 } as const
const KEY_BYTES = 32

/** Formats the stored hash as `scrypt$N$r$p$salt$hash`, all base64url. */
export async function hashAccessKey(key: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(key, salt, KEY_BYTES, SCRYPT)
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$")
}

export async function verifyAccessKeyHash(key: string, stored: string | null): Promise<boolean> {
  if (!stored) return false

  const [scheme, n, r, p, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !hash) return false

  try {
    const derived = await scryptAsync(key, Buffer.from(salt, "base64url"), KEY_BYTES, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    const expected = Buffer.from(hash, "base64url")
    // Lengths must match before timingSafeEqual, which throws on a mismatch.
    if (expected.length !== derived.length) return false
    return timingSafeEqual(expected, derived)
  } catch {
    return false
  }
}

/**
 * The value the UNIQUE index sits on, and the lookup a sign-in uses.
 * Deterministic, so two accounts can never end up with the same key, and keyed
 * by AUTH_SECRET, so a leaked database on its own cannot be walked back through
 * the million possible keys.
 */
export function fingerprintAccessKey(key: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return createHmac("sha256", secret).update(`accesskey:${key}`).digest("hex")
}

/* ------------------------------------------------------------------ *
 * Keeping a readable copy
 *
 * A hash cannot be read back, which made "show me the key you sent my client"
 * impossible to answer — the admin's only move was to issue a new one and
 * disrupt someone who was perfectly fine. So the key is *also* kept encrypted.
 *
 * The trade is real and worth being plain about: whoever holds both the
 * database and AUTH_SECRET can read every key, which a hash-only column would
 * not have allowed. Two things keep it contained — the sign-in path never
 * touches this column (verification still runs against the scrypt hash, so a
 * tampered ciphertext cannot authenticate anybody), and decryption only ever
 * happens behind a user:resetKey check or for your own account.
 *
 * AES-256-GCM, so a ciphertext that has been altered fails to decrypt rather
 * than quietly producing wrong digits.
 * ------------------------------------------------------------------ */

const CIPHER_ALGORITHM = "aes-256-gcm"
const CIPHER_IV_BYTES = 12

/**
 * A 32-byte key of its own, derived from AUTH_SECRET rather than used raw:
 * AUTH_SECRET is a base64url string of arbitrary length, and the domain string
 * keeps this key distinct from the one signing session cookies.
 */
function cipherKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return createHash("sha256").update(`accesskey-cipher:${secret}`).digest()
}

/** Formats as `gcm$iv$tag$ciphertext`, all base64url. */
export function encryptAccessKey(key: string): string {
  const iv = randomBytes(CIPHER_IV_BYTES)
  const cipher = createCipheriv(CIPHER_ALGORITHM, cipherKey(), iv)
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()])
  return [
    "gcm",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join("$")
}

/**
 * Returns null rather than throwing for anything unreadable — a key issued
 * before this column existed, a rotated AUTH_SECRET, a corrupted row. Every
 * caller treats "null" as "this one can only be replaced, not shown".
 */
export function decryptAccessKey(stored: string | null): string | null {
  if (!stored) return null

  const [scheme, iv, tag, payload] = stored.split("$")
  if (scheme !== "gcm" || !iv || !tag || !payload) return null

  try {
    const decipher = createDecipheriv(CIPHER_ALGORITHM, cipherKey(), Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8")
    return isValidAccessKeyFormat(decrypted) ? decrypted : null
  } catch {
    return null
  }
}

/**
 * The key on an account as it stands, or null when there is none to show.
 * Callers must check the permission first — this function does not.
 */
export async function revealAccessKey(
  userId: string,
): Promise<{ key: string | null; issuedAt: Date | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessKeyCipher: true, accessKeySetAt: true },
  })

  return {
    key: decryptAccessKey(user?.accessKeyCipher ?? null),
    issuedAt: user?.accessKeySetAt ?? null,
  }
}

/* ------------------------------------------------------------------ *
 * Throttling
 *
 * With key-only sign-in there is no account to lock before a guess lands, so
 * the limit has to sit in front of the lookup: per-IP for the obvious script,
 * and a global ceiling so a spread-out botnet cannot walk the key space either.
 *
 * In memory, which is the right size for a single Next server — and cached on
 * globalThis for the same reason the mail transport is (lib/mailer.ts), so a
 * dev hot reload doesn't hand an attacker a fresh allowance. A restart clears
 * it; that is a deliberate trade against a table written on every wrong guess.
 * ------------------------------------------------------------------ */

const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_IP = 8
const MAX_GLOBAL = 200

export const THROTTLE_WINDOW_MINUTES = WINDOW_MS / 60_000

type AttemptLog = { perIp: Map<string, number[]>; global: number[] }

const globalForKeys = globalThis as unknown as { accessKeyAttempts?: AttemptLog }
const attempts: AttemptLog = (globalForKeys.accessKeyAttempts ??= {
  perIp: new Map(),
  global: [],
})

const withinWindow = (times: number[], now: number) => times.filter((t) => now - t < WINDOW_MS)

/**
 * Records one sign-in attempt and says whether it may proceed. Called before
 * the key is looked at, so a blocked caller costs nothing but a map read.
 */
export function throttleKeyAttempt(ip: string): { allowed: boolean } {
  const now = Date.now()

  const forIp = withinWindow(attempts.perIp.get(ip) ?? [], now)
  attempts.global = withinWindow(attempts.global, now)

  // Sweep the other IPs occasionally so a long-running server doesn't hold a
  // row per address that ever typed a key.
  if (attempts.perIp.size > 500) {
    for (const [key, times] of attempts.perIp) {
      const live = withinWindow(times, now)
      if (live.length === 0) attempts.perIp.delete(key)
      else attempts.perIp.set(key, live)
    }
  }

  if (forIp.length >= MAX_PER_IP || attempts.global.length >= MAX_GLOBAL) {
    attempts.perIp.set(ip, forIp)
    return { allowed: false }
  }

  attempts.perIp.set(ip, [...forIp, now])
  attempts.global.push(now)
  return { allowed: true }
}

/** Clears the attempt budget for an IP — called after a key works. */
export function clearKeyAttempts(ip: string) {
  attempts.perIp.delete(ip)
}

/* ------------------------------------------------------------------ *
 * Issuing
 * ------------------------------------------------------------------ */

/**
 * Checks a key an admin typed before anything is created, so "that one's taken"
 * arrives while the form is still open rather than after an account exists.
 * Returns the message to show, or null when the key is fine.
 *
 * The availability half is advisory — two admins could pick the same digits in
 * the same second. The UNIQUE index is what actually decides, and issueAccessKey
 * reports the loser.
 */
export async function validateChosenAccessKey(key: string): Promise<string | null> {
  const value = key.trim()
  if (!isValidAccessKeyFormat(value)) {
    return `The access key must be exactly ${ACCESS_KEY_LENGTH} digits.`
  }
  if (isWeakAccessKey(value)) return "That key is too easy to guess. Pick another one."

  const taken = await prisma.user.findUnique({
    where: { accessKeyFingerprint: fingerprintAccessKey(value) },
    select: { id: true },
  })
  return taken ? "Someone already uses that key. Pick another one." : null
}

export type IssueResult = { ok: true; key: string } | { ok: false; error: string }

/**
 * Gives a user a fresh key and returns it in the clear, ready to mail or show.
 *
 * Pass `key` to honour one an admin typed; leave it out to draw a random one.
 * Any previous key stops working the instant this returns — including the
 * readable copy, which is overwritten in the same statement.
 */
export async function issueAccessKey(
  userId: string,
  options: { key?: string | null } = {},
): Promise<IssueResult> {
  const chosen = options.key?.trim()

  if (chosen) {
    if (!isValidAccessKeyFormat(chosen)) {
      return { ok: false, error: `The access key must be exactly ${ACCESS_KEY_LENGTH} digits.` }
    }
    if (isWeakAccessKey(chosen)) {
      return { ok: false, error: "That key is too easy to guess. Pick another one." }
    }
    return (await storeAccessKey(userId, chosen))
      ? { ok: true, key: chosen }
      : { ok: false, error: "Someone already uses that key. Pick another one." }
  }

  // Collisions are rare below a few thousand accounts, but the unique index
  // makes them a hard failure rather than a silent duplicate, so the draw
  // retries. It only gives up if the key space is genuinely crowded.
  for (let attempt = 0; attempt < 25; attempt++) {
    const key = generateAccessKey()
    if (await storeAccessKey(userId, key)) return { ok: true, key }
  }

  return { ok: false, error: "Couldn't allocate an access key. Try again." }
}

/** Writes one candidate. Returns false when the key is already taken. */
async function storeAccessKey(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessKeyHash: await hashAccessKey(key),
        accessKeyFingerprint: fingerprintAccessKey(key),
        // The readable copy. Written together with the hash so the two can
        // never disagree about which key an account holds.
        accessKeyCipher: encryptAccessKey(key),
        accessKeySetAt: new Date(),
      },
    })
    return true
  } catch (error) {
    // P2002 is the unique-constraint violation on accessKeyFingerprint: another
    // account holds this key. Anything else is a real failure and must surface.
    if (isUniqueViolation(error)) return false
    throw error
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

/** Drops the key without issuing a new one — used when access is revoked. */
export async function clearAccessKey(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      accessKeyHash: null,
      accessKeyFingerprint: null,
      accessKeyCipher: null,
      accessKeySetAt: null,
    },
  })
}

/* ------------------------------------------------------------------ *
 * Signing in
 * ------------------------------------------------------------------ */

export type KeySignInResult =
  | {
      ok: true
      user: { id: string; email: string; name: string | null; avatarUrl: string | null }
    }
  | { ok: false; error: "invalid" | "account_disabled" }

/**
 * The whole key check, in one place. Throttling is the caller's job — it needs
 * the request headers, and a blocked attempt must not reach the database.
 */
export async function signInWithAccessKey(rawKey: string): Promise<KeySignInResult> {
  const key = rawKey.trim()
  if (!isValidAccessKeyFormat(key)) return { ok: false, error: "invalid" }

  const user = await prisma.user.findUnique({
    where: { accessKeyFingerprint: fingerprintAccessKey(key) },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      avatarUrl: true,
      accessKeyHash: true,
    },
  })

  // Still pay the scrypt cost when nothing matched, so a near miss and a
  // nonsense key can't be told apart by how long the answer takes.
  if (!user) {
    await verifyAccessKeyHash(key, await hashAccessKey(generateAccessKey()))
    return { ok: false, error: "invalid" }
  }

  // The fingerprint already matched; this re-checks against the salted hash so
  // the two columns must agree for a sign-in to happen.
  if (!(await verifyAccessKeyHash(key, user.accessKeyHash))) {
    return { ok: false, error: "invalid" }
  }

  if (user.status === "DISABLED") return { ok: false, error: "account_disabled" }

  // Holding the key is the same proof of ownership as a first Google sign-in,
  // so it activates an INVITED account too — otherwise a client with no Google
  // account could never leave the invited state. The bootstrap owner's role is
  // re-asserted here for the same reason it is in lib/auth.ts.
  const role: Role | undefined = isSuperAdminEmail(user.email) ? "SUPER_ADMIN" : undefined
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE", ...(role ? { role } : {}) },
    select: { id: true, email: true, name: true, avatarUrl: true },
  })

  return { ok: true, user: updated }
}
