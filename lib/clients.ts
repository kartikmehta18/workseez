import { prisma } from "@/lib/db"
import { can, type Actor } from "@/lib/rbac"

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

export async function listVisibleClients(actor: Actor) {
  return prisma.client.findMany({
    where: clientScopeFor(actor),
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, email: true, name: true, status: true, avatarUrl: true } },
      managers: { include: { user: { select: { id: true, name: true, email: true } } } },
      links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
}

/** Returns the client only if this actor is allowed to see it, else null. */
export async function getVisibleClient(actor: Actor, clientId: string) {
  return prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    include: {
      owner: { select: { id: true, email: true, name: true, status: true, avatarUrl: true } },
      createdBy: { select: { name: true, email: true } },
      managers: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      links: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  })
}
