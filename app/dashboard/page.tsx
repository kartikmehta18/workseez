import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FolderOpen,
  Link as LinkIcon,
  UserCheck,
  Users,
  UserCog,
} from "lucide-react"
import { prisma } from "@/lib/db"
import { requireActor } from "@/lib/auth"
import { listVisibleClients } from "@/lib/clients"
import { formProgress } from "@/lib/onboarding"
import { getOwnForm } from "@/lib/onboarding-queries"
import { can, isTeamRole, ROLE_LABELS } from "@/lib/rbac"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DriveButton, SocialLinkList } from "./clients/_components/client-links"
import { ClientStatusBadge, InviteStatusBadge } from "./_components/status-badges"
import { FormStatusBadge, ProgressBar } from "./onboarding/_components/onboarding-badges"

export const metadata = { title: "Dashboard — Workseez" }

export default async function DashboardPage() {
  const actor = await requireActor()
  const clients = await listVisibleClients(actor)
  const firstName = (actor.name ?? actor.email).split(" ")[0]

  // A client sees their own workspace, not the agency-wide overview.
  if (!isTeamRole(actor.role)) {
    const own = clients[0]
    // getOwnForm hides drafts, so an unpublished form never surfaces here.
    const ownForm = await getOwnForm(actor)
    const ownProgress = ownForm ? formProgress(ownForm) : null
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 shrink-0">
            {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-base">
              {(actor.name ?? actor.email).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-muted-foreground truncate text-sm">{actor.email}</p>
          </div>
        </div>

        {own ? (
          <section className="mt-8 rounded-lg border p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{own.name}</h2>
                {own.company ? (
                  <p className="text-muted-foreground text-sm">{own.company}</p>
                ) : null}
              </div>
              <ClientStatusBadge status={own.status} />
            </div>

            {/* The client gets the same Drive folder and social links their
                account manager sees — read-only, since editing is admin-only. */}
            <div className="mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2">
              <div>
                <h3 className="text-muted-foreground text-xs font-medium">Google Drive</h3>
                <div className="mt-2">
                  {own.driveUrl ? (
                    <DriveButton url={own.driveUrl} />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No Drive folder shared with you yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="text-muted-foreground text-xs font-medium">Social accounts</h3>
                <div className="mt-2">
                  <SocialLinkList links={own.links} />
                </div>
              </div>
            </div>

            {ownForm && ownProgress ? (
              <Link
                href="/dashboard/onboarding"
                className="group hover:border-primary/40 mt-6 flex flex-col rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList className="text-muted-foreground size-4 shrink-0" />
                  <p className="group-hover:text-primary text-sm font-medium transition-colors">
                    {ownForm.title}
                  </p>
                  <FormStatusBadge status={ownForm.status} />
                  <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {ownForm.status === "SUBMITTED"
                    ? "Submitted — thank you. Open it to review or change an answer."
                    : ownProgress.answered === 0
                      ? "Your team needs this to build your strategy. It takes about 20 minutes."
                      : "Pick up where you left off."}
                </p>
                <div className="mt-4 max-w-sm">
                  <ProgressBar
                    percent={ownProgress.percent}
                    answered={ownProgress.answered}
                    total={ownProgress.total}
                  />
                </div>
              </Link>
            ) : null}

            <p className="text-muted-foreground mt-6 text-sm">
              Your content calendar and strategy sheet will appear here as your team sets them up.
            </p>
          </section>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">No workspace yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Your account manager hasn&apos;t finished setting up your profile.
            </p>
          </div>
        )}
      </div>
    )
  }

  const activeClients = clients.filter((c) => c.status === "ACTIVE").length
  const pendingInvites = clients.filter((c) => c.owner?.status === "INVITED").length
  const teamCount = can(actor, "user:viewAll")
    ? await prisma.user.count({ where: { role: { not: "CLIENT" } } })
    : null

  const stats = [
    { label: "Active clients", value: activeClients, icon: Users },
    { label: "Awaiting first sign-in", value: pendingInvites, icon: UserCheck },
    ...(teamCount === null ? [] : [{ label: "Team members", value: teamCount, icon: UserCog }]),
  ]

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="from-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-linear-to-r to-transparent p-5 sm:p-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1 truncate text-sm">
            Signed in as {ROLE_LABELS[actor.role]} · {actor.email}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/clients">
            View all clients <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="hover:border-primary/30 rounded-xl border p-5 transition-colors hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground truncate text-sm font-medium">{label}</p>
              <span className="bg-primary/5 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Recent clients</h2>
          {clients.length > 6 ? (
            <Link
              href="/dashboard/clients"
              className="text-muted-foreground hover:text-primary text-sm transition-colors"
            >
              See all {clients.length}
            </Link>
          ) : null}
        </div>

        {clients.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed p-12 text-center">
            <Users className="text-muted-foreground mx-auto size-8" />
            <p className="mt-3 font-medium">No clients yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {can(actor, "client:create")
                ? "Add your first client to get started."
                : "You have not been assigned to any clients yet."}
            </p>
            {can(actor, "client:create") ? (
              <Button asChild className="mt-4">
                <Link href="/dashboard/clients">Go to Clients</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clients.slice(0, 6).map((client) => (
              <li key={client.id}>
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="group hover:border-primary/40 flex h-full flex-col rounded-xl border p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10 shrink-0">
                      {client.owner?.avatarUrl ? (
                        <AvatarImage src={client.owner.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {client.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="group-hover:text-primary truncate font-medium transition-colors">
                        {client.name}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {client.company ?? client.owner?.email ?? "—"}
                      </p>
                    </div>
                    <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <ClientStatusBadge status={client.status} />
                    <InviteStatusBadge status={client.owner?.status ?? "INVITED"} />
                  </div>

                  {/* What's actually been set up for this client, at a glance. */}
                  <div className="text-muted-foreground mt-3 flex items-center gap-3 border-t pt-3 text-xs">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="size-3.5" />
                      {client.driveUrl ? "Drive" : "No Drive"}
                    </span>
                    <span className="flex items-center gap-1">
                      <LinkIcon className="size-3.5" />
                      {client.links.length} {client.links.length === 1 ? "link" : "links"}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCog className="size-3.5" />
                      {client.managers.length}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-dashed p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <CalendarDays className="size-4" /> Content Calendar
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Post scheduling, scripts and status tracking land here next.
        </p>
      </section>
    </div>
  )
}
