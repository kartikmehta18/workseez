import Link from "next/link"
import { Database, KeyRound, ShieldCheck, UserCog } from "lucide-react"
import { prisma } from "@/lib/db"
import { requireActor } from "@/lib/auth"
import { can, ROLE_LABELS } from "@/lib/rbac"
import { Badge } from "@/components/ui/badge"
import {
  GenerateKeyButton,
  RequestKeyButton,
  ViewKeyButton,
} from "../_components/generate-key-button"

export const metadata = { title: "Settings — Workseez" }

// Open to every role, clients included: this is where anyone regenerates their
// own access key, and having to ask an admin for that would defeat the point of
// a sign-in method that exists for people Google doesn't work for. Every
// section below is still gated on what the actor may actually see.
export default async function SettingsPage() {
  const actor = await requireActor()

  const account = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { accessKeySetAt: true },
  })

  // Admins and the Super Admin re-key themselves; a manager or client asks.
  const canIssueKeys = can(actor, "user:resetKey")

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

      <section className="mt-4 rounded-lg border p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" /> Your access key
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Six digits that sign you in on their own — the way in when Google isn&apos;t an
          option on this address.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {account?.accessKeySetAt ? (
              <ViewKeyButton
                target={{ kind: "self" }}
                label="Show my key"
                description="your own account"
                size="default"
              />
            ) : null}

            {/* Issuing a key *is* granting access, so it stays with the roles
                that may grant it. Everyone else asks, and an admin sends one. */}
            {canIssueKeys ? (
              <GenerateKeyButton
                target={{ kind: "self" }}
                label={account?.accessKeySetAt ? "Generate a new key" : "Generate my key"}
                description="your own account"
                size="default"
              />
            ) : (
              <RequestKeyButton
                label={account?.accessKeySetAt ? "Request a new key" : "Request an access key"}
                size="default"
              />
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {account?.accessKeySetAt
              ? `Issued ${account.accessKeySetAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}.`
              : "You don't have one yet."}{" "}
            {canIssueKeys
              ? `A new key replaces it and is emailed to ${actor.email}.`
              : `Only an Admin can issue keys — asking sends them a note, and the new key arrives at ${actor.email}.`}
          </p>
        </div>
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
