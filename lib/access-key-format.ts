/**
 * The parts of the access key that both sides of the wire need: how long it is,
 * what counts as valid, and how to draw one.
 *
 * Split out of lib/access-key.ts because that file imports Prisma, and the
 * "Generate" button beside the access-key input is a Client Component — pulling
 * the database client into the browser bundle to reach a regex would be a poor
 * trade. Nothing here touches storage or secrets.
 */

export const ACCESS_KEY_LENGTH = 6

/**
 * Keys nobody should be handed. Auto-generation redraws past them and an admin
 * typing one is told to pick again — a "123456" that arrives by email is the
 * first thing anyone guesses.
 */
const WEAK_KEYS = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555",
  "666666", "777777", "888888", "999999",
  "123456", "654321", "012345", "543210", "123123", "121212",
])

export function isValidAccessKeyFormat(value: string) {
  return new RegExp(`^\\d{${ACCESS_KEY_LENGTH}}$`).test(value)
}

export function isWeakAccessKey(value: string) {
  return WEAK_KEYS.has(value)
}

const KEY_SPACE = 10 ** ACCESS_KEY_LENGTH

/**
 * A cryptographically random 6-digit key, never one of the obvious ones.
 *
 * `crypto.getRandomValues` rather than Node's `randomInt` so the same function
 * serves the server and the browser. The rejection sampling matters: 2^32 is
 * not a multiple of 1,000,000, so a plain modulo would make the low keys
 * fractionally likelier than the high ones.
 */
export function generateAccessKey(): string {
  const limit = Math.floor(0xffffffff / KEY_SPACE) * KEY_SPACE
  const buffer = new Uint32Array(1)

  for (;;) {
    crypto.getRandomValues(buffer)
    if (buffer[0] >= limit) continue

    const key = String(buffer[0] % KEY_SPACE).padStart(ACCESS_KEY_LENGTH, "0")
    if (!isWeakAccessKey(key)) return key
  }
}
