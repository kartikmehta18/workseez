import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Target } from "lucide-react"

import { prisma } from "@/lib/db"
import { requireActor } from "@/lib/auth"
import { getVisibleClient } from "@/lib/clients"
import { can } from "@/lib/rbac"
import {
  sheetProgress,
  toDateInputValue,
  toSheetSections,
  toThreadComments,
} from "@/lib/strategy"
import { getSheetForClient } from "@/lib/strategy-queries"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateSheetDialog } from "@/app/dashboard/strategy/_components/create-sheet-dialog"
import { FeedbackThread } from "@/app/dashboard/strategy/_components/feedback-thread"
import { PublishControls } from "@/app/dashboard/strategy/_components/publish-controls"
import { SheetBuilder } from "@/app/dashboard/strategy/_components/sheet-builder"
import { SheetView } from "@/app/dashboard/strategy/_components/sheet-view"
import { SignOffEditor } from "@/app/dashboard/strategy/_components/sign-off-editor"
import {
  SheetProgressBar,
  SheetStatusBadge,
  SheetStatusTrail,
} from "@/app/dashboard/strategy/_components/strategy-badges"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } })
  return { title: client ? `${client.name} strategy — Workseez` : "Strategy — Workseez" }
}

export default async function ClientStrategyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await requireActor()

  const client = await getVisibleClient(actor, id)
  if (!client) notFound()

  const canManage = can(actor, "strategy:manage")
  if (!canManage) notFound()

  const sheet = await getSheetForClient(actor, id)

  const header = (
    <>
      <Button asChild variant="outline" size="sm" className="-ml-2">
        <Link href={`/dashboard/clients/${client.id}`}>
          <ArrowLeft /> {client.name}
        </Link>
      </Button>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">Strategy Sheet</h1>
            <SheetStatusBadge status={sheet?.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {client.name}
            {client.company ? ` · ${client.company}` : ""}
          </p>
        </div>
        {sheet ? (
          <PublishControls
            sheetId={sheet.id}
            status={sheet.status}
            rowCount={sheet.sections.reduce((sum, section) => sum + section.rows.length, 0)}
            canDelete={can(actor, "strategy:delete")}
          />
        ) : null}
      </div>
    </>
  )

  if (!sheet) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        {header}
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <Target className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No strategy sheet for {client.name} yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Create one to start from the standard skeleton — overview, audience, content pillars
            and competitors. It stays a draft, invisible to the client, until you publish it.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateSheetDialog
              clients={[{ id: client.id, name: client.name, company: client.company }]}
            />
          </div>
        </div>
      </div>
    )
  }

  const progress = sheetProgress(sheet)
  const sections = toSheetSections(sheet)
  const comments = toThreadComments(sheet.comments, actor)

  return (
    <div className="mx-auto w-full max-w-4xl">
      {header}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 sm:col-span-2">
          <SheetProgressBar
            percent={progress.percent}
            filled={progress.filled}
            total={progress.total}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            {sheet.status === "DRAFT"
              ? "Not published yet — the client can't see this sheet."
              : sheet.approvedAt
                ? `Approved by the client ${sheet.approvedAt.toLocaleDateString()}.`
                : comments.length > 0
                  ? `${comments.length} ${comments.length === 1 ? "message" : "messages"} in the feedback thread.`
                  : "Published — waiting on the client to read it."}
          </p>
        </div>
        <dl className="text-muted-foreground rounded-lg border p-4 text-xs">
          <dt>Created by</dt>
          <dd className="text-foreground">
            {sheet.createdBy?.name ?? sheet.createdBy?.email ?? "—"}
          </dd>
          <dt className="mt-2">Published</dt>
          <dd className="text-foreground">{sheet.publishedAt?.toLocaleDateString() ?? "—"}</dd>
        </dl>
      </div>

      <div className="mt-4 rounded-lg border px-4 py-3">
        <SheetStatusTrail status={sheet.status} />
      </div>

      <Tabs defaultValue={sheet.status === "DRAFT" ? "edit" : "preview"} className="mt-6">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="feedback">
            Feedback{comments.length > 0 ? ` (${comments.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Exactly what the client sees, so there is no separate thing to keep
            in sync — it is the same component their page renders. */}
        <TabsContent value="preview" className="mt-4">
          <SheetView
            title={sheet.title}
            description={sheet.description}
            sections={sections}
            signOff={sheet}
          />
        </TabsContent>

        <TabsContent value="edit" className="mt-4 space-y-6">
          <SheetBuilder
            sheetId={sheet.id}
            title={sheet.title}
            description={sheet.description}
            sections={sections}
          />
          <SignOffEditor
            sheetId={sheet.id}
            strategistName={sheet.strategistName}
            strategistDate={toDateInputValue(sheet.strategistDate)}
            teamLeadName={sheet.teamLeadName}
            teamLeadDate={toDateInputValue(sheet.teamLeadDate)}
          />
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <FeedbackThread
            sheetId={sheet.id}
            comments={comments}
            canPost
            viewerRole={actor.role}
            emptyHint={
              sheet.status === "DRAFT"
                ? "Nothing yet — the client can leave feedback once you publish."
                : "Nothing yet. The client hasn't left any feedback on this sheet."
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
