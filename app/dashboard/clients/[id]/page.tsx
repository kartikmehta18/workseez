import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, CalendarDays, ClipboardList, Target } from "lucide-react"
import { prisma } from "@/lib/db"
import { requireActor } from "@/lib/auth"
import { getVisibleClient } from "@/lib/clients"
import { can } from "@/lib/rbac"
import { calendarProgress } from "@/lib/content"
import { formProgress } from "@/lib/onboarding"
import { sheetProgress } from "@/lib/strategy"
import { CalendarProgressBar } from "@/app/dashboard/content/_components/content-badges"
import {
  FormStatusBadge,
  ProgressBar,
} from "@/app/dashboard/onboarding/_components/onboarding-badges"
import {
  SheetProgressBar,
  SheetStatusBadge,
} from "@/app/dashboard/strategy/_components/strategy-badges"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ClientStatusBadge, InviteStatusBadge } from "../../_components/status-badges"
import { DriveButton, SocialLinkList } from "../_components/client-links"
import { EditClientDialog } from "./_components/edit-client-dialog"
import { ManagerAssignment } from "./_components/manager-assignment"
import { ResendInviteButton } from "./_components/resend-invite-button"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } })
  return { title: client ? `${client.name} — Workseez` : "Client — Workseez" }
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requireActor()

  // getVisibleClient applies the role scope, so a manager who is not assigned
  // to this client gets a 404 rather than a permission error that confirms it exists.
  const client = await getVisibleClient(actor, id)
  if (!client) notFound()

  const canEdit = can(actor, "client:edit")
  const canAssign = can(actor, "client:assignManager")

  const onboarding = can(actor, "onboarding:manage")
    ? await prisma.onboardingForm.findUnique({
        where: { clientId: client.id },
        select: {
          status: true,
          submittedAt: true,
          sections: {
            select: { questions: { select: { required: true, answer: { select: { value: true } } } } },
          },
        },
      })
    : null
  const onboardingProgress = onboarding ? formProgress(onboarding) : null

  const strategy = can(actor, "strategy:manage")
    ? await prisma.strategySheet.findUnique({
        where: { clientId: client.id },
        select: {
          status: true,
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
      })
    : null
  const strategyProgress = strategy ? sheetProgress(strategy) : null

  const calendar = can(actor, "content:manage")
    ? await prisma.contentCalendar.findUnique({
        where: { clientId: client.id },
        select: {
          title: true,
          posts: {
            select: {
              status: true,
              sharedAt: true,
              needsRawUpload: true,
              _count: { select: { comments: true } },
            },
          },
        },
      })
    : null
  const calendarStats = calendar ? calendarProgress(calendar.posts) : null

  const teamMembers = canAssign
    ? await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, status: { not: "DISABLED" } },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { createdAt: "asc" },
      })
    : []

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Button asChild variant="outline" size="sm" className="-ml-2">
        <Link href="/dashboard/clients">
          <ArrowLeft /> All clients
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-12 shrink-0 sm:size-14">
            {client.owner?.avatarUrl ? <AvatarImage src={client.owner.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {client.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* min-w-0 on both the row and this column, or a long client name
              refuses to shrink and pushes the header past the viewport. */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {client.name}
              </h1>
              <ClientStatusBadge status={client.status} />
            </div>
            {client.company ? (
              <p className="text-muted-foreground truncate text-sm">{client.company}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DriveButton url={client.driveUrl} />
          {canEdit ? (
            <EditClientDialog
              client={{
                id: client.id,
                name: client.name,
                company: client.company,
                notes: client.notes,
                status: client.status,
                driveUrl: client.driveUrl,
                links: client.links.map(({ label, url }) => ({ label, url })),
                ownerEmail: client.owner?.email ?? "",
                ownerStatus: client.owner?.status ?? "INVITED",
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border p-5 lg:col-span-2">
          <h2 className="font-medium">Portal access</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[150px_1fr]">
            <dt className="text-muted-foreground">Login email</dt>
            <dd className="break-all">{client.owner?.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <InviteStatusBadge status={client.owner?.status ?? "INVITED"} />
            </dd>
            <dt className="text-muted-foreground">Added by</dt>
            <dd>{client.createdBy?.name ?? client.createdBy?.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{client.createdAt.toLocaleDateString()}</dd>
          </dl>
          {client.owner?.status === "INVITED" ? (
            <div className="bg-muted mt-4 rounded-md p-3">
              <p className="text-muted-foreground text-xs">
                This client hasn&apos;t signed in yet. They get access the first time they sign in
                with Google using exactly {client.owner.email}.
              </p>
              {canEdit ? (
                <div className="mt-3">
                  <ResendInviteButton clientId={client.id} />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border p-5">
          <h2 className="font-medium">Managers</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Assigned team members can work on this client.
          </p>
          <div className="mt-4">
            {canAssign ? (
              <ManagerAssignment
                clientId={client.id}
                assignedIds={client.managers.map((m) => m.userId)}
                teamMembers={teamMembers}
              />
            ) : client.managers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Unassigned</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {client.managers.map((m) => (
                  <li key={m.userId}>{m.user.name ?? m.user.email}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-lg border p-5">
        <h2 className="font-medium">Links & files</h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Shared workspace and the client&apos;s own accounts.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-muted-foreground text-xs font-medium">Google Drive</h3>
            <div className="mt-2">
              {client.driveUrl ? (
                <DriveButton url={client.driveUrl} />
              ) : (
                <p className="text-muted-foreground text-sm">No Drive folder linked yet.</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-muted-foreground text-xs font-medium">Social accounts</h3>
            <div className="mt-2">
              <SocialLinkList links={client.links} />
            </div>
          </div>
        </div>
      </section>

      {client.notes ? (
        <section className="mt-4 rounded-lg border p-5">
          <h2 className="font-medium">Notes</h2>
          <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{client.notes}</p>
        </section>
      ) : null}

      {onboarding && onboardingProgress ? (
        <Link
          href={`/dashboard/clients/${client.id}/onboarding`}
          className="group hover:border-primary/40 mt-4 flex flex-col rounded-lg border p-5 transition-all hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="text-muted-foreground size-4 shrink-0" />
            <h2 className="group-hover:text-primary font-medium transition-colors">
              Onboarding Form
            </h2>
            <FormStatusBadge status={onboarding.status} />
            <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-4 max-w-md">
            <ProgressBar
              percent={onboardingProgress.percent}
              answered={onboardingProgress.answered}
              total={onboardingProgress.total}
            />
          </div>
        </Link>
      ) : canEdit ? (
        <Link
          href={`/dashboard/clients/${client.id}/onboarding`}
          className="group hover:border-primary/40 mt-4 flex items-center gap-3 rounded-lg border border-dashed p-5 transition-colors"
        >
          <ClipboardList className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0">
            <p className="group-hover:text-primary text-sm font-medium transition-colors">
              Set up the onboarding form
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Start from the standard question set, tailor it, then publish it to {client.name}.
            </p>
          </div>
          <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0" />
        </Link>
      ) : null}

      {strategy && strategyProgress ? (
        <Link
          href={`/dashboard/clients/${client.id}/strategy`}
          className="group hover:border-primary/40 mt-4 flex flex-col rounded-lg border p-5 transition-all hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Target className="text-muted-foreground size-4 shrink-0" />
            <h2 className="group-hover:text-primary font-medium transition-colors">
              Strategy Sheet
            </h2>
            <SheetStatusBadge status={strategy.status} />
            {strategy._count.comments > 0 ? (
              <span className="text-muted-foreground text-xs">
                {strategy._count.comments} feedback
              </span>
            ) : null}
            <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-4 max-w-md">
            <SheetProgressBar
              percent={strategyProgress.percent}
              filled={strategyProgress.filled}
              total={strategyProgress.total}
            />
          </div>
        </Link>
      ) : can(actor, "strategy:manage") ? (
        <Link
          href={`/dashboard/clients/${client.id}/strategy`}
          className="group hover:border-primary/40 mt-4 flex items-center gap-3 rounded-lg border border-dashed p-5 transition-colors"
        >
          <Target className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0">
            <p className="group-hover:text-primary text-sm font-medium transition-colors">
              Set up the strategy sheet
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Positioning, audience, content pillars and competitors — then publish it to{" "}
              {client.name}.
            </p>
          </div>
          <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0" />
        </Link>
      ) : null}

      {calendar && calendarStats ? (
        <Link
          href={`/dashboard/clients/${client.id}/content`}
          className="group hover:border-primary/40 mt-4 flex flex-col rounded-lg border p-5 transition-all hover:shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="text-muted-foreground size-4 shrink-0" />
            <h2 className="group-hover:text-primary font-medium transition-colors">
              {calendar.title}
            </h2>
            {calendarStats.total - calendarStats.shared > 0 ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                {calendarStats.total - calendarStats.shared} unpublished
              </span>
            ) : null}
            {calendar.posts.some((post) => post.needsRawUpload) ? (
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-xs font-medium text-rose-700">
                waiting on footage
              </span>
            ) : null}
            <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-4 max-w-md">
            <CalendarProgressBar
              percent={calendarStats.percent}
              published={calendarStats.published}
              total={calendarStats.total}
            />
          </div>
        </Link>
      ) : can(actor, "content:manage") ? (
        <Link
          href={`/dashboard/clients/${client.id}/content`}
          className="group hover:border-primary/40 mt-4 flex items-center gap-3 rounded-lg border border-dashed p-5 transition-colors"
        >
          <CalendarDays className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0">
            <p className="group-hover:text-primary text-sm font-medium transition-colors">
              Set up the content calendar
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Scripts, shoot direction, dates and Drive folders — published to {client.name} post by
              post.
            </p>
          </div>
          <ArrowRight className="text-muted-foreground ml-auto size-4 shrink-0" />
        </Link>
      ) : null}
    </div>
  )
}
