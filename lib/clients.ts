import { cache } from "react"
import { prisma } from "@/lib/db"
import { can, canSeeClientEmail, type Actor } from "@/lib/rbac"

/**
 * The scoping rule for client data, in one place so no page can forget it:
 *   - Super Admin / Admin  -> every client
 *   - Manager              -> only clients they are assigned to
 *   - Client               -> only the client profile they own
 */
export function clientScopeFor(actor: Actor) {
  if (can(actor, "client:viewAll")) return {}
  if (actor.role === "MANAGER") return { managers: { some: { userId: actor.id } } }
  return { ownerUserId: actor.id }
}

/**
 * Hides a client's login email from everyone but the Super Admin — and the
 * client themselves, on their own profile.
 *
 * Done here, on the row, rather than in each page: a value that reaches a page
 * reaches the browser, whether or not anything renders it. `hasEmail` survives
 * the redaction so the UI can still tell "has an address" from "key-only".
 */
function withOwnerEmailScope<
  T extends { owner: { id: string; email: string | null } | null },
>(actor: Actor, client: T) {
  const { owner } = client
  if (!owner) return { ...client, owner: null }
  const visible = canSeeClientEmail(actor) || owner.id === actor.id
  return {
    ...client,
    owner: { ...owner, email: visible ? owner.email : null, hasEmail: owner.email !== null },
  }
}

/**
 * The same redaction for the list queries that select the owner without an id.
 */
export function redactOwnerEmails<T extends { owner: { email: string | null } | null }>(
  actor: Actor,
  clients: T[],
): T[] {
  if (canSeeClientEmail(actor)) return clients
  return clients.map((client) =>
    client.owner ? { ...client, owner: { ...client.owner, email: null } } : client,
  )
}

/**
 * `take` is optional so the two callers can ask for what they actually render:
 * the clients page lists everything, the dashboard overview shows six.
 */
export const listVisibleClients = cache(async function listVisibleClients(
  actor: Actor,
  take?: number,
) {
  const clients = await prisma.client.findMany({
    where: clientScopeFor(actor),
    orderBy: { createdAt: "desc" },
    ...(take === undefined ? {} : { take }),
    include: {
      owner: { select: { id: true, email: true, name: true, status: true, avatarUrl: true } },
      managers: { include: { user: { select: { id: true, name: true, email: true } } } },
      links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
  return clients.map((client) => withOwnerEmailScope(actor, client))
})

/**
 * The counts the dashboard overview shows above the client cards. A grouped
 * count rather than `listVisibleClients(...).filter(...)`: the overview only
 * renders six cards, so counting in JS meant loading every client — with all
 * their owners, managers and links — to produce two numbers.
 */
export async function visibleClientStats(actor: Actor) {
  const scope = clientScopeFor(actor)

  const [total, active, pendingInvites] = await Promise.all([
    prisma.client.count({ where: scope }),
    prisma.client.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
    prisma.client.count({ where: { AND: [scope, { owner: { status: "INVITED" } }] } }),
  ])

  return { total, active, pendingInvites }
}

/**
 * Returns the client only if this actor is allowed to see it, else null.
 *
 * Memoised per request: a route's `generateMetadata` needs the client's name
 * and the page itself needs the whole row, and both run for the same render.
 * The cache key is (actor, clientId) by identity, which holds because
 * `getCurrentActor` is itself cached and so hands back the same actor object
 * to every caller in the request.
 */
export const getVisibleClient = cache(async function getVisibleClient(
  actor: Actor,
  clientId: string,
) {
  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          avatarUrl: true,
          // Whether they have a 6-digit key, and since when. Never the key or
          // its hash — the profile page only reports that one exists.
          accessKeySetAt: true,
        },
      },
      createdBy: { select: { name: true, email: true } },
      managers: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
  return client ? withOwnerEmailScope(actor, client) : null
})
