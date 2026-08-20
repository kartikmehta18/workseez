"use server"

import { refresh, revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { sendTeamInviteEmail } from "@/lib/emails"
import {
  assertCan,
  ForbiddenError,
  isRole,
  isSuperAdminEmail,
  USER_STATUSES,
  type Role,
} from "@/lib/rbac"

/** `emailed` is false when SMTP is unset or the send failed — the invite stands either way. */
export type ActionResult = { ok: true; emailed?: boolean } | { ok: false; error: string }

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

  await prisma.user.create({
    data: { email, name: name || null, role, status: "INVITED" },
  })

  // The account is what grants access, so a mail failure must not roll it back
  // or surface as an error — the caller just tells the admin to share the link.
  const emailed = await sendTeamInviteEmail({
    to: email,
    name: name || null,
    invitedBy: actor!.name ?? actor!.email,
    role,
  })

  revalidatePath("/dashboard/settings/access")
  refresh()
  return { ok: true, emailed }
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
  }))
}
