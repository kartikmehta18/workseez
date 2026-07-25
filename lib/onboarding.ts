import { can, type Actor } from "@/lib/rbac"

/**
 * Onboarding questionnaires — constants, types and pure helpers.
 *
 * This module must stay free of `prisma`: client components import the
 * constants below, and a database import here would pull the MariaDB driver
 * into the browser bundle. Database reads live in lib/onboarding-queries.ts.
 *
 * Each client gets its own form — there is no shared template. A new form is
 * seeded from DEFAULT_SECTIONS below and is then fully editable per client, so
 * reworking one client's questions never touches another's.
 *
 * Lifecycle: DRAFT (team is still writing questions, client sees nothing)
 *         -> PUBLISHED (client can fill and edit)
 *         -> SUBMITTED (client marked it done; they can still reopen it, and
 *            admins can override answers).
 */
export const FORM_STATUSES = ["DRAFT", "PUBLISHED", "SUBMITTED"] as const
export type FormStatus = (typeof FORM_STATUSES)[number]

export const QUESTION_TYPES = ["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  SHORT_TEXT: "Short answer",
  LONG_TEXT: "Paragraph",
  SINGLE_CHOICE: "Choose one",
}

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  SUBMITTED: "Submitted",
}

export const MAX_SECTIONS = 20
export const MAX_QUESTIONS_PER_SECTION = 30
export const MAX_OPTIONS = 12

export function isFormStatus(value: string): value is FormStatus {
  return (FORM_STATUSES as readonly string[]).includes(value)
}

export function isQuestionType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value)
}

/** Choice labels are stored as a JSON string; never let a bad row throw. */
export function parseOptions(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((o) => String(o)).filter(Boolean) : []
  } catch {
    return []
  }
}

type SeedQuestion = {
  prompt: string
  type?: QuestionType
  options?: string[]
  required?: boolean
}

/**
 * The starting question set, lifted from the agency's existing onboarding doc.
 * Copied into a form at creation time — editing this constant does not change
 * forms that already exist.
 */
export const DEFAULT_SECTIONS: { title: string; questions: SeedQuestion[] }[] = [
  {
    title: "Core Positioning",
    questions: [
      { prompt: 'If someone asks, "What do you do?" — what do you usually say?', required: true },
      { prompt: "What do you WANT people to come to you for?", required: true },
      { prompt: "Which 3 words should people associate with you?", type: "SHORT_TEXT", required: true },
      { prompt: "Who should NOT relate to your content?" },
    ],
  },
  {
    title: "Experience & Edge",
    questions: [
      { prompt: "What have you done or experienced that most people in your niche haven't?", required: true },
      { prompt: "What do you have strong opinions about in your industry?" },
      { prompt: "What advice do people give in your niche that you DISAGREE with?" },
    ],
  },
  {
    title: "Audience Clarity",
    questions: [
      { prompt: "Who are you making content for?", required: true },
      { prompt: "What problem does your audience talk about openly?", required: true },
      { prompt: "What does your audience secretly want to become?" },
      { prompt: "What problem do they struggle with but don't admit publicly?" },
    ],
  },
  {
    title: "Content Direction",
    questions: [
      {
        prompt: "What type of content feels most natural?",
        type: "SINGLE_CHOICE",
        options: [
          "Talking to the camera",
          "Voiceover with b-roll",
          "Text on screen",
          "Interviews & conversations",
          "A mix of formats",
        ],
        required: true,
      },
      { prompt: "Which creators' content do you enjoy watching? Why?" },
      {
        prompt: "Are you comfortable with sharing opinions, being controversial, talking about failures?",
        type: "SINGLE_CHOICE",
        options: ["Yes", "No", "Depends on the topic"],
        required: true,
      },
    ],
  },
  {
    title: "Voice, Tone & Boundaries",
    questions: [
      {
        prompt: "Which tone do you prefer?",
        type: "SINGLE_CHOICE",
        options: [
          "Friendly & relatable",
          "Professional & authoritative",
          "Bold & opinionated",
          "Calm & educational",
        ],
        required: true,
      },
      { prompt: "Any topics you do NOT want to talk about publicly?" },
      { prompt: "Anything you feel insecure or hesitant about showing online?" },
    ],
  },
  {
    title: "Competitor & Creator Intelligence",
    questions: [
      { prompt: "List 3–5 creators in your space", type: "SHORT_TEXT", required: true },
      { prompt: "What do you LIKE about their content?" },
      { prompt: "What do you NOT like about their content?" },
      { prompt: "What are they NOT talking about that they should be?" },
    ],
  },
  {
    title: "Offer & Buying Intent",
    questions: [
      {
        prompt: "Main goal from Instagram?",
        type: "SINGLE_CHOICE",
        options: ["Authority", "Leads & clients", "Direct sales", "Community", "Brand deals"],
        required: true,
      },
      { prompt: "What do you currently sell (or want to sell)?", required: true },
      { prompt: "Why would someone choose YOU over others? (USP)" },
      { prompt: "What do you currently charge?", type: "SHORT_TEXT" },
    ],
  },
  {
    title: "Additional Questions",
    questions: [
      { prompt: "ONE message you wish your audience truly understood about you?" },
      { prompt: "Anything else to help us position you better?" },
      { prompt: "In 60–90 days, what result would make this successful?" },
    ],
  },
]

/** Nested create payload for a brand-new form, seeded from DEFAULT_SECTIONS. */
export function seedSections() {
  return DEFAULT_SECTIONS.map((section, sectionIndex) => ({
    title: section.title,
    sortOrder: sectionIndex,
    questions: {
      create: section.questions.map((question, questionIndex) => ({
        prompt: question.prompt,
        type: question.type ?? "LONG_TEXT",
        options: question.options ? JSON.stringify(question.options) : null,
        required: question.required ?? false,
        sortOrder: questionIndex,
      })),
    },
  }))
}

type LoadedSections = {
  sections: {
    id: string
    title: string
    questions: {
      id: string
      prompt: string
      helpText: string | null
      type: string
      options: string | null
      required: boolean
      answer: {
        value: string
        updatedByRole: string | null
        updatedBy: { name: string | null; email: string } | null
      } | null
    }[]
  }[]
}

/**
 * Reshapes a loaded form into the plain props the AnswerForm client component
 * takes — options parsed out of JSON, answers flattened onto their question.
 */
export function toAnswerSections(form: LoadedSections) {
  return form.sections.map((section) => ({
    id: section.id,
    title: section.title,
    questions: section.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      helpText: question.helpText,
      type: question.type,
      options: parseOptions(question.options),
      required: question.required,
      value: question.answer?.value ?? "",
      // Only flag an override by staff — a client seeing "edited by you" on
      // their own answer is noise.
      editedByTeam: Boolean(
        question.answer?.updatedByRole && question.answer.updatedByRole !== "CLIENT",
      ),
      editedByName: question.answer?.updatedBy?.name ?? question.answer?.updatedBy?.email ?? null,
    })),
  }))
}

/** Reshapes a loaded form into the props the FormBuilder client component takes. */
export function toBuilderSections(form: LoadedSections) {
  return form.sections.map((section) => ({
    id: section.id,
    title: section.title,
    questions: section.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      type: question.type,
      options: parseOptions(question.options),
      required: question.required,
      hasAnswer: (question.answer?.value ?? "").trim().length > 0,
    })),
  }))
}

type CountableSections = {
  sections: { questions: { required: boolean; answer: { value: string } | null }[] }[]
}

/** Answered / total counts used by every progress indicator in the feature. */
export function formProgress(form: CountableSections) {
  const questions = form.sections.flatMap((section) => section.questions)
  const answered = questions.filter((q) => (q.answer?.value ?? "").trim().length > 0)
  const requiredMissing = questions.filter(
    (q) => q.required && (q.answer?.value ?? "").trim().length === 0,
  )
  return {
    total: questions.length,
    answered: answered.length,
    requiredMissing: requiredMissing.length,
    percent: questions.length === 0 ? 0 : Math.round((answered.length / questions.length) * 100),
  }
}

/**
 * Who may change answers right now. The client owns their responses; admins can
 * override at any point, including after submission.
 */
export function canAnswer(actor: Actor, form: { status: string; client: { id: string } }, isOwner: boolean) {
  if (can(actor, "onboarding:editResponse")) return true
  return isOwner && form.status !== "DRAFT"
}
