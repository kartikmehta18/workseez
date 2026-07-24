import { prisma } from "@/lib/db"
import { clientScopeFor } from "@/lib/clients"
import { type Actor } from "@/lib/rbac"

/**
 * Database reads for onboarding forms.
 *
 * Kept apart from lib/onboarding.ts because that module's constants and pure
 * helpers are imported by client components — pulling `prisma` in alongside
 * them drags the MariaDB driver into the browser bundle and the build fails on
 * `fs`/`net`/`tls`.
 */

const FORM_INCLUDE = {
  client: { select: { id: true, name: true, company: true } },
  createdBy: { select: { name: true, email: true } },
  sections: {
    orderBy: { sortOrder: "asc" },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          answer: { include: { updatedBy: { select: { name: true, email: true } } } },
        },
      },
    },
  },
} as const

export type OnboardingFormWithContent = NonNullable<Awaited<ReturnType<typeof getVisibleForm>>>

/**
 * A client's form, but only if this actor may see that client. Returns null for
 * out-of-scope clients so callers can `notFound()` rather than leak that the
 * client exists.
 */
export async function getFormForClient(actor: Actor, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true },
  })
  if (!client) return null

  return prisma.onboardingForm.findUnique({ where: { clientId }, include: FORM_INCLUDE })
}

/** Loads a form by its own id, scoped the same way. */
export async function getVisibleForm(actor: Actor, formId: string) {
  return prisma.onboardingForm.findFirst({
    where: { AND: [{ id: formId }, { client: clientScopeFor(actor) }] },
    include: FORM_INCLUDE,
  })
}

/** The signed-in client's own form. A draft is not theirs to see yet. */
export async function getOwnForm(actor: Actor) {
  const form = await prisma.onboardingForm.findFirst({
    where: { client: { ownerUserId: actor.id } },
    include: FORM_INCLUDE,
  })
  return form && form.status === "DRAFT" ? null : form
}

/** Every client this actor can see, with just enough form state for a list view. */
export async function listFormOverviews(actor: Actor) {
  return prisma.client.findMany({
    where: clientScopeFor(actor),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      owner: { select: { email: true, status: true, avatarUrl: true } },
      onboardingForm: {
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          publishedAt: true,
          submittedAt: true,
          sections: {
            select: {
              questions: {
                select: { id: true, required: true, answer: { select: { value: true } } },
              },
            },
          },
        },
      },
    },
  })
}
