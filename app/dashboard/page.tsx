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
import { listVisibleClients, visibleClientStats } from "@/lib/clients"
import { formatDayMonth } from "@/lib/content"
import { getOwnCalendarSummary } from "@/lib/content-queries"
import { formProgress } from "@/lib/onboarding"
import { getOwnForm } from "@/lib/onboarding-queries"
import { can, isTeamRole, ROLE_LABELS } from "@/lib/rbac"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DriveButton, SocialLinkList } from "./clients/_components/client-links"
import { ClientStatusBadge, InviteStatusBadge } from "./_components/status-badges"
import { PostStatusBadge, RawUploadBadge } from "./content/_components/content-badges"
import { FormStatusBadge, ProgressBar } from "./onboarding/_components/onboarding-badges"

export const metadata = { title: "Dashboard — Workseez" }

/** How many client cards the overview grid shows. */
const RECENT_CLIENTS = 6

export default async function DashboardPage() {
  const actor = await requireActor()
  const firstName = (actor.name ?? actor.email).split(" ")[0]

  // A client sees their own workspace, not the agency-wide overview.
  if (!isTeamRole(actor.role)) {
    // One wave rather than three awaits in a row: a client owns exactly one
    // workspace, and their profile, questionnaire and calendar have nothing to
    // do with each other.
    //
    // getOwnForm hides drafts, so an unpublished form never surfaces here.
    // The calendar carries only posts already published to them, so the card
    // can never spoil work in progress.
    const [clients, ownForm, calendar] = await Promise.all([
      listVisibleClients(actor, 1),
      getOwnForm(actor),
      getOwnCalendarSummary(actor),
    ])

    const own = clients[0]
    const ownProgress = ownForm ? formProgress(ownForm) : null
    // Upcoming first, and anything waiting on their footage pulled to the front
    // — that is the one thing on this page they have to act on.
    const awaitingFootage = calendar?.posts.filter((post) => post.needsRawUpload) ?? []
    const upcoming = (calendar?.posts ?? [])
      .filter((post) => post.status !== "PUBLISHED" && !post.needsRawUpload)
      .slice(0, 3)
    const calendarHighlights = [...awaitingFootage, ...upcoming].slice(0, 4)
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

            {calendar && calendar.posts.length > 0 ? (
              <div className="mt-6 rounded-lg border">
                <Link
                  href="/dashboard/content"
                  className="group hover:bg-muted/40 flex flex-wrap items-center gap-2 rounded-t-lg px-4 py-3 transition-colors"
                >
                  <CalendarDays className="text-muted-foreground size-4 shrink-0" />
                  <p className="group-hover:text-primary text-sm font-medium transition-colors">
                    {calendar.title}
                  </p>
                  <span className="text-muted-foreground text-xs">
                    {calendar.posts.length} {calendar.posts.length === 1 ? "post" : "posts"}
                  </span>
                  <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>

                {awaitingFootage.length > 0 ? (
                  <p className="border-t border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
                    <span className="font-semibold">
                      {awaitingFootage.length}{" "}
                      {awaitingFootage.length === 1 ? "post needs" : "posts need"} your footage.
                    </span>{" "}
                    Open the calendar to upload it.
                  </p>
                ) : null}

                <ul className="divide-y border-t">
                  {calendarHighlights.map((post) => (
                    <li key={post.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{post.title}</span>
                      {post.needsRawUpload ? <RawUploadBadge /> : null}
                      <PostStatusBadge status={post.status} kind={post.kind} />
                      <span className="text-muted-foreground w-14 shrink-0 text-right text-xs">
                        {post.scheduledFor ? formatDayMonth(post.scheduledFor) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground mt-6 text-sm">
                Your content calendar and strategy sheet will appear here as your team sets them up.
              </p>
            )}
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

  // The card grid shows six clients, so only six are loaded. The headline
  // numbers come from counts rather than from filtering a full list in JS —
  // that meant loading every client, with every owner, manager and link, to
  // render two integers.
  const [clients, clientStats, teamCount] = await Promise.all([
    listVisibleClients(actor, RECENT_CLIENTS),
    visibleClientStats(actor),
    can(actor, "user:viewAll")
      ? prisma.user.count({ where: { role: { not: "CLIENT" } } })
      : null,
  ])

  const stats = [
    { label: "Active clients", value: clientStats.active, icon: Users },
    { label: "Awaiting first sign-in", value: clientStats.pendingInvites, icon: UserCheck },
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
          {clientStats.total > RECENT_CLIENTS ? (
            <Link
              href="/dashboard/clients"
              className="text-muted-foreground hover:text-primary text-sm transition-colors"
            >
              See all {clientStats.total}
            </Link>
          ) : null}
        </div>

        {clientStats.total === 0 ? (
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
            {clients.map((client) => (
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

      <Link
        href="/dashboard/content"
        className="group hover:border-primary/40 mt-8 flex items-center gap-3 rounded-lg border p-5 transition-all hover:shadow-sm"
      >
        <CalendarDays className="text-muted-foreground size-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="group-hover:text-primary font-medium transition-colors">
            Content Calendar
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Plan each cycle, write the scripts, publish to the client and collect their feedback.
          </p>
        </div>
        <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </div>
  )
}
