"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { clientScopeFor } from "@/lib/clients"
import { assertCan, can, ForbiddenError, type Actor } from "@/lib/rbac"
import {
  isQuestionType,
  MAX_OPTIONS,
  MAX_QUESTIONS_PER_SECTION,
  MAX_SECTIONS,
  seedSections,
} from "@/lib/onboarding"

export type ActionResult = { ok: true } | { ok: false; error: string }

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Revalidates every route that renders this form. */
function revalidateForm(clientId: string) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/onboarding")
  revalidatePath("/dashboard/clients")
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath(`/dashboard/clients/${clientId}/onboarding`)
}

/**
 * Loads a form the actor is allowed to manage.
 *
 * onboarding:manage is a global permission, so the client scope has to be
 * re-applied here — otherwise a manager could manage a form for a client they
 * were never assigned to.
 */
async function loadManageableForm(actor: Actor, formId: string) {
  return prisma.onboardingForm.findFirst({
    where: { AND: [{ id: formId }, { client: clientScopeFor(actor) }] },
    select: { id: true, clientId: true, status: true },
  })
}

/** Creates the questionnaire for a client, pre-filled with the default questions. */
export async function createOnboardingForm(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "onboarding:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to create onboarding forms.")
    }
    throw error
  }

  const clientId = String(formData.get("clientId") ?? "")
  if (!clientId) return fail("Select a client first.")

  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true, onboardingForm: { select: { id: true } } },
  })
  if (!client) return fail("Client not found.")
  if (client.onboardingForm) return fail("That client already has an onboarding form.")

  await prisma.onboardingForm.create({
    data: {
      client: { connect: { id: clientId } },
      createdBy: { connect: { id: actor.id } },
      sections: { create: seedSections() },
    },
  })

  revalidateForm(clientId)
  return { ok: true }
}

export async function deleteOnboardingForm(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "onboarding:editResponse")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("Only an admin can delete an onboarding form.")
    }
    throw error
  }

  const formId = String(formData.get("formId") ?? "")
  const form = await loadManageableForm(actor, formId)
  if (!form) return fail("Form not found.")

  await prisma.onboardingForm.delete({ where: { id: form.id } })
  revalidateForm(form.clientId)
  return { ok: true }
}

type ParsedQuestion = {
  id: string | null
  prompt: string
  type: string
  options: string | null
  required: boolean
}

type ParsedSection = { id: string | null; title: string; questions: ParsedQuestion[] }

/**
 * The builder posts sections and questions as flat parallel arrays plus a
 * per-section question count, which is what regroups them here. Rows carry
 * their existing id (blank for a new row) so a reworded question keeps the
 * answer the client already gave.
 */
function parseStructure(formData: FormData): ParsedSection[] | { error: string } {
  const sectionIds = formData.getAll("sectionId").map(String)
  const sectionTitles = formData.getAll("sectionTitle").map(String)
  const sectionCounts = formData.getAll("sectionQuestionCount").map((v) => Number(v))

  const questionIds = formData.getAll("questionId").map(String)
  const prompts = formData.getAll("questionPrompt").map(String)
  const types = formData.getAll("questionType").map(String)
  const optionBlocks = formData.getAll("questionOptions").map(String)
  const requireds = formData.getAll("questionRequired").map(String)

  if (sectionTitles.length > MAX_SECTIONS) {
    return { error: `A form can have at most ${MAX_SECTIONS} sections.` }
  }
  if (
    sectionIds.length !== sectionTitles.length ||
    sectionCounts.length !== sectionTitles.length ||
    prompts.length !== questionIds.length ||
    prompts.length !== types.length ||
    prompts.length !== optionBlocks.length ||
    prompts.length !== requireds.length
  ) {
    return { error: "The form couldn't be read. Reload the page and try again." }
  }

  const sections: ParsedSection[] = []
  let cursor = 0

  for (let i = 0; i < sectionTitles.length; i++) {
    const title = sectionTitles[i].trim()
    if (!title) return { error: `Section ${i + 1} needs a title.` }

    const count = sectionCounts[i]
    if (!Number.isInteger(count) || count < 0) {
      return { error: "The form couldn't be read. Reload the page and try again." }
    }
    if (count > MAX_QUESTIONS_PER_SECTION) {
      return { error: `"${title}" can have at most ${MAX_QUESTIONS_PER_SECTION} questions.` }
    }

    const questions: ParsedQuestion[] = []
    for (let j = 0; j < count; j++) {
      const index = cursor + j
      const prompt = (prompts[index] ?? "").trim()
      // A blank row is dropped rather than rejected, so clicking "+" and
      // changing your mind never blocks a save.
      if (!prompt) continue

      const type = types[index] ?? "LONG_TEXT"
      if (!isQuestionType(type)) return { error: "Unknown question type." }

      let options: string | null = null
      if (type === "SINGLE_CHOICE") {
        const parsed = (optionBlocks[index] ?? "")
          .split("\n")
          .map((option) => option.trim())
          .filter(Boolean)
        if (parsed.length < 2) {
          return { error: `"${prompt}" is a choice question, so it needs at least 2 options.` }
        }
        if (parsed.length > MAX_OPTIONS) {
          return { error: `"${prompt}" can have at most ${MAX_OPTIONS} options.` }
        }
        options = JSON.stringify(parsed)
      }

      questions.push({
        id: questionIds[index] || null,
        prompt,
        type,
        options,
        required: requireds[index] === "true",
      })
    }

    cursor += count
    sections.push({ id: sectionIds[i] || null, title, questions })
  }

  if (sections.every((section) => section.questions.length === 0)) {
    return { error: "Add at least one question before saving." }
  }

  return sections
}

/** Replaces the form's sections and questions with what the builder submitted. */
export async function saveFormStructure(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "onboarding:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to edit onboarding questions.")
    }
    throw error
  }

  const formId = String(formData.get("formId") ?? "")
  const form = await loadManageableForm(actor, formId)
  if (!form) return fail("Form not found.")

  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!title) return fail("The form needs a title.")

  const sections = parseStructure(formData)
  if (!Array.isArray(sections)) return fail(sections.error)

  const keptSectionIds = sections.map((s) => s.id).filter((id): id is string => Boolean(id))
  const keptQuestionIds = sections
    .flatMap((s) => s.questions.map((q) => q.id))
    .filter((id): id is string => Boolean(id))

  // Ids for new sections are assigned here instead of by the database. That is
  // what lets the whole save be one batched transaction: nothing has to wait on
  // an id coming back, so no step depends on the previous step's result.
  const sectionIds = sections.map((section) => section.id ?? crypto.randomUUID())

  // Existing questions are updated in place, never deleted and recreated —
  // OnboardingAnswer cascades from the question, so recreating one would throw
  // away the answer the client already gave. Only new questions are inserted.
  const newQuestions = sections.flatMap((section, sectionIndex) =>
    section.questions
      .map((question, questionIndex) => ({ question, questionIndex }))
      .filter(({ question }) => !question.id)
      .map(({ question, questionIndex }) => ({
        sectionId: sectionIds[sectionIndex],
        prompt: question.prompt,
        type: question.type,
        options: question.options,
        required: question.required,
        sortOrder: questionIndex,
      })),
  )

  // A batched array rather than an interactive callback. The callback form holds
  // a transaction open across every await, and one round-trip per question
  // overran its 5s budget on a remote database; the array form issues the same
  // statements as a single batch with no such window.
  await prisma.$transaction([
    prisma.onboardingSection.deleteMany({
      where: { formId: form.id, id: { notIn: keptSectionIds.length > 0 ? keptSectionIds : [""] } },
    }),
    prisma.onboardingQuestion.deleteMany({
      where: {
        section: { formId: form.id },
        id: { notIn: keptQuestionIds.length > 0 ? keptQuestionIds : [""] },
      },
    }),

    ...sections.map((section, sectionIndex) =>
      section.id
        ? prisma.onboardingSection.update({
            where: { id: section.id },
            data: { title: section.title, sortOrder: sectionIndex },
          })
        : prisma.onboardingSection.create({
            data: {
              id: sectionIds[sectionIndex],
              formId: form.id,
              title: section.title,
              sortOrder: sectionIndex,
            },
          }),
    ),

    // sectionId is included so a question dragged into another section moves
    // rather than being deleted and recreated (which would lose its answer).
    ...sections.flatMap((section, sectionIndex) =>
      section.questions.flatMap((question, questionIndex) =>
        question.id
          ? [
              prisma.onboardingQuestion.update({
                where: { id: question.id },
                data: {
                  prompt: question.prompt,
                  type: question.type,
                  options: question.options,
                  required: question.required,
                  sortOrder: questionIndex,
                  sectionId: sectionIds[sectionIndex],
                },
              }),
            ]
          : [],
      ),
    ),
    ...(newQuestions.length > 0
      ? [prisma.onboardingQuestion.createMany({ data: newQuestions })]
      : []),

    prisma.onboardingForm.update({
      where: { id: form.id },
      data: { title, description: description || null },
    }),
  ])

  revalidateForm(form.clientId)
  return { ok: true }
}

/** Makes the form visible to the client, or pulls it back to draft. */
export async function setFormStatus(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "onboarding:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to publish onboarding forms.")
    }
    throw error
  }

  const formId = String(formData.get("formId") ?? "")
  const next = String(formData.get("status") ?? "")
  if (next !== "DRAFT" && next !== "PUBLISHED") return fail("Invalid status.")

  const form = await loadManageableForm(actor, formId)
  if (!form) return fail("Form not found.")

  if (next === "PUBLISHED") {
    const questionCount = await prisma.onboardingQuestion.count({
      where: { section: { formId: form.id } },
    })
    if (questionCount === 0) return fail("Add at least one question before publishing.")
  }

  await prisma.onboardingForm.update({
    where: { id: form.id },
    data:
      next === "PUBLISHED"
        ? { status: "PUBLISHED", publishedAt: new Date(), submittedAt: null }
        : { status: "DRAFT" },
  })

  revalidateForm(form.clientId)
  return { ok: true }
}

/**
 * Saves answers. Used by the client filling their own form and by an admin
 * overriding a response — the only difference is which check lets you through.
 */
export async function saveAnswers(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const formId = String(formData.get("formId") ?? "")
  const submit = String(formData.get("intent") ?? "save") === "submit"

  const form = await prisma.onboardingForm.findUnique({
    where: { id: formId },
    select: {
      id: true,
      status: true,
      clientId: true,
      client: { select: { ownerUserId: true } },
      sections: {
        select: { questions: { select: { id: true, prompt: true, required: true, type: true, options: true } } },
      },
    },
  })
  if (!form) return fail("Form not found.")

  const isOwner = form.client.ownerUserId === actor.id
  // An admin may override answers, but only for a client inside their scope.
  const isEditor =
    can(actor, "onboarding:editResponse") &&
    (await prisma.client.count({
      where: { AND: [{ id: form.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isEditor && !isOwner) return fail("You don't have permission to answer this form.")
  if (isOwner && !isEditor && form.status === "DRAFT") {
    return fail("This form isn't open yet. Your team is still preparing it.")
  }

  const questions = form.sections.flatMap((section) => section.questions)
  const updates: { id: string; value: string }[] = []

  for (const question of questions) {
    // A question the form didn't render (e.g. added in another tab) is left
    // untouched rather than blanked out.
    if (!formData.has(`answer:${question.id}`)) continue
    updates.push({ id: question.id, value: String(formData.get(`answer:${question.id}`) ?? "").trim() })
  }

  if (submit) {
    const answeredIds = new Set(updates.filter((u) => u.value).map((u) => u.id))
    const missing = questions.filter((q) => q.required && !answeredIds.has(q.id))
    if (missing.length > 0) {
      const first = missing[0].prompt
      return fail(
        missing.length === 1
          ? `"${first}" is required.`
          : `${missing.length} required questions are still blank, starting with "${first}".`,
      )
    }
  }

  const cleared = updates.filter((update) => !update.value).map((update) => update.id)
  const answered = updates.filter((update) => update.value)

  // Batched rather than an interactive transaction: a long form issued one
  // round-trip per answer, which overran the 5s interactive budget on a remote
  // database. Every cleared answer also collapses into a single delete.
  await prisma.$transaction([
    // Clearing an answer removes the row, so "answered" counts stay honest.
    ...(cleared.length > 0
      ? [prisma.onboardingAnswer.deleteMany({ where: { questionId: { in: cleared } } })]
      : []),
    ...answered.map((update) =>
      prisma.onboardingAnswer.upsert({
        where: { questionId: update.id },
        create: {
          questionId: update.id,
          value: update.value,
          updatedById: actor.id,
          updatedByRole: actor.role,
        },
        update: { value: update.value, updatedById: actor.id, updatedByRole: actor.role },
      }),
    ),
    ...(submit
      ? [
          prisma.onboardingForm.update({
            where: { id: form.id },
            data: { status: "SUBMITTED", submittedAt: new Date() },
          }),
        ]
      : []),
  ])

  revalidateForm(form.clientId)
  return { ok: true }
}

/** Reopens a submitted form so the client can keep editing. */
export async function reopenForm(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const formId = String(formData.get("formId") ?? "")
  const form = await prisma.onboardingForm.findUnique({
    where: { id: formId },
    select: { id: true, clientId: true, client: { select: { ownerUserId: true } } },
  })
  if (!form) return fail("Form not found.")

  const isOwner = form.client.ownerUserId === actor.id
  const canManage =
    can(actor, "onboarding:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: form.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) return fail("You don't have permission to reopen this form.")

  await prisma.onboardingForm.update({
    where: { id: form.id },
    data: { status: "PUBLISHED", submittedAt: null },
  })

  revalidateForm(form.clientId)
  return { ok: true }
}
