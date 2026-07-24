import Link from "next/link"
import { redirect } from "next/navigation"
import { Database, ShieldCheck, UserCog } from "lucide-react"
import { requireActor } from "@/lib/auth"
import { can, isTeamRole, ROLE_LABELS } from "@/lib/rbac"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Settings — Workseez" }

export default async function SettingsPage() {
  const actor = await requireActor()
  if (!isTeamRole(actor.role)) redirect("/dashboard")

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted-foreground text-sm">Workspace configuration and your account.</p>

      <section className="mt-8 rounded-lg border p-5">
        <h2 className="font-medium">Your account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{actor.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{actor.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            <Badge variant="secondary">{ROLE_LABELS[actor.role]}</Badge>
          </dd>
        </dl>
        <p className="text-muted-foreground mt-4 text-xs">
          Name and photo come from your Google account and refresh on each sign-in.
        </p>
      </section>

      {can(actor, "user:viewAll") ? (
        <Link
          href="/dashboard/settings/access"
          className="hover:bg-accent mt-4 flex items-start gap-3 rounded-lg border p-5 transition-colors"
        >
          <UserCog className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="block font-medium">User Access</span>
            <span className="text-muted-foreground text-sm">
              {can(actor, "user:setRole")
                ? "Invite people and set who is an Admin, Manager or Client."
                : "Invite Managers and review the team."}
            </span>
          </span>
        </Link>
      ) : null}

      {actor.role === "SUPER_ADMIN" ? (
        <section className="mt-4 rounded-lg border p-5">
          <h2 className="flex items-center gap-2 font-medium">
            <Database className="size-4" /> Workspace
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
            <dt className="text-muted-foreground">Database</dt>
            <dd>Hostinger MariaDB (srv1826.hstgr.io)</dd>
            <dt className="text-muted-foreground">Sign-in</dt>
            <dd>Google OAuth, invite-only</dd>
            <dt className="text-muted-foreground">Super Admin</dt>
            <dd>{actor.email}</dd>
          </dl>
          <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            The Super Admin is pinned by the SUPER_ADMIN_EMAIL environment variable, so this
            account cannot be demoted or disabled from the UI.
          </p>
        </section>
      ) : null}
    </div>
  )
}
