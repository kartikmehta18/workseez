import Link from "next/link"
import { ArrowRight, Target } from "lucide-react"

import { requireActor } from "@/lib/auth"
import { can, isTeamRole, type Actor } from "@/lib/rbac"
import { sheetProgress, toSheetSections, toThreadComments } from "@/lib/strategy"
import { getOwnSheet, listSheetOverviews } from "@/lib/strategy-queries"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { CreateSheetDialog } from "./_components/create-sheet-dialog"
import { FeedbackThread } from "./_components/feedback-thread"
import { ApprovalControl } from "./_components/publish-controls"
import { SheetStatusBadge, SheetProgressBar, SheetStatusTrail } from "./_components/strategy-badges"
import { SheetView } from "./_components/sheet-view"

export const metadata = { title: "Strategy — Workseez" }

export default async function StrategyPage() {
  const actor = await requireActor()

  // A client lands straight on their own strategy sheet; the team lands on the
  // roster of every client's sheet. Same route, because both reach it from the
  // same sidebar entry.
  return isTeamRole(actor.role) ? <TeamView actor={actor} /> : <ClientView actor={actor} />
}

async function ClientView({ actor }: { actor: Actor }) {
  const sheet = await getOwnSheet(actor)

  if (!sheet) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Target className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No strategy sheet yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Your team is still putting it together. You&apos;ll see it here as soon as it&apos;s
            ready — no need to check back.
          </p>
        </div>
      </div>
    )
  }

  const comments = toThreadComments(sheet.comments, actor)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Strategy Sheet</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your content strategy, written by your team. Read it through and tell them what you
            think.
          </p>
        </div>
        <SheetStatusBadge status={sheet.status} />
      </div>

      <div className="rounded-lg border px-4 py-3">
        <SheetStatusTrail status={sheet.status} />
      </div>

      <ApprovalControl
        sheetId={sheet.id}
        status={sheet.status}
        approvedAt={sheet.approvedAt?.toLocaleDateString() ?? null}
        isOwner
      />

      <SheetView
        title={sheet.title}
        description={sheet.description}
        sections={toSheetSections(sheet)}
        signOff={sheet}
      />

      <FeedbackThread
        sheetId={sheet.id}
        comments={comments}
        canPost
        viewerRole={actor.role}
        emptyHint="No feedback yet. Anything you'd like changed — say so here and your team will pick it up."
      />
    </div>
  )
}

async function TeamView({ actor }: { actor: Actor }) {
  const overviews = await listSheetOverviews(actor)
  const withoutSheet = overviews.filter((client) => !client.strategySheet)
  const canCreate = can(actor, "strategy:manage")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
          <p className="text-muted-foreground text-sm">
            Write each client&apos;s strategy, publish it, and track what comes back.
          </p>
        </div>
        {canCreate ? (
          <CreateSheetDialog
            clients={withoutSheet.map(({ id, name, company }) => ({ id, name, company }))}
          />
        ) : null}
      </div>

      {overviews.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <Target className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No clients yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Strategy sheets are created per client, so add a client first.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/clients">Go to Clients</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviews.map((client) => {
            const sheet = client.strategySheet
            const progress = sheet ? sheetProgress(sheet) : null

            return (
              <li key={client.id}>
                <Link
                  href={`/dashboard/clients/${client.id}/strategy`}
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

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SheetStatusBadge status={sheet?.status} />
                    {sheet && sheet._count.comments > 0 ? (
                      <span className="text-muted-foreground text-xs">
                        {sheet._count.comments} feedback
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-4">
                    {progress ? (
                      <SheetProgressBar
                        percent={progress.percent}
                        filled={progress.filled}
                        total={progress.total}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {canCreate ? "No sheet yet — create one to get started." : "No sheet yet."}
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
