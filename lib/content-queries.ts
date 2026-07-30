import { prisma } from "@/lib/db"
import type { Prisma } from "@/lib/generated/prisma/client"
import { clientScopeFor } from "@/lib/clients"
import { can, type Actor } from "@/lib/rbac"

/**
 * Database reads for the content calendar.
 *
 * Kept apart from lib/content.ts because that module's constants and pure
 * helpers are imported by client components — pulling `prisma` in alongside
 * them drags the MariaDB driver into the browser bundle and the build fails on
 * `fs`/`net`/`tls`.
 */

const POST_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" } },
  assets: {
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true, email: true } } },
  },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true, avatarUrl: true } } },
  },
  // `satisfies` rather than `as const`: the literal types still have to survive
  // for Prisma to infer the result shape, but `as const` makes the orderBy
  // arrays readonly, which Prisma's own input types reject.
} satisfies Prisma.ContentPostInclude

const CALENDAR_INCLUDE = {
  client: {
    select: { id: true, name: true, company: true, ownerUserId: true, driveUrl: true },
  },
  createdBy: { select: { name: true, email: true } },
  posts: {
    // Undated posts sort last: `scheduledFor` nulls go to the end, then the
    // manual order breaks ties within a day.
    orderBy: [{ scheduledFor: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: POST_INCLUDE,
  },
} satisfies Prisma.ContentCalendarInclude

export type CalendarWithPosts = NonNullable<Awaited<ReturnType<typeof getCalendarForClient>>>
export type PostWithContent = CalendarWithPosts["posts"][number]

/**
 * A client's calendar, but only if this actor may see that client. Returns null
 * for out-of-scope clients so callers can `notFound()` rather than leak that
 * the client exists.
 */
export async function getCalendarForClient(actor: Actor, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true },
  })
  if (!client) return null

  return prisma.contentCalendar.findUnique({ where: { clientId }, include: CALENDAR_INCLUDE })
}

/**
 * The signed-in client's own calendar, with unshared posts stripped out.
 *
 * Filtered in the query rather than after the fact: a post the team has not
 * published carries the script and the shoot direction, so it must never reach
 * the browser at all.
 */
export async function getOwnCalendar(actor: Actor) {
  return prisma.contentCalendar.findFirst({
    where: { client: { ownerUserId: actor.id } },
    include: {
      ...CALENDAR_INCLUDE,
      posts: {
        where: { sharedAt: { not: null } },
        orderBy: [{ scheduledFor: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        include: POST_INCLUDE,
      },
    },
  })
}

/**
 * Just enough of the signed-in client's calendar for the overview card.
 *
 * A separate query rather than reusing getOwnCalendar: that one pulls every
 * script line, comment and asset on every post, which is a lot of rows to load
 * so a dashboard card can show three titles.
 */
export async function getOwnCalendarSummary(actor: Actor) {
  return prisma.contentCalendar.findFirst({
    where: { client: { ownerUserId: actor.id } },
    select: {
      id: true,
      title: true,
      posts: {
        where: { sharedAt: { not: null } },
        orderBy: [{ scheduledFor: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          status: true,
          kind: true,
          scheduledFor: true,
          needsRawUpload: true,
        },
      },
    },
  })
}

/** One post with everything on it, scoped the same way. */
export async function getVisiblePost(actor: Actor, postId: string) {
  const post = await prisma.contentPost.findFirst({
    where: {
      AND: [
        { id: postId },
        can(actor, "content:manage")
          ? { calendar: { client: clientScopeFor(actor) } }
          : // A client reaches their own posts, and only once they are shared.
            { sharedAt: { not: null }, calendar: { client: { ownerUserId: actor.id } } },
      ],
    },
    include: {
      ...POST_INCLUDE,
      calendar: {
        include: { client: { select: { id: true, name: true, ownerUserId: true } } },
      },
    },
  })
  return post
}

/** Every client this actor can see, with just enough calendar state for a list view. */
export async function listCalendarOverviews(actor: Actor) {
  return prisma.client.findMany({
    where: clientScopeFor(actor),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      owner: { select: { email: true, status: true, avatarUrl: true } },
      contentCalendar: {
        select: {
          id: true,
          title: true,
          cycleStart: true,
          cycleLength: true,
          updatedAt: true,
          posts: {
            select: {
              id: true,
              status: true,
              sharedAt: true,
              scheduledFor: true,
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  })
}

/**
 * Who to email about a client's calendar, and who to email back.
 *
 * Team notifications go to the assigned managers plus every admin, so a client
 * uploading footage never lands in a mailbox nobody reads — a manager can be on
 * leave, and an unassigned client would otherwise notify no one at all.
 */
export async function calendarRecipients(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      company: true,
      owner: { select: { email: true, name: true, status: true } },
      managers: {
        select: { user: { select: { email: true, name: true, status: true } } },
      },
    },
  })
  if (!client) return null

  const admins = await prisma.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, status: "ACTIVE" },
    select: { email: true, name: true },
  })

  const team = new Map<string, { email: string; name: string | null }>()
  for (const { user } of client.managers) {
    if (user.status !== "DISABLED") team.set(user.email, { email: user.email, name: user.name })
  }
  for (const admin of admins) team.set(admin.email, admin)

  return {
    client,
    // A client who has never signed in still gets mail: the address is how they
    // were invited in the first place.
    clientEmail: client.owner?.email ?? null,
    clientName: client.owner?.name ?? client.name,
    team: [...team.values()],
  }
}
