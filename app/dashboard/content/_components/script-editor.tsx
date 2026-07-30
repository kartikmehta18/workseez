"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { defaultScriptLabels, MAX_SCRIPT_LINES, type ContentKind } from "@/lib/content"

export type DraftLine = { key: string; id: string | null; label: string; body: string }

const newKey = () => Math.random().toString(36).slice(2)

/** The starting script for a kind, as editable draft rows. */
export function seedDraft(kind: ContentKind): DraftLine[] {
  return defaultScriptLabels(kind).map((label) => ({
    key: newKey(),
    id: null,
    label,
    body: "",
  }))
}

export function toDraft(script: { id: string; label: string; body: string }[]): DraftLine[] {
  return script.map((line) => ({ key: line.id, id: line.id, label: line.label, body: line.body }))
}

/**
 * The script builder, shared by the create and edit dialogs.
 *
 * Lines live in React state and are posted as flat parallel arrays
 * (lineId / lineLabel / lineBody), which is what lets one be added, renamed,
 * reordered or dropped without a save in between. Existing ids ride along so a
 * reworded line keeps its identity — and its place — across a save.
 *
 * Labels are free text and may repeat: a reel script alternates "Voice over"
 * and the presenter's own name a dozen times, and numbering hooks "Verbal Hook
 * 1/2/3" is just as normal. Nothing here treats a label as a key.
 */
export function ScriptEditor({
  idPrefix,
  kind,
  initialLines,
  reseedOnKindChange = false,
}: {
  /** Namespaces the aria labels, so two dialogs on a page stay distinguishable. */
  idPrefix: string
  kind: ContentKind
  initialLines: DraftLine[]
  /** Create mode: follow the type dropdown while the script is still blank. */
  reseedOnKindChange?: boolean
}) {
  const [lines, setLines] = React.useState<DraftLine[]>(initialLines)
  const [lastKind, setLastKind] = React.useState(kind)

  if (reseedOnKindChange && kind !== lastKind) {
    setLastKind(kind)
    // Only while nothing has been written. Changing your mind about the type
    // before you start is normal; losing a finished script to it is not.
    if (lines.every((line) => !line.body.trim())) setLines(seedDraft(kind))
  }

  const addLine = () =>
    setLines((current) =>
      current.length >= MAX_SCRIPT_LINES
        ? current
        : [...current, { key: newKey(), id: null, label: "", body: "" }],
    )

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const removeLine = (key: string) =>
    setLines((current) => current.filter((line) => line.key !== key))

  const moveLine = (index: number, delta: number) =>
    setLines((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  /** Adds whichever standard labels for this kind are not already there. */
  const addMissingDefaults = () => {
    const present = new Set(lines.map((line) => line.label.trim().toLowerCase()))
    const missing = defaultScriptLabels(kind).filter((label) => !present.has(label.toLowerCase()))
    if (missing.length === 0) {
      toast.info("Every standard line is already on this script.")
      return
    }
    setLines((current) => [
      ...current,
      ...missing.map((label) => ({ key: newKey(), id: null, label, body: "" })),
    ])
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Script</h3>
          <p className="text-muted-foreground text-xs">
            One labelled line each — shoot direction, hooks, voice over, CTA. Rename a label to
            anything that fits, and repeat one as often as you like. Links are made tappable for the
            client automatically.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addMissingDefaults}>
          Add standard lines
        </Button>
      </div>

      <div className="space-y-3 p-4">
        {lines.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">
            No script lines yet — add the first one below.
          </p>
        ) : null}

        {lines.map((line, index) => (
          <div key={line.key} className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
            <input type="hidden" name="lineId" value={line.id ?? ""} />
            <Input
              name="lineLabel"
              value={line.label}
              onChange={(event) => updateLine(line.key, { label: event.target.value })}
              placeholder="Label"
              aria-label={`${idPrefix} line ${index + 1} label`}
              maxLength={120}
              className="font-medium"
            />
            <Textarea
              name="lineBody"
              value={line.body}
              onChange={(event) => updateLine(line.key, { body: event.target.value })}
              placeholder="What goes here…"
              aria-label={`${idPrefix} line ${index + 1} body`}
              className="min-h-10 resize-y sm:min-h-9.5"
              rows={1}
            />
            <div className="flex items-start gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === 0}
                onClick={() => moveLine(index, -1)}
                aria-label={`Move line ${index + 1} up`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === lines.length - 1}
                onClick={() => moveLine(index, 1)}
                aria-label={`Move line ${index + 1} down`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-8"
                onClick={() => removeLine(line.key)}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lines.length >= MAX_SCRIPT_LINES}
          onClick={addLine}
        >
          <Plus /> Add line
        </Button>
      </div>
    </div>
  )
}