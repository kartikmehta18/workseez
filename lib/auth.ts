import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { decodeSession, SESSION_COOKIE } from "@/lib/session"
import {
  isRole,
  isSuperAdminEmail,
  type Actor,
  type Role,
  type UserStatus,
} from "@/lib/rbac"

/**
 * Resolves the signed-in user from the session cookie, then re-reads their role
 * from the database. The role deliberately does NOT come from the JWT: a Super
 * Admin demoting someone must take effect on their very next request, not
 * whenever their week-old cookie happens to expire.
 */
export async function getCurrentActor(): Promise<Actor | null> {
  const store = await cookies()
  const session = await decodeSession(store.get(SESSION_COOKIE)?.value)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, role: true, status: true, avatarUrl: true },
  })
  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: isRole(user.role) ? user.role : "CLIENT",
    status: user.status as UserStatus,
  }
}

/** For pages: returns an active actor or redirects to login. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor()
  if (!actor) redirect("/login")
  if (actor.status !== "ACTIVE") redirect("/login?error=account_disabled")
  return actor
}

/**
 * Called after Google verifies an identity. Decides whether this email may
 * enter the platform at all, and returns the user record to build a session on.
 *
 * Access is invite-only: an admin must have created the user (or client) row
 * first. The one exception is the bootstrap Super Admin, so the very first
 * login works on an empty database.
 */
export async function resolveUserForSignIn(profile: {
  sub: string
  email: string
  name: string
  picture?: string
}) {
  const email = profile.email.toLowerCase()

  if (isSuperAdminEmail(email)) {
    return prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: profile.name,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        role: "SUPER_ADMIN" satisfies Role,
        status: "ACTIVE",
      },
      // Re-assert on every login so the owner can never be locked out.
      update: {
        name: profile.name,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        role: "SUPER_ADMIN" satisfies Role,
        status: "ACTIVE",
      },
    })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) return { error: "not_invited" as const }
  if (existing.status === "DISABLED") return { error: "account_disabled" as const }

  // First sign-in of an invited user: bind the Google identity and activate.
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      googleId: profile.sub,
      avatarUrl: profile.picture ?? existing.avatarUrl,
      name: existing.name ?? profile.name,
      status: "ACTIVE",
    },
  })
}
