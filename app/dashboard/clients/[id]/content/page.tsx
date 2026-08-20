import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays } from "lucide-react"

import { prisma } from "@/lib/db"
import { getCurrentActor, requireActor } from "@/lib/auth"
import { getVisibleClient } from "@/lib/clients"
import { can } from "@/lib/rbac"
import {
  calendarProgress,
  currentCycleNumber,
  formatDayMonth,
  toCycleOptions,
  toDateInputValue,
  toPostView,
} from "@/lib/content"
import { getCalendarForClient } from "@/lib/content-queries"
import { driveConfigured, driveRootFolderId } from "@/lib/drive"
import { Button } from "@/components/ui/button"
import { CalendarProgressBar } from "@/app/dashboard/content/_components/content-badges"
import { CycleBar } from "@/app/dashboard/content/_components/calendar-settings"
import { CreateCalendarDialog } from "@/app/dashboard/content/_components/create-calendar-dialog"
import { CreatePostDialog } from "@/app/dashboard/content/_components/create-post-dialog"
import { PostList } from "@/app/dashboard/content/_components/post-list"
import { PublishAllButton } from "@/app/dashboard/content/_components/publish-all-button"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await getCurrentActor()
  const client = actor ? await getVisibleClient(actor, id) : null
  return {
    title: client ? `${client.name} content — Workseez` : "Content Calendar — Workseez",
  }
}

export default async function ClientContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const actor = await requireActor()

  const client = await getVisibleClient(actor, id)
  if (!client) notFound()

  // This is the team's working view of the calendar. A client reaching it would
  // see unpublished posts, so it is not theirs — they have /dashboard/content.
  const canManage = can(actor, "content:manage")
  if (!canManage) notFound()

  const calendar = await getCalendarForClient(actor, id)
  const canDelete = can(actor, "content:delete")

  const header = (
    <>
      <Button asChild variant="outline" size="sm" className="-ml-2">
        <Link href={`/dashboard/clients/${client.id}`}>
          <ArrowLeft /> {client.name}
        </Link>
      </Button>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h1 className="text-xl font-semibold tracking-tight wrap-break-word sm:truncate sm:text-2xl">
            {calendar?.title ?? "Content Calendar"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm wrap-break-word">
            {client.name}
            {client.company ? ` · ${client.company}` : ""}
          </p>
        </div>
        {calendar ? (
          // The buttons stretch to fill the row on a phone rather than sitting
          // as two small targets against the left edge.
          <div className="flex w-full flex-wrap items-center gap-2 *:flex-1 sm:w-auto sm:*:flex-none">
            <PublishAllButton
              calendarId={calendar.id}
              pendingCount={calendar.posts.filter((post) => post.sharedAt === null).length}
            />
            <CreatePostDialog
              calendarId={calendar.id}
              defaultDate={toDateInputValue(calendar.cycleStart) || null}
            />
          </div>
        ) : null}
      </div>
    </>
  )

  if (!calendar) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        {header}
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center sm:p-12">
          <CalendarDays className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No content calendar for {client.name} yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Create one to start planning cycles — scripts, shoot direction, dates and Drive folders.
            Every post stays hidden until you publish it.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateCalendarDialog
              clients={[{ id: client.id, name: client.name, company: client.company }]}
            />
          </div>
        </div>
      </div>
    )
  }

  const posts = calendar.posts.map((post) => toPostView(post, actor))
  const cycles = toCycleOptions(
    calendar,
    calendar.posts.map((post) => post.scheduledFor),
  )
  const currentCycle = calendar.cycleStart
    ? currentCycleNumber(calendar.cycleStart, calendar.cycleLength)
    : null
  const progress = calendarProgress(calendar.posts)
  const feedback = calendar.posts.reduce((sum, post) => sum + post._count.comments, 0)
  const awaitingFootage = calendar.posts.filter((post) => post.needsRawUpload).length

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {header}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0 rounded-lg border p-4 sm:col-span-2">
          <CalendarProgressBar
            percent={progress.percent}
            published={progress.published}
            total={progress.total}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            {progress.total === 0
              ? "Nothing on the calendar yet."
              : `${progress.shared} of ${progress.total} visible to the client${
                  awaitingFootage > 0 ? ` · ${awaitingFootage} waiting on footage` : ""
                }${feedback > 0 ? ` · ${feedback} feedback` : ""}.`}
          </p>
        </div>
        <dl className="text-muted-foreground min-w-0 rounded-lg border p-4 text-xs">
          <dt>Created by</dt>
          <dd className="text-foreground wrap-break-word">
            {calendar.createdBy?.name ?? calendar.createdBy?.email ?? "—"}
          </dd>
          <dt className="mt-2">Current cycle</dt>
          <dd className="text-foreground">
            {currentCycle
              ? `Cycle ${currentCycle}`
              : "Not set — add a start date in the settings"}
          </dd>
        </dl>
      </div>

      <CycleBar
        settings={{
          id: calendar.id,
          title: calendar.title,
          cycleStart: toDateInputValue(calendar.cycleStart),
          cycleStartLabel: calendar.cycleStart ? formatDayMonth(calendar.cycleStart) : null,
          cycleLength: calendar.cycleLength,
          rawFolderUrl: calendar.rawFolderUrl,
          editsFolderUrl: calendar.editsFolderUrl,
        }}
        canManage
        canDelete={canDelete}
      />

      {/* Uploads need both halves: a service account to write with, and a folder
          to write into. Saying which one is missing saves a support round trip. */}
      {!driveConfigured() ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-xs">
          In-portal Drive uploads aren&apos;t configured on this server, so clients see a link to
          the folder instead of an upload button. Everything else works as normal.
        </p>
      ) : !calendar.rawFolderUrl && !driveRootFolderId() ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-xs">
          No raw-footage folder is linked yet, so uploads have nowhere to land. Add one in the
          calendar settings above.
        </p>
      ) : null}

      <PostList
        posts={posts}
        cycles={cycles}
        initialCycle={currentCycle}
        viewerRole={actor.role}
        canManage
        canDelete={canDelete}
        canComment
        driveEnabled={driveConfigured()}
        emptyTitle="No posts yet"
        emptyHint="Add the first post of the cycle — title, type and date now, script next."
      />
    </div>
  )
}
