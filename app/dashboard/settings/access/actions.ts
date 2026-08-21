/**
 * Invite a team member. They get in either by signing in with Google on that
 * address or by typing the 6-digit key this issues and mails them.
 */"use server"

import { refresh, revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { issueAccessKey, revealAccessKey, validateChosenAccessKey } from "@/lib/access-key"
import {
  sendAccessKeyEmail,
  sendAccessKeyRequestEmail,
  sendTeamInviteEmail,
} from "@/lib/emails"
import {
  assertCan,
  ForbiddenError,
  isRole,
  isSuperAdminEmail,
  ROLE_LABELS,
  USER_STATUSES,
  type Role,
} from "@/lib/rbac"

/**
 * `emailed` is false when SMTP is unset or the send failed — the invite stands
 * either way. `accessKey` is the plaintext key, returned so the UI can show it
 * once: it is unreadable from that point on, which is exactly what makes it the
 * fallback when the mail didn't leave.
 */
export type ActionResult =
  | { ok: true; emailed?: boolean; accessKey?: string }
  | { ok: false; error: string }

const fail = (error: string): ActionResult => ({ ok: false, error })

function guard(fn: () => void, message: string): ActionResult | null {
  try {
    fn()
    return null
  } catch (error) {
    if (error instanceof ForbiddenError) return fail(message)
    throw error
  }
}

/** Invite a team member. They get access on their first Google sign-in. */
export async function inviteTeamMember(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  const denied = guard(
    () => assertCan(actor, "user:invite"),
    "You don't have permission to invite people.",
  )
  if (denied) return denied

  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const name = String(formData.get("name") ?? "").trim()
  const role = String(formData.get("role") ?? "MANAGER")

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.")
  if (!isRole(role)) return fail("Pick a valid role.")
  if (role === "SUPER_ADMIN") return fail("There can only be one Super Admin.")
  if (role === "CLIENT") return fail("Add clients from the Clients page so they get a profile.")

  // Only the Super Admin decides roles, so an Admin may only invite Managers.
  if (actor!.role !== "SUPER_ADMIN" && role !== "MANAGER") {
    return fail("Only the Super Admin can grant the Admin role.")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return fail("Someone with that email already has an account.")

  // An admin may type the key themselves; blank means "draw one". Checked
  // before the account exists so a bad choice fails cleanly.
  const chosenKey = String(formData.get("accessKey") ?? "").trim() || null
  const keyProblem = chosenKey ? await validateChosenAccessKey(chosenKey) : null
  if (keyProblem) return fail(keyProblem)

  const user = await prisma.user.create({
    data: { email, name: name || null, role, status: "INVITED" },
  })

  const issued = await issueAccessKey(user.id, { key: chosenKey })
  // A key that couldn't be issued (a race on a chosen one, a database hiccup)
  // must not sink the invite: Google sign-in still works, the mail simply
  // describes that route, and "Send new key" fixes it afterwards.
  if (!issued.ok) console.error(`[access-key] invite for ${email}: ${issued.error}`)

  // The account is what grants access, so a mail failure must not roll it back
  // or surface as an error — the caller just tells the admin to share the link.
  const emailed = await sendTeamInviteEmail({
    to: email,
    name: name || null,
    invitedBy: actor!.name ?? actor!.email,
    role,
    accessKey: issued.ok ? issued.key : null,
  })

  revalidatePath("/dashboard/settings/access")
  refresh()
  return { ok: true, emailed, accessKey: issued.ok ? issued.key : undefined }
}

/**
 * Generates a fresh access key for someone else and emails it to them. The old
 * key dies the moment this runs, so it doubles as "revoke the key that leaked".
 */
export async function regenerateAccessKey(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  const denied = guard(
    () => assertCan(actor, "user:resetKey"),
    "You don't have permission to generate access keys.",
  )
  if (denied) return denied

  const userId = String(formData.get("userId") ?? "")
  if (!userId) return fail("Missing user.")

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, status: true },
  })
  if (!target) return fail("User not found.")
  if (target.status === "DISABLED") {
    return fail("This account is disabled. Enable it before issuing a key.")
  }

  const issued = await issueAccessKey(target.id, {
    key: String(formData.get("accessKey") ?? "").trim() || null,
  })
  if (!issued.ok) return fail(issued.error)

  const emailed = await sendAccessKeyEmail({
    to: target.email,
    name: target.name,
    accessKey: issued.key,
    issuedBy: actor!.name ?? actor!.email,
  })

  revalidatePath("/dashboard/settings/access")
  refresh()
  return { ok: true, emailed, accessKey: issued.key }
}

/**
 * The same thing for your own account — but only for the roles that may issue
 * keys at all. Everyone else reads their key and asks an admin for a new one
 * (requestAccessKey below): handing a client a self-service reset would make
 * "only an admin grants access" untrue, since the reset is the grant.
 */
export async function regenerateMyAccessKey(): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Sign in again to do that.")

  const denied = guard(
    () => assertCan(actor, "user:resetKey"),
    "Only an Admin can issue access keys. Use “Request a new key” and they'll send you one.",
  )
  if (denied) return denied

  const issued = await issueAccessKey(actor.id)
  if (!issued.ok) return fail(issued.error)

  const emailed = await sendAccessKeyEmail({
    to: actor.email,
    name: actor.name,
    accessKey: issued.key,
  })

  revalidatePath("/dashboard/settings")
  refresh()
  return { ok: true, emailed, accessKey: issued.key }
}

/**
 * Asks the admins for a key. This is what a client or manager gets instead of a
 * generate button: it changes nothing on their account, it just puts the ask in
 * front of the people who are allowed to answer it.
 */
export async function requestAccessKey(): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Sign in again to do that.")

  const [me, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.id }, select: { accessKeySetAt: true } }),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
      select: { email: true },
    }),
  ])

  if (admins.length === 0) {
    return fail("There's no admin to ask right now. Contact your account manager directly.")
  }

  const emailed = await sendAccessKeyRequestEmail({
    to: admins.map((admin) => admin.email).join(", "),
    requesterName: actor.name,
    requesterEmail: actor.email,
    roleLabel: ROLE_LABELS[actor.role],
    hasKey: Boolean(me?.accessKeySetAt),
  })

  // Nothing was written, so a failed send leaves nothing half-done — but the
  // person must be told, or they will sit waiting on a request nobody got.
  if (!emailed) {
    return fail("Couldn't reach your admin by email. Contact your account manager directly.")
  }

  return { ok: true, emailed }
}

/**
 * Shows the key someone already has, rather than replacing it to find out what
 * it is. Same permission as issuing one: being able to read a key is being able
 * to sign in as that person, so it is not a softer thing to allow.
 */
export async function showAccessKey(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  const denied = guard(
    () => assertCan(actor, "user:resetKey"),
    "You don't have permission to view access keys.",
  )
  if (denied) return denied

  const userId = String(formData.get("userId") ?? "")
  if (!userId) return fail("Missing user.")

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!target) return fail("User not found.")

  const { key } = await revealAccessKey(target.id)
  // Either they never had one, or it predates the readable copy. Both end the
  // same way — generate a new key — so both say so rather than splitting hairs.
  if (!key) return fail("No readable key on this account. Generate a new one to see it.")

  return { ok: true, accessKey: key }
}

/** The same for your own account: you may always look at your own key. */
export async function showMyAccessKey(): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Sign in again to do that.")

  const { key } = await revealAccessKey(actor.id)
  if (!key) return fail("No readable key on your account. Generate a new one to see it.")

  return { ok: true, accessKey: key }
}

/**
 * Change someone's role. Super Admin only — this is the switch that turns a
 * person into an Admin, Manager or Client.
 */
export async function setUserRole(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  const denied = guard(
    () => assertCan(actor, "user:setRole"),
    "Only the Super Admin can change roles.",
  )
  if (denied) return denied

  const userId = String(formData.get("userId") ?? "")
  const role = String(formData.get("role") ?? "")
  if (!userId) return fail("Missing user.")
  if (!isRole(role)) return fail("Pick a valid role.")

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, ownedClient: { select: { id: true } } },
  })
  if (!target) return fail("User not found.")

  // The bootstrap owner is re-asserted as SUPER_ADMIN on every login, so a
  // demotion here would silently revert. Reject it rather than lie to the UI.
  if (isSuperAdminEmail(target.email)) return fail("The Super Admin role cannot be changed.")
  if (role === "SUPER_ADMIN") return fail("There can only be one Super Admin.")

  // A client's login is tied to their client profile; promoting them to a team
  // role would leave that profile with an owner who can see every other client.
  if (target.ownedClient && role !== "CLIENT") {
    return fail("This account owns a client profile. Remove that profile first.")
  }
  if (!target.ownedClient && role === "CLIENT") {
    return fail("Clients need a profile. Add them from the Clients page instead.")
  }

  await prisma.user.update({ where: { id: userId }, data: { role } })

  revalidatePath("/dashboard/settings/access")
  revalidatePath("/dashboard/clients")
  refresh()
  return { ok: true }
}

/** Enable or disable an account. A disabled user is signed out on next request. */
export async function setUserStatus(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  const denied = guard(
    () => assertCan(actor, "user:disable"),
    "Only the Super Admin can disable accounts.",
  )
  if (denied) return denied

  const userId = String(formData.get("userId") ?? "")
  const status = String(formData.get("status") ?? "")
  if (!userId) return fail("Missing user.")
  if (!(USER_STATUSES as readonly string[]).includes(status)) return fail("Invalid status.")
  if (userId === actor!.id) return fail("You can't disable your own account.")

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (!target) return fail("User not found.")
  if (isSuperAdminEmail(target.email)) return fail("The Super Admin account cannot be disabled.")

  await prisma.user.update({ where: { id: userId }, data: { status } })

  revalidatePath("/dashboard/settings/access")
  refresh()
  return { ok: true }
}

export type TeamMember = {
  id: string
  email: string
  name: string | null
  role: Role
  status: string
  avatarUrl: string | null
  ownedClientName: string | null
  managedCount: number
  /** When their current key was issued, or null if they have none. */
  accessKeySetAt: Date | null
}

export async function listAllUsers(): Promise<TeamMember[]> {
  const actor = await getCurrentActor()
  assertCan(actor, "user:viewAll")

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
      accessKeySetAt: true,
      ownedClient: { select: { name: true } },
      _count: { select: { managedClients: true } },
    },
  })

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: isRole(u.role) ? u.role : "CLIENT",
    status: u.status,
    avatarUrl: u.avatarUrl,
    ownedClientName: u.ownedClient?.name ?? null,
    managedCount: u._count.managedClients,
    accessKeySetAt: u.accessKeySetAt,
  }))
}
