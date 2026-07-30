import Link from "next/link"
import { ArrowRight, CalendarDays } from "lucide-react"

import { requireActor } from "@/lib/auth"
import { can, isTeamRole, type Actor } from "@/lib/rbac"
import {
  calendarProgress,
  currentCycleNumber,
  formatDayMonth,
  toCycleOptions,
  toDateInputValue,
  toPostView,
} from "@/lib/content"
import { getOwnCalendar, listCalendarOverviews } from "@/lib/content-queries"
import { driveConfigured } from "@/lib/drive"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CalendarProgressBar, PostStatusBadge } from "./_components/content-badges"
import { CreateCalendarDialog } from "./_components/create-calendar-dialog"
import { CycleBar } from "./_components/calendar-settings"
import { PostList } from "./_components/post-list"

export const metadata = { title: "Content Calendar — Workseez" }

export default async function ContentPage() {
  const actor = await requireActor()

  // A client lands straight on their own calendar; the team lands on the roster
  // of every client's. Same route, because both reach it from the same sidebar
  // entry — the pattern the strategy page already sets.
  return isTeamRole(actor.role) ? <TeamView actor={actor} /> : <ClientView actor={actor} />
}

async function ClientView({ actor }: { actor: Actor }) {
  // getOwnCalendar strips unpublished posts in the query, so nothing the team
  // is still writing reaches this page at all.
  const calendar = await getOwnCalendar(actor)

  if (!calendar || calendar.posts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Content Calendar</h1>
        <div className="mt-6 rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">Nothing here yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Your team is still putting this cycle together. Everything they publish shows up here —
            scripts, dates and where to send your footage.
          </p>
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
  const waiting = posts.filter((post) => post.needsRawUpload).length

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{calendar.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Everything your team is making for you — read the script, leave feedback, send your
            footage.
          </p>
        </div>
      </div>

      {waiting > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-semibold">
            {waiting} {waiting === 1 ? "post is" : "posts are"} waiting on your footage.
          </span>{" "}
          Open the ones marked &ldquo;upload raw video&rdquo; and add your files — everything goes
          straight into the right Drive folder.
        </div>
      ) : null}

      {calendar.cycleStart ? (
        <CycleBar
          settings={{
            id: calendar.id,
            title: calendar.title,
            cycleStart: toDateInputValue(calendar.cycleStart),
            cycleStartLabel: formatDayMonth(calendar.cycleStart),
            cycleLength: calendar.cycleLength,
            rawFolderUrl: calendar.rawFolderUrl,
            editsFolderUrl: calendar.editsFolderUrl,
          }}
          canManage={false}
          canDelete={false}
        />
      ) : null}

      <PostList
        posts={posts}
        cycles={cycles}
        initialCycle={currentCycle}
        viewerRole={actor.role}
        canManage={false}
        canDelete={false}
        canComment
        driveEnabled={driveConfigured()}
        emptyTitle="Nothing in this cycle"
        emptyHint="Pick another cycle, or check back once your team publishes the next batch."
      />
    </div>
  )
}

async function TeamView({ actor }: { actor: Actor }) {
  const overviews = await listCalendarOverviews(actor)
  const withoutCalendar = overviews.filter((client) => !client.contentCalendar)
  const canCreate = can(actor, "content:manage")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Plan each client&apos;s cycle, publish it to them, and track what comes back.
          </p>
        </div>
        {canCreate ? (
          <CreateCalendarDialog
            clients={withoutCalendar.map(({ id, name, company }) => ({ id, name, company }))}
          />
        ) : null}
      </div>

      {overviews.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No clients yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Content calendars are created per client, so add a client first.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/clients">Go to Clients</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviews.map((client) => {
            const calendar = client.contentCalendar
            const progress = calendar ? calendarProgress(calendar.posts) : null
            const feedback =
              calendar?.posts.reduce((sum, post) => sum + post._count.comments, 0) ?? 0
            const unpublished = calendar
              ? calendar.posts.filter((post) => post.sharedAt === null).length
              : 0
            const cycle =
              calendar?.cycleStart != null
                ? currentCycleNumber(calendar.cycleStart, calendar.cycleLength)
                : null
            // The next thing going out, which is what a manager scanning the
            // roster actually wants to know.
            const next = calendar?.posts
              .filter((post) => post.scheduledFor && post.status !== "PUBLISHED")
              .sort(
                (a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0),
              )[0]

            return (
              <li key={client.id}>
                <Link
                  href={`/dashboard/clients/${client.id}/content`}
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

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                    {calendar ? (
                      <>
                        {cycle ? (
                          <span className="bg-muted rounded px-1.5 py-0.5 font-medium">
                            Cycle {cycle}
                          </span>
                        ) : null}
                        {unpublished > 0 ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                            {unpublished} unpublished
                          </span>
                        ) : null}
                        {feedback > 0 ? (
                          <span className="text-muted-foreground">{feedback} feedback</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">No calendar yet</span>
                    )}
                  </div>

                  {next ? (
                    <div className="mt-3 flex items-center gap-2 border-t pt-3">
                      <PostStatusBadge status={next.status} />
                      <span className="text-muted-foreground truncate text-xs">
                        next {next.scheduledFor ? formatDayMonth(next.scheduledFor) : ""}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-auto pt-4">
                    {progress && progress.total > 0 ? (
                      <CalendarProgressBar
                        percent={progress.percent}
                        published={progress.published}
                        total={progress.total}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {calendar
                          ? "No posts yet — add the first one."
                          : canCreate
                            ? "No calendar yet — create one to get started."
                            : "No calendar yet."}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
