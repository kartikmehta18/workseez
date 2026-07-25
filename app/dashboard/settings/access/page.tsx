import { ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"
import { requireActor } from "@/lib/auth"
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/rbac"
import { listAllUsers } from "./actions"
import { InviteMemberDialog } from "./_components/invite-member-dialog"
import { UserDirectory } from "./_components/user-directory"

export const metadata = { title: "User Access — Workseez" }

export default async function UserAccessPage() {
  const actor = await requireActor()
  if (!can(actor, "user:viewAll")) redirect("/dashboard")

  const users = await listAllUsers()
  const canSetRole = can(actor, "user:setRole")
  const canDisable = can(actor, "user:disable")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Access</h1>
          <p className="text-muted-foreground text-sm">
            Everyone with an account, and what they can reach.
          </p>
        </div>
        {can(actor, "user:invite") ? (
          <InviteMemberDialog canGrantAdmin={actor.role === "SUPER_ADMIN"} />
        ) : null}
      </div>

      {!canSetRole ? (
        <p className="bg-muted text-muted-foreground mt-6 flex items-start gap-2 rounded-md p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Only the Super Admin can change roles. You can invite Managers and view the team.
        </p>
      ) : null}

      <UserDirectory
        users={users}
        actorId={actor.id}
        canSetRole={canSetRole}
        canDisable={canDisable}
      />

      <div className="mt-8 rounded-lg border p-5">
        <h2 className="font-medium">What each role can do</h2>
        {/* Rows stack on phones — a fixed 112px label column leaves the
            description too narrow to read at 320px. */}
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {ROLES.map((role) => (
            <div key={role} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <dt className="text-sm font-medium sm:w-28 sm:shrink-0">{ROLE_LABELS[role]}</dt>
              <dd className="text-muted-foreground text-sm">{ROLE_DESCRIPTIONS[role]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
