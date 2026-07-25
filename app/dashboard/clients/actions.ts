"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { sendClientInviteEmail } from "@/lib/emails"
import { assertCan, CLIENT_STATUSES, ForbiddenError, isSuperAdminEmail } from "@/lib/rbac"
import { labelFromUrl, MAX_CLIENT_LINKS, normalizeUrl } from "@/lib/links"

/** `emailed` is false when SMTP is unset or the send failed — the client is created either way. */
export type ActionResult = { ok: true; emailed?: boolean } | { ok: false; error: string }

function fail(error: string): ActionResult {
  return { ok: false, error }
}

type ParsedLink = { label: string; url: string; sortOrder: number }

/**
 * The social-links editor submits parallel `linkLabel`/`linkUrl` arrays. Rows
 * the user added but left blank are dropped rather than rejected, so an
 * accidental click on "+" never blocks saving.
 */
function parseLinks(formData: FormData): ParsedLink[] | { error: string } {
  const labels = formData.getAll("linkLabel").map((v) => String(v))
  const urls = formData.getAll("linkUrl").map((v) => String(v))

  const links: ParsedLink[] = []
  for (let i = 0; i < urls.length; i++) {
    const rawUrl = (urls[i] ?? "").trim()
    const rawLabel = (labels[i] ?? "").trim()
    if (!rawUrl) continue

    const url = normalizeUrl(rawUrl)
    if (!url) return { error: `"${rawUrl}" isn't a valid link. Use a full http(s) address.` }

    links.push({ label: rawLabel || labelFromUrl(url), url, sortOrder: links.length })
  }

  if (links.length > MAX_CLIENT_LINKS) {
    return { error: `A client can have at most ${MAX_CLIENT_LINKS} links.` }
  }
  return links
}

/** Validates the optional Google Drive field. Empty clears it. */
function parseDriveUrl(formData: FormData): string | null | { error: string } {
  const raw = String(formData.get("driveUrl") ?? "").trim()
  if (!raw) return null
  const url = normalizeUrl(raw)
  if (!url) return { error: "Enter a valid Google Drive link." }
  return url
}

/**
 * Creates a client and the invited login account that will own it.
 *
 * The client's portal access is bound purely by email: we create a User row
 * with status INVITED and no googleId. When they sign in with Google, the
 * verified email matches this row and the account activates.
 */
export async function createClient(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "client:create")
  } catch (error) {
    if (error instanceof ForbiddenError) return fail("You don't have permission to add clients.")
    throw error
  }

  const name = String(formData.get("name") ?? "").trim()
  const company = String(formData.get("company") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const notes = String(formData.get("notes") ?? "").trim()

  if (!name) return fail("Client name is required.")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.")
  // Guard the bootstrap owner: making them a client would demote them on next login.
  if (isSuperAdminEmail(email)) return fail("That email belongs to the Super Admin account.")

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, ownedClient: { select: { id: true } } },
  })
  if (existingUser?.ownedClient) return fail("That email already owns a client profile.")
  if (existingUser && existingUser.role !== "CLIENT") {
    return fail("That email belongs to a team member. Use a different address.")
  }

  const driveUrl = parseDriveUrl(formData)
  if (driveUrl !== null && typeof driveUrl === "object") return fail(driveUrl.error)

  const links = parseLinks(formData)
  if (!Array.isArray(links)) return fail(links.error)

  await prisma.client.create({
    data: {
      name,
      company: company || null,
      notes: notes || null,
      driveUrl,
      links: links.length > 0 ? { create: links } : undefined,
      // Connect rather than set createdById: mixing a scalar FK with a nested
      // relation write puts Prisma in "unchecked" mode, which forbids `owner`.
      createdBy: { connect: { id: actor.id } },
      owner: existingUser
        ? { connect: { id: existingUser.id } }
        : { create: { email, name, role: "CLIENT", status: "INVITED" } },
    },
  })

  // Access comes from the account row, not the mail, so a send failure is
  // reported to the admin rather than failing the whole creation.
  const emailed = await sendClientInviteEmail({
    to: email,
    name,
    company: company || null,
    invitedBy: actor.name ?? actor.email,
  })

  revalidatePath("/dashboard/clients")
  return { ok: true, emailed }
}

export async function updateClient(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "client:edit")
  } catch (error) {
    if (error instanceof ForbiddenError) return fail("You don't have permission to edit clients.")
    throw error
  }

  const id = String(formData.get("id") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const company = String(formData.get("company") ?? "").trim()
  const notes = String(formData.get("notes") ?? "").trim()
  const status = String(formData.get("status") ?? "ACTIVE")
  const email = String(formData.get("email") ?? "").trim().toLowerCase()

  if (!id) return fail("Missing client.")
  if (!name) return fail("Client name is required.")
  if (!(CLIENT_STATUSES as readonly string[]).includes(status)) return fail("Invalid status.")

  const driveUrl = parseDriveUrl(formData)
  if (driveUrl !== null && typeof driveUrl === "object") return fail(driveUrl.error)

  const links = parseLinks(formData)
  if (!Array.isArray(links)) return fail(links.error)

  const client = await prisma.client.findUnique({
    where: { id },
    select: { owner: { select: { id: true, email: true } } },
  })
  if (!client) return fail("Client not found.")

  // The login email is the client's only key to the portal, so a change here
  // is really "who owns this profile". Validate it, then rebind the owner row.
  const owner = client.owner
  let emailChanged = false
  if (owner && email && email !== owner.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.")
    if (isSuperAdminEmail(email)) return fail("That email belongs to the Super Admin account.")

    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (taken && taken.id !== owner.id) return fail("That email is already in use.")
    emailChanged = true
  } else if (owner && !email) {
    return fail("A login email is required.")
  }

  // The form always submits the complete set of links, so the stored rows are
  // replaced wholesale. A transaction keeps a failed create from leaving the
  // client with no links at all.
  await prisma.$transaction([
    prisma.clientLink.deleteMany({ where: { clientId: id } }),
    prisma.client.update({
      where: { id },
      data: {
        name,
        company: company || null,
        notes: notes || null,
        status,
        driveUrl,
        links: links.length > 0 ? { create: links } : undefined,
      },
    }),
    // Access is bound to the Google identity that first matched the old email.
    // Changing the address invalidates that binding, so clear it and drop the
    // account back to INVITED — the new address activates on its next sign-in.
    ...(emailChanged && owner
      ? [
          prisma.user.update({
            where: { id: owner.id },
            data: { email, googleId: null, status: "INVITED" },
          }),
        ]
      : []),
  ])

  // A changed email is effectively a fresh invitation, so notify the new address.
  let emailed: boolean | undefined
  if (emailChanged) {
    emailed = await sendClientInviteEmail({
      to: email,
      name,
      company: company || null,
      invitedBy: actor.name ?? actor.email,
    })
  }

  revalidatePath("/dashboard/clients")
  revalidatePath(`/dashboard/clients/${id}`)
  return { ok: true, emailed }
}

/**
 * Resends the portal invite to a client who hasn't signed in yet. Only makes
 * sense while their account is still INVITED — once ACTIVE they already have
 * access and there is nothing to resend.
 */
export async function resendClientInvite(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "client:edit")
  } catch (error) {
    if (error instanceof ForbiddenError) return fail("You don't have permission to invite clients.")
    throw error
  }

  const id = String(formData.get("id") ?? "")
  if (!id) return fail("Missing client.")

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      company: true,
      owner: { select: { email: true, name: true, status: true } },
    },
  })
  if (!client?.owner) return fail("This client has no login account.")
  if (client.owner.status === "ACTIVE") return fail("This client has already signed in.")
  if (client.owner.status === "DISABLED") return fail("This client's account is disabled.")

  const emailed = await sendClientInviteEmail({
    to: client.owner.email,
    name: client.owner.name,
    company: client.company,
    invitedBy: actor.name ?? actor.email,
  })

  if (!emailed) return fail("Couldn't send the email. Check the mail settings and try again.")
  return { ok: true, emailed }
}

/** Assign or unassign a team member as a manager of a client. */
export async function setClientManager(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "client:assignManager")
  } catch (error) {
    if (error instanceof ForbiddenError) return fail("You don't have permission to assign managers.")
    throw error
  }

  const clientId = String(formData.get("clientId") ?? "")
  const userId = String(formData.get("userId") ?? "")
  const assign = String(formData.get("assign") ?? "true") === "true"
  if (!clientId || !userId) return fail("Missing client or user.")

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!user) return fail("User not found.")
  if (user.role === "CLIENT") return fail("Clients cannot be assigned as managers.")

  if (assign) {
    await prisma.clientManager.upsert({
      where: { clientId_userId: { clientId, userId } },
      create: { clientId, userId },
      update: {},
    })
  } else {
    await prisma.clientManager.deleteMany({ where: { clientId, userId } })
  }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}

export async function deleteClient(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "client:delete")
  } catch (error) {
    if (error instanceof ForbiddenError) return fail("Only a Super Admin can delete clients.")
    throw error
  }

  const id = String(formData.get("id") ?? "")
  if (!id) return fail("Missing client.")

  await prisma.client.delete({ where: { id } })
  revalidatePath("/dashboard/clients")
  return { ok: true }
}
