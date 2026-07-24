"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, CheckCircle2, Loader2, Lock, Save, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { reopenForm, saveAnswers } from "../actions"
import { ProgressBar } from "./onboarding-badges"

export type AnswerQuestion = {
  id: string
  prompt: string
  helpText: string | null
  type: string
  options: string[]
  required: boolean
  value: string
  editedByTeam: boolean
  editedByName: string | null
}

export type AnswerSection = { id: string; title: string; questions: AnswerQuestion[] }

type Props = {
  formId: string
  title: string
  description: string | null
  status: string
  sections: AnswerSection[]
  /** False for a manager, who may shape the questions but not the answers. */
  canEdit: boolean
  /** True when the signed-in user is the client themselves, not staff. */
  isOwner: boolean
}

/**
 * The questionnaire itself — one page, every section, a single save.
 *
 * The client and an overriding admin get exactly the same component; `canEdit`
 * and `isOwner` only change the copy and which buttons appear. Values are held
 * in React state so the progress meter can react as you type; the payload is
 * still built as plain FormData keyed `answer:<questionId>`, so the server
 * never has to agree on a serialisation format.
 */
export function AnswerForm({
  formId,
  title,
  description,
  status,
  sections,
  canEdit,
  isOwner,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [intent, setIntent] = React.useState<"save" | "submit" | null>(null)

  const questions = React.useMemo(() => sections.flatMap((s) => s.questions), [sections])

  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.value])),
  )
  const [dirty, setDirty] = React.useState(false)

  const answered = questions.filter((q) => (values[q.id] ?? "").trim().length > 0).length
  const total = questions.length
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100)
  const missingRequired = questions.filter(
    (q) => q.required && (values[q.id] ?? "").trim().length === 0,
  ).length

  const submitted = status === "SUBMITTED"

  // Leaving with unsaved answers loses real work — the client may have typed
  // paragraphs. The native prompt is enough; a custom modal can't block unload.
  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const setValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }))
    setDirty(true)
  }

  const run = (nextIntent: "save" | "submit") => {
    setIntent(nextIntent)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("formId", formId)
      formData.set("intent", nextIntent)
      for (const question of questions) formData.set(`answer:${question.id}`, values[question.id] ?? "")

      const result = await saveAnswers(formData)
      setIntent(null)

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDirty(false)
      toast.success(
        nextIntent === "submit"
          ? "Submitted. Your team has everything they need."
          : "Progress saved.",
      )
      router.refresh()
    })
  }

  const onReopen = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("formId", formId)
      const result = await reopenForm(formData)
      if (result.ok) {
        toast.success("Form reopened for editing.")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="pb-28">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : isOwner ? (
          <p className="text-muted-foreground mt-1 text-sm">
            Answer in your own words — rough and honest beats polished. You can save and come back
            at any time.
          </p>
        ) : null}
      </div>

      {submitted ? (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <p className="min-w-0 flex-1 text-sm text-emerald-900">
            {isOwner
              ? "You've submitted this form. Need to change something?"
              : "The client has submitted this form."}
          </p>
          <Button variant="outline" size="sm" onClick={onReopen} disabled={pending}>
            Reopen for edits
          </Button>
        </div>
      ) : null}

      {!canEdit ? (
        <div className="text-muted-foreground mt-6 flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="size-4 shrink-0" />
          You&apos;re viewing this read-only. Only the client and an admin can change answers.
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {sections.map((section, sectionIndex) => {
          const sectionAnswered = section.questions.filter(
            (q) => (values[q.id] ?? "").trim().length > 0,
          ).length
          const sectionComplete = sectionAnswered === section.questions.length

          return (
            <section key={section.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    sectionComplete
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {sectionComplete ? <Check className="size-3.5" /> : sectionIndex + 1}
                </span>
                <h2 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {section.title}
                </h2>
                <span className="text-muted-foreground/70 text-xs">
                  {sectionAnswered}/{section.questions.length}
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {section.questions.map((question) => (
                  <QuestionField
                    key={question.id}
                    question={question}
                    value={values[question.id] ?? ""}
                    onChange={(value) => setValue(question.id, value)}
                    disabled={!canEdit || pending}
                    readOnly={!canEdit}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {canEdit ? (
        // Sticky rather than inline: the form is long enough that a footer
        // button would sit thousands of pixels below where you're typing.
        // Sticky (not fixed) so it tracks the content column and needs no
        // knowledge of the sidebar's width or collapsed state.
        <div className="bg-background/95 sticky bottom-4 z-20 mt-8 rounded-xl border shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <ProgressBar
              percent={percent}
              answered={answered}
              total={total}
              className="min-w-36 flex-1"
            />
            <div className="flex items-center gap-2">
              {isOwner ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => run("save")}
                    disabled={pending || !dirty}
                  >
                    {pending && intent === "save" ? <Loader2 className="animate-spin" /> : <Save />}
                    {dirty ? "Save draft" : "Saved"}
                  </Button>
                  <Button onClick={() => run("submit")} disabled={pending}>
                    {pending && intent === "submit" ? <Loader2 className="animate-spin" /> : null}
                    {submitted ? "Save changes" : "Submit"}
                  </Button>
                </>
              ) : (
                // Staff overriding an answer only ever save. Submitting is the
                // client's act — an admin doing it for them would silently
                // claim the client had finished.
                <Button onClick={() => run("save")} disabled={pending || !dirty}>
                  {pending ? <Loader2 className="animate-spin" /> : <Save />}
                  {dirty ? "Save changes" : "Saved"}
                </Button>
              )}
            </div>
            {missingRequired > 0 ? (
              <p className="text-muted-foreground w-full text-xs">
                {missingRequired} required{" "}
                {missingRequired === 1 ? "question is" : "questions are"} still blank.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QuestionField({
  question,
  value,
  onChange,
  disabled,
  readOnly,
}: {
  question: AnswerQuestion
  value: string
  onChange: (value: string) => void
  disabled: boolean
  readOnly: boolean
}) {
  const filled = value.trim().length > 0
  const fieldId = `answer-${question.id}`

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors sm:p-5",
        filled ? "bg-card" : "bg-muted/30",
        !readOnly && "focus-within:border-primary/40 focus-within:bg-card",
      )}
    >
      <Label htmlFor={fieldId} className="text-sm leading-snug font-medium">
        {question.prompt}
        {question.required ? (
          <span className="text-destructive ml-0.5" aria-label="required">
            *
          </span>
        ) : null}
      </Label>
      {question.helpText ? (
        <p className="text-muted-foreground mt-1 text-xs">{question.helpText}</p>
      ) : null}

      <div className="mt-3">
        {readOnly ? (
          <p className={cn("text-sm whitespace-pre-wrap", !filled && "text-muted-foreground")}>
            {filled ? value : "Not answered yet"}
          </p>
        ) : question.type === "SINGLE_CHOICE" ? (
          <div role="radiogroup" aria-labelledby={fieldId} className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const selected = value === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  // Clicking the selected choice clears it, so an optional
                  // question can be un-answered without a "none" option.
                  onClick={() => onChange(selected ? "" : option)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-60",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:border-primary/40 hover:bg-accent",
                  )}
                >
                  {option}
                </button>
              )
            })}
          </div>
        ) : question.type === "SHORT_TEXT" ? (
          <Input
            id={fieldId}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Your answer"
          />
        ) : (
          <Textarea
            id={fieldId}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Your answer"
            className="min-h-24 resize-y"
          />
        )}
      </div>

      {question.editedByTeam ? (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" />
          Edited by {question.editedByName ?? "your team"}
        </p>
      ) : null}
    </div>
  )
}
