"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  MAX_QUESTIONS_PER_SECTION,
  MAX_SECTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
} from "@/lib/onboarding"
import { saveFormStructure } from "../actions"

export type BuilderQuestion = {
  id: string | null
  prompt: string
  type: string
  options: string[]
  required: boolean
  /** Shows a warning before deleting a question the client has already answered. */
  hasAnswer: boolean
}

export type BuilderSection = { id: string | null; title: string; questions: BuilderQuestion[] }

type Row<T> = T & { key: number }
type SectionRow = Row<Omit<BuilderSection, "questions"> & { questions: Row<BuilderQuestion>[] }>

/**
 * The question editor. Sections and questions are held in React state because
 * reordering has to move real rows, which uncontrolled inputs can't express.
 *
 * On submit every field is written out as a hidden input in render order, so
 * the server reads them with `FormData.getAll` as parallel arrays and regroups
 * them using the per-section question count. Existing rows keep their database
 * id, which is what lets a question be reworded without losing its answer.
 */
export function FormBuilder({
  formId,
  title: initialTitle,
  description: initialDescription,
  sections: initialSections,
  onSaved,
}: {
  formId: string
  title: string
  description: string | null
  sections: BuilderSection[]
  onSaved?: () => void
}) {
  const [pending, startTransition] = React.useTransition()

  const [title, setTitle] = React.useState(initialTitle)
  const [description, setDescription] = React.useState(initialDescription ?? "")

  // Rows carry a stable key that is never the array index: reordering and
  // deleting both move rows, and an index key makes React reuse the wrong DOM
  // node, stranding the text you just typed in a different question.
  const [sections, setSections] = React.useState<SectionRow[]>(() => {
    let key = 0
    return initialSections.map((section) => ({
      ...section,
      key: key++,
      questions: section.questions.map((question) => ({ ...question, key: key++ })),
    }))
  })

  // Seeded past every initial key so rows added later never collide. Only ever
  // read or written from event handlers, never during render.
  const nextKey = React.useRef(
    initialSections.reduce((sum, section) => sum + section.questions.length + 1, 0),
  )
  const makeKey = () => nextKey.current++

  const updateSection = (key: number, patch: Partial<SectionRow>) =>
    setSections((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const updateQuestion = (
    sectionKey: number,
    questionKey: number,
    patch: Partial<Row<BuilderQuestion>>,
  ) =>
    setSections((current) =>
      current.map((section) =>
        section.key !== sectionKey
          ? section
          : {
              ...section,
              questions: section.questions.map((q) =>
                q.key === questionKey ? { ...q, ...patch } : q,
              ),
            },
      ),
    )

  /** Moves an item within an array by ±1. Out-of-range moves are no-ops. */
  const move = <T,>(items: T[], index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return items
    const copy = [...items]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    return copy
  }

  const addSection = () =>
    setSections((current) =>
      current.length >= MAX_SECTIONS
        ? current
        : [
            ...current,
            {
              key: makeKey(),
              id: null,
              title: `Section ${current.length + 1}`,
              questions: [
                { key: makeKey(), id: null, prompt: "", type: "LONG_TEXT", options: [], required: false, hasAnswer: false },
              ],
            },
          ],
    )

  const removeSection = (section: SectionRow) => {
    const answered = section.questions.filter((q) => q.hasAnswer).length
    if (
      answered > 0 &&
      !window.confirm(
        `"${section.title}" has ${answered} answered ${answered === 1 ? "question" : "questions"}. Deleting the section deletes those answers. Continue?`,
      )
    ) {
      return
    }
    setSections((current) => current.filter((s) => s.key !== section.key))
  }

  const addQuestion = (sectionKey: number) =>
    setSections((current) =>
      current.map((section) =>
        section.key !== sectionKey || section.questions.length >= MAX_QUESTIONS_PER_SECTION
          ? section
          : {
              ...section,
              questions: [
                ...section.questions,
                { key: makeKey(), id: null, prompt: "", type: "LONG_TEXT", options: [], required: false, hasAnswer: false },
              ],
            },
      ),
    )

  const removeQuestion = (sectionKey: number, question: Row<BuilderQuestion>) => {
    if (
      question.hasAnswer &&
      !window.confirm("This question has been answered. Deleting it deletes the answer. Continue?")
    ) {
      return
    }
    setSections((current) =>
      current.map((section) =>
        section.key !== sectionKey
          ? section
          : { ...section, questions: section.questions.filter((q) => q.key !== question.key) },
      ),
    )
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveFormStructure(formData)
      if (result.ok) {
        toast.success("Questions saved.")
        onSaved?.()
      } else {
        toast.error(result.error)
      }
    })
  }

  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0)

  return (
    <form action={onSubmit}>
      <input type="hidden" name="formId" value={formId} />

      <div className="grid gap-4 rounded-lg border p-5">
        <div className="grid gap-2">
          <Label htmlFor="builder-title">Form title</Label>
          <Input
            id="builder-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="builder-description">
            Intro for the client <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="builder-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Explain why you're asking and roughly how long it takes."
            className="min-h-20 resize-y"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {sections.map((section, sectionIndex) => (
          <fieldset key={section.key} className="rounded-lg border p-4 sm:p-5">
            {/* Section identity and its question count travel together — the
                count is how the server regroups the flat question arrays. */}
            <input type="hidden" name="sectionId" value={section.id ?? ""} />
            <input type="hidden" name="sectionQuestionCount" value={section.questions.length} />

            <div className="flex flex-wrap items-center gap-2">
              <GripVertical className="text-muted-foreground/50 size-4 shrink-0" />
              <Input
                name="sectionTitle"
                value={section.title}
                onChange={(event) => updateSection(section.key, { title: event.target.value })}
                aria-label={`Section ${sectionIndex + 1} title`}
                className="h-9 min-w-0 flex-1 font-medium"
                required
              />
              <div className="flex items-center gap-1">
                <MoveButtons
                  disabled={pending}
                  onUp={() => setSections((current) => move(current, sectionIndex, -1))}
                  onDown={() => setSections((current) => move(current, sectionIndex, 1))}
                  upDisabled={sectionIndex === 0}
                  downDisabled={sectionIndex === sections.length - 1}
                  label={`section ${sectionIndex + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => removeSection(section)}
                  aria-label={`Delete section ${sectionIndex + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {section.questions.map((question, questionIndex) => (
                <QuestionEditor
                  key={question.key}
                  question={question}
                  index={questionIndex}
                  disabled={pending}
                  isFirst={questionIndex === 0}
                  isLast={questionIndex === section.questions.length - 1}
                  onChange={(patch) => updateQuestion(section.key, question.key, patch)}
                  onMove={(delta) =>
                    setSections((current) =>
                      current.map((s) =>
                        s.key === section.key
                          ? { ...s, questions: move(s.questions, questionIndex, delta) }
                          : s,
                      ),
                    )
                  }
                  onRemove={() => removeQuestion(section.key, question)}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={pending || section.questions.length >= MAX_QUESTIONS_PER_SECTION}
              onClick={() => addQuestion(section.key)}
            >
              <Plus /> Add question
            </Button>
          </fieldset>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4"
        disabled={pending || sections.length >= MAX_SECTIONS}
        onClick={addSection}
      >
        <Plus /> Add section
      </Button>

      <div className="bg-background/95 sticky bottom-4 z-20 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
        <p className="text-muted-foreground text-sm">
          {sections.length} {sections.length === 1 ? "section" : "sections"} · {totalQuestions}{" "}
          {totalQuestions === 1 ? "question" : "questions"}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save questions"}
        </Button>
      </div>
    </form>
  )
}

function MoveButtons({
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  disabled,
  label,
}: {
  onUp: () => void
  onDown: () => void
  upDisabled: boolean
  downDisabled: boolean
  disabled: boolean
  label: string
}) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || upDisabled}
        onClick={onUp}
        aria-label={`Move ${label} up`}
        className="text-muted-foreground size-8"
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || downDisabled}
        onClick={onDown}
        aria-label={`Move ${label} down`}
        className="text-muted-foreground size-8"
      >
        <ChevronDown />
      </Button>
    </>
  )
}

function QuestionEditor({
  question,
  index,
  disabled,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  question: Row<BuilderQuestion>
  index: number
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onChange: (patch: Partial<Row<BuilderQuestion>>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const isChoice = question.type === "SINGLE_CHOICE"

  return (
    <div className={cn("bg-muted/30 rounded-lg border p-3", question.hasAnswer && "border-emerald-200")}>
      {/* Every question writes the same four hidden fields in the same order,
          whatever its type, so the parallel arrays never fall out of step. */}
      <input type="hidden" name="questionId" value={question.id ?? ""} />
      <input type="hidden" name="questionType" value={question.type} />
      <input type="hidden" name="questionRequired" value={question.required ? "true" : "false"} />
      <input type="hidden" name="questionOptions" value={question.options.join("\n")} />

      <div className="flex items-start gap-2">
        <span className="text-muted-foreground mt-2.5 w-5 shrink-0 text-right text-xs tabular-nums">
          {index + 1}
        </span>
        <Textarea
          name="questionPrompt"
          value={question.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          placeholder="Type the question the client will see"
          aria-label={`Question ${index + 1}`}
          className="min-h-16 min-w-0 flex-1 resize-y bg-background"
        />
        <div className="flex shrink-0 flex-col items-center">
          <div className="flex">
            <MoveButtons
              disabled={disabled}
              onUp={() => onMove(-1)}
              onDown={() => onMove(1)}
              upDisabled={isFirst}
              downDisabled={isLast}
              label={`question ${index + 1}`}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Delete question ${index + 1}`}
            className="text-muted-foreground hover:text-destructive size-8"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
        <Select
          value={question.type}
          disabled={disabled}
          onValueChange={(value) =>
            onChange({
              type: value,
              // Seed a choice question with two blank-ish options so the editor
              // shows something to type into instead of an empty box.
              options:
                value === "SINGLE_CHOICE" && question.options.length === 0
                  ? ["Option 1", "Option 2"]
                  : question.options,
            })
          }
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {QUESTION_TYPE_LABELS[type as QuestionType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={question.required ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          aria-pressed={question.required}
          onClick={() => onChange({ required: !question.required })}
          className="h-8 text-xs"
        >
          {question.required ? "Required" : "Optional"}
        </Button>

        {question.hasAnswer ? (
          <span className="text-xs text-emerald-700">Answered</span>
        ) : null}
      </div>

      {isChoice ? (
        <div className="mt-2 pl-7">
          <Label htmlFor={`options-${question.key}`} className="text-muted-foreground text-xs">
            Options — one per line
          </Label>
          <Textarea
            id={`options-${question.key}`}
            value={question.options.join("\n")}
            disabled={disabled}
            onChange={(event) => onChange({ options: event.target.value.split("\n") })}
            className="bg-background mt-1 min-h-20 resize-y text-sm"
          />
        </div>
      ) : null}
    </div>
  )
}
