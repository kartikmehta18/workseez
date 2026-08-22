"use client"

import * as React from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CONTENT_KIND_LABELS,
  contentBlockTitle,
  defaultScriptLabels,
  isVideoKind,
  MAX_SCRIPT_LINES,
  type ContentKind,
} from "@/lib/content"

/**
 * What gets written on a post — which is two different things depending on the
 * type, so this component has two faces.
 *
 * A reel is scripted: shoot direction, hooks, a voice over, a CTA, and whatever
 * else the strategist wants a label for. A carousel is designed: it has a
 * headline and a body of copy, and nothing about "shoot direction" applies.
 *
 * Both faces write the same rows underneath. Lines are posted as flat parallel
 * arrays (lineId / lineLabel / lineBody), which is what lets one be added,
 * renamed, reordered or dropped without a save in between, and existing ids ride
 * along so a reworded line keeps its identity — and its place — across a save.
 */

export type DraftLine = {
  key: string
  id: string | null
  label: string
  body: string
  /**
   * Added by the static face because the post had no Title or Content row yet,
   * rather than by a person. Dropped again on the way back to a script if it is
   * still empty, so flicking through the type dropdown leaves no residue.
   */
  auto?: boolean
}

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

/* ------------------------------------------------------------------ *
 * Static rows
 *
 * The designed face shows exactly two rows and posts exactly two rows. It finds
 * them in the draft by label rather than by position, so a post written before
 * this split — back when a static post got Concept / Ref / Headline / Copy /
 * Cta / GUIDE — opens with its headline and its copy already in place.
 * ------------------------------------------------------------------ */

const TITLE_ALIASES = ["title", "headline"]
const CONTENT_ALIASES = ["content", "copy"]

function findByLabel(lines: DraftLine[], aliases: string[]) {
  return lines.find((line) => aliases.includes(line.label.trim().toLowerCase())) ?? null
}

/**
 * The draft with a Title and a Content row guaranteed to exist. Additive only:
 * whatever else is on the draft stays in state untouched, because a type picked
 * by mistake must not cost someone the script they had already written.
 */
function withStaticRows(lines: DraftLine[]): DraftLine[] {
  const missing = [
    findByLabel(lines, TITLE_ALIASES) ? null : "Title",
    findByLabel(lines, CONTENT_ALIASES) ? null : "Content",
  ].filter((label): label is string => label !== null)

  if (missing.length === 0) return lines
  return [
    ...lines,
    ...missing.map((label) => ({ key: newKey(), id: null, label, body: "", auto: true })),
  ]
}

/** Clears away auto-added rows nobody typed into. */
function withoutEmptyAutoRows(lines: DraftLine[]) {
  return lines.filter((line) => !line.auto || line.body.trim().length > 0)
}

export function PostContentEditor({
  idPrefix,
  kind,
  initialLines,
  originalKind,
  reseedOnKindChange = false,
}: {
  /** Namespaces the aria labels, so two dialogs on a page stay distinguishable. */
  idPrefix: string
  kind: ContentKind
  initialLines: DraftLine[]
  /**
   * The kind this post is *stored* as. Only the edit dialog passes it, and only
   * to warn that a saved script is about to be left behind.
   */
  originalKind?: ContentKind
  /** Create mode: follow the type dropdown while the script is still blank. */
  reseedOnKindChange?: boolean
}) {
  // Seeded through withStaticRows when the post opens on a designed type, so the
  // two rows that face renders are always in state and always keyed the same as
  // what it draws — an update that had to invent them would lose the keystroke
  // that triggered it.
  const [lines, setLines] = React.useState<DraftLine[]>(() =>
    isVideoKind(kind) ? initialLines : withStaticRows(initialLines),
  )
  const [lastKind, setLastKind] = React.useState(kind)

  const isVideo = isVideoKind(kind)

  /**
   * The draft this render draws from.
   *
   * React re-renders when state is adjusted during render, but only after the
   * current pass has finished running — so the rest of this function has to
   * read the adjusted list directly rather than the state it will hold in a
   * moment. The designed face would otherwise look for rows that had been
   * created but not yet committed, and find nothing.
   */
  let draft = lines

  if (kind !== lastKind) {
    const wasVideo = isVideoKind(lastKind)
    setLastKind(kind)

    if (!isVideo) {
      // Crossing to the designed face. Nothing is removed — the two rows it
      // shows are the only ones posted, so an unsaved script survives in state
      // and comes straight back if the type is switched again.
      draft = withStaticRows(lines)
    } else if (reseedOnKindChange && lines.every((line) => !line.body.trim())) {
      // Only while nothing has been written. Changing your mind about the type
      // before you start is normal; losing a finished script to it is not.
      draft = seedDraft(kind)
    } else if (!wasVideo) {
      draft = withoutEmptyAutoRows(lines)
    }

    if (draft !== lines) setLines(draft)
  }

  /* ---------------------------------------------------------------- *
   * Script face
   * ---------------------------------------------------------------- */

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
    const present = new Set(draft.map((line) => line.label.trim().toLowerCase()))
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

  const title = contentBlockTitle(kind)

  if (!isVideo) {
    // Non-null by construction: every path that leaves `kind` on a designed
    // type — the initial state above and the kind-change branch — runs the
    // draft through withStaticRows first.
    const titleRow = findByLabel(draft, TITLE_ALIASES)!
    const contentRow = findByLabel(draft, CONTENT_ALIASES)!

    /** Writes one of the two rows, matched on the key this render drew. */
    const writeRow = (key: string, body: string) =>
      setLines((current) =>
        current.map((line) => (line.key === key ? { ...line, body, auto: undefined } : line)),
      )

    /**
     * Warn only when there is something to lose: a post stored as a reel, with
     * script lines this face is not showing and will not post.
     */
    const leavingScript =
      originalKind !== undefined &&
      isVideoKind(originalKind) &&
      draft.some(
        (line) => line !== titleRow && line !== contentRow && line.body.trim().length > 0,
      )

    return (
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-muted-foreground text-xs">
            The headline and the copy that goes out with it. Links are made tappable for the client
            automatically.
          </p>
        </div>

        <div className="space-y-4 p-4">
          {/* Both fields post the trio the server reads — the label is fixed
              here rather than typed, which is the whole difference between this
              face and the script. Carrying lineId keeps the row's identity, so
              editing a carousel updates its two lines instead of churning them. */}
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-content-title`}>Title</Label>
            <input type="hidden" name="lineId" value={titleRow.id ?? ""} />
            <input type="hidden" name="lineLabel" value="Title" />
            <Input
              id={`${idPrefix}-content-title`}
              name="lineBody"
              value={titleRow.body}
              onChange={(event) => writeRow(titleRow.key, event.target.value)}
              placeholder="The headline for this one."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-content-body`}>Content</Label>
            <input type="hidden" name="lineId" value={contentRow.id ?? ""} />
            <input type="hidden" name="lineLabel" value="Content" />
            <Textarea
              id={`${idPrefix}-content-body`}
              name="lineBody"
              value={contentRow.body}
              onChange={(event) => writeRow(contentRow.key, event.target.value)}
              placeholder="The copy — one slide per line for a carousel, or the post itself."
              className="min-h-32 resize-y"
            />
          </div>

          {leavingScript ? (
            <p className="text-muted-foreground text-xs">
              This is saved as a {CONTENT_KIND_LABELS[originalKind!]}. Its other script lines are
              removed when you save it as a {CONTENT_KIND_LABELS[kind]} — cancel to keep them.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
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
        {draft.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">
            No script lines yet — add the first one below.
          </p>
        ) : null}

        {draft.map((line, index) => (
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
                disabled={index === draft.length - 1}
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
          disabled={draft.length >= MAX_SCRIPT_LINES}
          onClick={addLine}
        >
          <Plus /> Add line
        </Button>
      </div>
    </div>
  )
}
