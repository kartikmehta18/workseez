import { prisma } from "@/lib/db"
import { clientScopeFor } from "@/lib/clients"
import { type Actor } from "@/lib/rbac"

/**
 * Database reads for strategy sheets.
 *
 * Kept apart from lib/strategy.ts because that module's constants and pure
 * helpers are imported by client components — pulling `prisma` in alongside
 * them drags the MariaDB driver into the browser bundle and the build fails on
 * `fs`/`net`/`tls`.
 */

const SHEET_INCLUDE = {
  client: { select: { id: true, name: true, company: true, ownerUserId: true } },
  createdBy: { select: { name: true, email: true } },
  sections: {
    orderBy: { sortOrder: "asc" },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      rows: { orderBy: { sortOrder: "asc" } },
    },
  },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true, avatarUrl: true } } },
  },
} as const

export type StrategySheetWithContent = NonNullable<Awaited<ReturnType<typeof getVisibleSheet>>>

/**
 * A client's sheet, but only if this actor may see that client. Returns null
 * for out-of-scope clients so callers can `notFound()` rather than leak that
 * the client exists.
 */
export async function getSheetForClient(actor: Actor, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true },
  })
  if (!client) return null

  return prisma.strategySheet.findUnique({ where: { clientId }, include: SHEET_INCLUDE })
}

/** Loads a sheet by its own id, scoped the same way. */
export async function getVisibleSheet(actor: Actor, sheetId: string) {
  return prisma.strategySheet.findFirst({
    where: { AND: [{ id: sheetId }, { client: clientScopeFor(actor) }] },
    include: SHEET_INCLUDE,
  })
}

/** The signed-in client's own sheet. A draft is not theirs to see yet. */
export async function getOwnSheet(actor: Actor) {
  const sheet = await prisma.strategySheet.findFirst({
    where: { client: { ownerUserId: actor.id } },
    include: SHEET_INCLUDE,
  })
  return sheet && sheet.status === "DRAFT" ? null : sheet
}

/** Every client this actor can see, with just enough sheet state for a list view. */
export async function listSheetOverviews(actor: Actor) {
  return prisma.client.findMany({
    where: clientScopeFor(actor),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      owner: { select: { email: true, status: true, avatarUrl: true } },
      strategySheet: {
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          publishedAt: true,
          approvedAt: true,
          _count: { select: { comments: true } },
          sections: {
            select: {
              kind: true,
              columns: { select: { id: true } },
              rows: { select: { label: true, cells: true } },
            },
          },
        },
      },
    },
  })
}
