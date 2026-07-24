import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ClipboardList } from "lucide-react"

import { prisma } from "@/lib/db"
import { requireActor } from "@/lib/auth"
import { getVisibleClient } from "@/lib/clients"
import { can } from "@/lib/rbac"
import { formProgress, toAnswerSections, toBuilderSections } from "@/lib/onboarding"
import { getFormForClient } from "@/lib/onboarding-queries"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnswerForm } from "@/app/dashboard/onboarding/_components/answer-form"
import { CreateFormDialog } from "@/app/dashboard/onboarding/_components/create-form-dialog"
import { FormBuilder } from "@/app/dashboard/onboarding/_components/form-builder"
import {
  FormStatusBadge,
  ProgressBar,
} from "@/app/dashboard/onboarding/_components/onboarding-badges"
import { PublishControls } from "@/app/dashboard/onboarding/_components/publish-controls"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } })
  return { title: client ? `${client.name} onboarding — Workseez` : "Onboarding — Workseez" }
}

export default async function ClientOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const actor = await requireActor()

  const client = await getVisibleClient(actor, id)
  if (!client) notFound()

  const canManage = can(actor, "onboarding:manage")
  const canEditAnswers = can(actor, "onboarding:editResponse")
  if (!canManage) notFound()

  const form = await getFormForClient(actor, id)

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
            <h1 className="truncate text-2xl font-semibold tracking-tight">Onboarding</h1>
            <FormStatusBadge status={form?.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {client.name}
            {client.company ? ` · ${client.company}` : ""}
          </p>
        </div>
        {form ? (
          <PublishControls
            formId={form.id}
            status={form.status}
            questionCount={form.sections.reduce((sum, s) => sum + s.questions.length, 0)}
            canDelete={canEditAnswers}
          />
        ) : null}
      </div>
    </>
  )

  if (!form) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        {header}
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <ClipboardList className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No onboarding form for {client.name} yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Create one to start from the standard question set. It stays a draft — invisible to the
            client — until you publish it.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateFormDialog
              clients={[{ id: client.id, name: client.name, company: client.company }]}
            />
          </div>
        </div>
      </div>
    )
  }

  const progress = formProgress(form)

  return (
    <div className="mx-auto w-full max-w-4xl">
      {header}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4 sm:col-span-2">
          <ProgressBar
            percent={progress.percent}
            answered={progress.answered}
            total={progress.total}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            {form.status === "DRAFT"
              ? "Not published yet — the client can't see this form."
              : form.submittedAt
                ? `Submitted ${form.submittedAt.toLocaleDateString()}.`
                : progress.requiredMissing > 0
                  ? `${progress.requiredMissing} required ${progress.requiredMissing === 1 ? "answer is" : "answers are"} still outstanding.`
                  : "All required answers are in, awaiting submission."}
          </p>
        </div>
        <dl className="text-muted-foreground rounded-lg border p-4 text-xs">
          <dt>Created by</dt>
          <dd className="text-foreground">{form.createdBy?.name ?? form.createdBy?.email ?? "—"}</dd>
          <dt className="mt-2">Published</dt>
          <dd className="text-foreground">{form.publishedAt?.toLocaleDateString() ?? "—"}</dd>
        </dl>
      </div>

      <Tabs defaultValue={form.status === "DRAFT" ? "questions" : "responses"} className="mt-6">
        <TabsList>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="responses" className="mt-4">
          {/* Same component the client fills in. An admin gets editable fields,
              a manager gets the read-only rendering. */}
          <AnswerForm
            formId={form.id}
            title={form.title}
            description={form.description}
            status={form.status}
            sections={toAnswerSections(form)}
            canEdit={canEditAnswers}
            isOwner={false}
          />
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          <FormBuilder
            formId={form.id}
            title={form.title}
            description={form.description}
            sections={toBuilderSections(form)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
