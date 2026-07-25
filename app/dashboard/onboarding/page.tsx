import Link from "next/link"
import { ArrowRight, ClipboardList } from "lucide-react"

import { requireActor } from "@/lib/auth"
import { can, isTeamRole } from "@/lib/rbac"
import { formProgress, toAnswerSections } from "@/lib/onboarding"
import { getOwnForm, listFormOverviews } from "@/lib/onboarding-queries"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { AnswerForm } from "./_components/answer-form"
import { CreateFormDialog } from "./_components/create-form-dialog"
import { FormStatusBadge, ProgressBar } from "./_components/onboarding-badges"

export const metadata = { title: "Onboarding — Workseez" }

export default async function OnboardingPage() {
  const actor = await requireActor()

  // A client lands straight on their own questionnaire; the team lands on the
  // roster of every client's form. Same route, because both reach it from the
  // same sidebar entry.
  return isTeamRole(actor.role) ? <TeamView actor={actor} /> : <ClientView actor={actor} />
}

async function ClientView({ actor }: { actor: Awaited<ReturnType<typeof requireActor>> }) {
  const form = await getOwnForm(actor)

  if (!form) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ClipboardList className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No onboarding form yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            Your team is still preparing it. You&apos;ll see it here as soon as it&apos;s ready —
            no need to check back.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <AnswerForm
        formId={form.id}
        title={form.title}
        description={form.description}
        status={form.status}
        sections={toAnswerSections(form)}
        canEdit
        isOwner
      />
    </div>
  )
}

async function TeamView({ actor }: { actor: Awaited<ReturnType<typeof requireActor>> }) {
  const overviews = await listFormOverviews(actor)
  const withoutForm = overviews.filter((client) => !client.onboardingForm)
  const canCreate = can(actor, "onboarding:manage")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-muted-foreground text-sm">
            Build each client&apos;s questionnaire, publish it, and track what comes back.
          </p>
        </div>
        {canCreate ? (
          <CreateFormDialog
            clients={withoutForm.map(({ id, name, company }) => ({ id, name, company }))}
          />
        ) : null}
      </div>

      {overviews.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <ClipboardList className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No clients yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Onboarding forms are created per client, so add a client first.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/clients">Go to Clients</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviews.map((client) => {
            const form = client.onboardingForm
            const progress = form ? formProgress(form) : null

            return (
              <li key={client.id}>
                <Link
                  href={`/dashboard/clients/${client.id}/onboarding`}
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

                  <div className="mt-3">
                    <FormStatusBadge status={form?.status} />
                  </div>

                  <div className="mt-auto pt-4">
                    {progress ? (
                      <ProgressBar
                        percent={progress.percent}
                        answered={progress.answered}
                        total={progress.total}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {canCreate
                          ? "No form yet — create one to get started."
                          : "No form yet."}
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
