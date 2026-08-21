/**
 * Roles, permissions and the single source of truth for who may do what.
 *
 * Every permission check must run on the server. UI that hides a button is a
 * convenience, not a security boundary — the server actions in app/dashboard
 * re-check with `assertCan` before touching the database.
 */

export const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CLIENT"] as const
export type Role = (typeof ROLES)[number]

export const USER_STATUSES = ["INVITED", "ACTIVE", "DISABLED"] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const CLIENT_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

/**
 * The bootstrap Super Admin. This email always resolves to SUPER_ADMIN on
 * sign-in, so the first login provisions the owner account with no seed step
 * and the role can never be revoked by an errant update.
 */
export const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.toLowerCase() ?? "kartikmehta650@gmail.com"

export function isSuperAdminEmail(email: string) {
  return email.toLowerCase() === SUPER_ADMIN_EMAIL
}

export type Permission =
  | "client:create"
  | "client:edit"
  | "client:delete"
  | "client:viewAll"
  | "client:assignManager"
  | "user:viewAll"
  | "user:invite"
  | "user:setRole"
  | "user:disable"
  // Issue a fresh 6-digit access key for someone else and email it to them.
  // Held by both admin roles: it is the only way back in for a client who never
  // had a Google account, and it doubles as the unlock for a keyed-out account.
  // Everyone can always regenerate their OWN key, which needs no permission.
  | "user:resetKey"
  | "settings:manage"
  // Build, edit and publish a client's onboarding questionnaire.
  | "onboarding:manage"
  // Override an answer the client gave. Deliberately narrower than
  // onboarding:manage — a manager shapes the questions but does not rewrite
  // what the client said.
  | "onboarding:editResponse"
  // Write, restructure and publish a client's strategy sheet. The sheet is the
  // team's own document, so unlike onboarding there is no separate "edit the
  // content" grant — managers author it in full.
  | "strategy:manage"
  // Delete a whole sheet. Held back from managers because it discards the
  // team's written work along with the client's feedback thread.
  | "strategy:delete"
  // Create, edit and publish content calendar posts — scripts, dates, statuses
  // and Drive links. Like strategy:manage this is the team's own document, so
  // there is no narrower "edit the content" grant.
  | "content:manage"
  // Delete a post or a whole calendar. Held back from managers for the same
  // reason as strategy:delete — it discards the client's feedback with it.
  | "content:delete"

const PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "client:create",
    "client:edit",
    "client:delete",
    "client:viewAll",
    "client:assignManager",
    "user:viewAll",
    "user:invite",
    "user:setRole",
    "user:disable",
    "user:resetKey",
    "settings:manage",
    "onboarding:manage",
    "onboarding:editResponse",
    "strategy:manage",
    "strategy:delete",
    "content:manage",
    "content:delete",
  ],
  // Admins run day-to-day operations but cannot change roles — only the
  // Super Admin decides who is an admin, manager or client.
  ADMIN: [
    "client:create",
    "client:edit",
    "client:viewAll",
    "client:assignManager",
    "user:viewAll",
    "user:invite",
    "user:resetKey",
    "onboarding:manage",
    "onboarding:editResponse",
    "strategy:manage",
    "strategy:delete",
    "content:manage",
    "content:delete",
  ],
  // Managers only ever see the clients they are assigned to. onboarding:manage,
  // strategy:manage and content:manage are global grants, but every action
  // re-checks visibility through clientScopeFor, so they only ever reach their
  // own clients.
  MANAGER: ["onboarding:manage", "strategy:manage", "content:manage"],
  CLIENT: [],
}

export type Actor = {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role
  status: UserStatus
}

export function can(actor: Actor | null, permission: Permission) {
  if (!actor || actor.status !== "ACTIVE") return false
  return PERMISSIONS[actor.role].includes(permission)
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`)
    this.name = "ForbiddenError"
  }
}

/** Throws unless the actor holds the permission. Use in every server action. */
export function assertCan(actor: Actor | null, permission: Permission): asserts actor is Actor {
  if (!can(actor, permission)) throw new ForbiddenError(permission)
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  CLIENT: "Client",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Full control, including role assignment.",
  ADMIN: "Manages clients and the team, cannot change roles.",
  MANAGER: "Works on assigned clients only.",
  CLIENT: "Sees their own portal only.",
}

/** Team roles are everything except CLIENT — used by the dashboard nav. */
export function isTeamRole(role: Role) {
  return role !== "CLIENT"
}
