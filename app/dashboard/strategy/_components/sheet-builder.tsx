"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react"

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
  MAX_COLUMNS,
  MAX_ROWS_PER_SECTION,
  MAX_SECTIONS,
  SECTION_KINDS,
  SECTION_KIND_HINTS,
  SECTION_KIND_LABELS,
  type SectionKind,
  type SheetSection,
} from "@/lib/strategy"
import { saveSheetStructure } from "../actions"

type Row<T> = T & { key: number }
type BuilderColumn = { id: string | null; label: string }
type BuilderRow = { id: string | null; label: string; cells: string[] }
type SectionRow = Row<{
  id: string | null
  title: string
  kind: SectionKind
  intro: string
  columns: Row<BuilderColumn>[]
  rows: Row<BuilderRow>[]
}>

/**
 * The strategy sheet editor. Sections, columns and rows are held in React state
 * because reordering has to move real rows, which uncontrolled inputs can't
 * express.
 *
 * On submit every field is written out as a hidden or visible input in render
 * order, so the server reads them with `FormData.getAll` as parallel arrays and
 * regroups them using each section's column and row counts. Existing rows keep
 * their database id, which is what lets a value be edited in place rather than
 * the row being dropped and recreated.
 */
export function SheetBuilder({
  sheetId,
  title: initialTitle,
  description: initialDescription,
  sections: initialSections,
  onSaved,
}: {
  sheetId: string
  title: string
  description: string | null
  sections: SheetSection[]
  onSaved?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const [title, setTitle] = React.useState(initialTitle)
  const [description, setDescription] = React.useState(initialDescription ?? "")

  // Rows carry a stable key that is never the array index: reordering and
  // deleting both move rows, and an index key makes React reuse the wrong DOM
  // node, stranding the text you just typed in a different field.
  //
  // The initial keys come from a local counter rather than the ref below —
  // touching a ref during render is exactly the bug that rule guards against.
  const [sections, setSections] = React.useState<SectionRow[]>(() => {
    let key = 0
    return initialSections.map((section) => ({
      ...section,
      key: key++,
      intro: section.intro ?? "",
      columns: section.columns.map((column) => ({ ...column, key: key++ })),
      rows: section.rows.map((row) => ({ ...row, key: key++ })),
    }))
  })

  // Seeded past every initial key so rows added later never collide. Only ever
  // read or written from event handlers, never during render.
  const nextKey = React.useRef(
    initialSections.reduce(
      (sum, section) => sum + section.columns.length + section.rows.length + 1,
      0,
    ),
  )
  const makeKey = () => nextKey.current++

  const patchSection = (key: number, patch: Partial<SectionRow>) =>
    setSections((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  /** Moves an item within an array by ±1. Out-of-range moves are no-ops. */
  const move = <T,>(items: T[], index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return items
    const copy = [...items]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    return copy
  }

  /** A blank row sized to whatever the section currently needs. */
  const blankRow = (section: SectionRow): Row<BuilderRow> => ({
    key: makeKey(),
    id: null,
    label: "",
    cells: Array.from({ length: section.kind === "TABLE" ? section.columns.length : 1 }, () => ""),
  })

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
              kind: "FIELDS" as SectionKind,
              intro: "",
              columns: [],
              rows: [{ key: makeKey(), id: null, label: "", cells: [""] }],
            },
          ],
    )

  const removeSection = (section: SectionRow) => {
    const filled = section.rows.filter(
      (row) => row.label.trim() || row.cells.some((cell) => cell.trim()),
    ).length
    if (
      filled > 0 &&
      !window.confirm(
        `"${section.title}" has ${filled} filled ${filled === 1 ? "row" : "rows"}. Deleting the section deletes them. Continue?`,
      )
    ) {
      return
    }
    setSections((current) => current.filter((s) => s.key !== section.key))
  }

  /**
   * Switching kind resizes every row to match, so the cells the form posts
   * always line up with what the server expects for that kind. A table with no
   * columns yet gets a starter pair — an empty grid has nothing to type into.
   *
   * Switching AWAY from a table drops the columns rather than parking them:
   * only TABLE renders column inputs, so keeping them would post a column count
   * with no matching labels and slide every later section's fields out of step.
   */
  const changeKind = (section: SectionRow, kind: SectionKind) => {
    const columns =
      kind !== "TABLE"
        ? []
        : section.columns.length > 0
          ? section.columns
          : [
              { key: makeKey(), id: null, label: "Column 1" },
              { key: makeKey(), id: null, label: "Column 2" },
            ]
    const width = kind === "TABLE" ? columns.length : 1

    patchSection(section.key, {
      kind,
      columns,
      rows: section.rows.map((row) => ({
        ...row,
        cells: Array.from({ length: width }, (_, index) => row.cells[index] ?? ""),
      })),
    })
  }

  const addColumn = (section: SectionRow) => {
    if (section.columns.length >= MAX_COLUMNS) return
    patchSection(section.key, {
      columns: [
        ...section.columns,
        { key: makeKey(), id: null, label: `Column ${section.columns.length + 1}` },
      ],
      // Every row grows with the table, so cells stay positional against columns.
      rows: section.rows.map((row) => ({ ...row, cells: [...row.cells, ""] })),
    })
  }

  const removeColumn = (section: SectionRow, columnIndex: number) => {
    patchSection(section.key, {
      columns: section.columns.filter((_, index) => index !== columnIndex),
      rows: section.rows.map((row) => ({
        ...row,
        cells: row.cells.filter((_, index) => index !== columnIndex),
      })),
    })
  }

  const moveColumn = (section: SectionRow, columnIndex: number, delta: number) => {
    const target = columnIndex + delta
    if (target < 0 || target >= section.columns.length) return
    patchSection(section.key, {
      columns: move(section.columns, columnIndex, delta),
      // Cells move with their column or the grid silently transposes.
      rows: section.rows.map((row) => ({ ...row, cells: move(row.cells, columnIndex, delta) })),
    })
  }

  const patchRow = (sectionKey: number, rowKey: number, patch: Partial<Row<BuilderRow>>) =>
    setSections((current) =>
      current.map((section) =>
        section.key !== sectionKey
          ? section
          : {
              ...section,
              rows: section.rows.map((row) => (row.key === rowKey ? { ...row, ...patch } : row)),
            },
      ),
    )

  const setCell = (sectionKey: number, rowKey: number, cellIndex: number, value: string) =>
    setSections((current) =>
      current.map((section) =>
        section.key !== sectionKey
          ? section
          : {
              ...section,
              rows: section.rows.map((row) =>
                row.key !== rowKey
                  ? row
                  : { ...row, cells: row.cells.map((cell, i) => (i === cellIndex ? value : cell)) },
              ),
            },
      ),
    )

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveSheetStructure(formData)
      if (result.ok) {
        toast.success("Strategy sheet saved.")
        onSaved?.()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0)

  return (
    <form action={onSubmit}>
      <input type="hidden" name="sheetId" value={sheetId} />

      <div className="grid gap-4 rounded-lg border p-5">
        <div className="grid gap-2">
          <Label htmlFor="sheet-title">Sheet title</Label>
          <Input
            id="sheet-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sheet-description">
            Intro for the client <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="sheet-description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A line or two on what this sheet covers and what you need from them."
            className="min-h-20 resize-y"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {sections.map((section, sectionIndex) => (
          <fieldset key={section.key} className="rounded-lg border p-4 sm:p-5">
            {/* Section identity travels with its column and row counts — those
                counts are how the server regroups the flat arrays. */}
            <input type="hidden" name="sectionId" value={section.id ?? ""} />
            <input type="hidden" name="sectionKind" value={section.kind} />
            {/* The count of columns actually rendered below, not of columns
                held in state — only TABLE renders them, and the server counts
                inputs. */}
            <input
              type="hidden"
              name="sectionColumnCount"
              value={section.kind === "TABLE" ? section.columns.length : 0}
            />
            <input type="hidden" name="sectionRowCount" value={section.rows.length} />

            <div className="flex flex-wrap items-center gap-2">
              <GripVertical className="text-muted-foreground/50 size-4 shrink-0" />
              <Input
                name="sectionTitle"
                value={section.title}
                onChange={(event) => patchSection(section.key, { title: event.target.value })}
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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select
                value={section.kind}
                disabled={pending}
                onValueChange={(value) => changeKind(section, value as SectionKind)}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {SECTION_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-xs">
                {SECTION_KIND_HINTS[section.kind]}
              </span>
            </div>

            <Textarea
              name="sectionIntro"
              value={section.intro}
              disabled={pending}
              onChange={(event) => patchSection(section.key, { intro: event.target.value })}
              placeholder="Optional lead-in paragraph shown above this section"
              aria-label={`Section ${sectionIndex + 1} intro`}
              className="mt-3 min-h-14 resize-y text-sm"
            />

            {section.kind === "TABLE" ? (
              <ColumnEditor
                section={section}
                disabled={pending}
                onLabel={(index, label) =>
                  patchSection(section.key, {
                    columns: section.columns.map((column, i) =>
                      i === index ? { ...column, label } : column,
                    ),
                  })
                }
                onMove={(index, delta) => moveColumn(section, index, delta)}
                onRemove={(index) => removeColumn(section, index)}
                onAdd={() => addColumn(section)}
              />
            ) : null}

            <div className="mt-4 space-y-2">
              {section.rows.map((row, rowIndex) => (
                <RowEditor
                  key={row.key}
                  row={row}
                  section={section}
                  index={rowIndex}
                  disabled={pending}
                  isFirst={rowIndex === 0}
                  isLast={rowIndex === section.rows.length - 1}
                  onLabel={(label) => patchRow(section.key, row.key, { label })}
                  onCell={(cellIndex, value) => setCell(section.key, row.key, cellIndex, value)}
                  onMove={(delta) =>
                    patchSection(section.key, { rows: move(section.rows, rowIndex, delta) })
                  }
                  onRemove={() =>
                    patchSection(section.key, {
                      rows: section.rows.filter((r) => r.key !== row.key),
                    })
                  }
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={pending || section.rows.length >= MAX_ROWS_PER_SECTION}
              onClick={() =>
                patchSection(section.key, { rows: [...section.rows, blankRow(section)] })
              }
            >
              <Plus /> Add {section.kind === "NOTES" ? "bullet" : section.kind === "TABLE" ? "row" : "field"}
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

      <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-4 z-20 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-lg backdrop-blur">
        <p className="text-muted-foreground text-sm">
          {sections.length} {sections.length === 1 ? "section" : "sections"} · {totalRows}{" "}
          {totalRows === 1 ? "row" : "rows"}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save sheet"}
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
  className,
}: {
  onUp: () => void
  onDown: () => void
  upDisabled: boolean
  downDisabled: boolean
  disabled: boolean
  label: string
  className?: string
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
        className={cn("text-muted-foreground size-8", className)}
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
        className={cn("text-muted-foreground size-8", className)}
      >
        <ChevronDown />
      </Button>
    </>
  )
}

function ColumnEditor({
  section,
  disabled,
  onLabel,
  onMove,
  onRemove,
  onAdd,
}: {
  section: SectionRow
  disabled: boolean
  onLabel: (index: number, label: string) => void
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div className="bg-muted/30 mt-3 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs font-medium">Columns</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {section.columns.map((column, index) => (
          <div
            key={column.key}
            className="bg-background flex items-center gap-0.5 rounded-md border py-0.5 pr-0.5 pl-1"
          >
            <input type="hidden" name="columnId" value={column.id ?? ""} />
            <Input
              name="columnLabel"
              value={column.label}
              disabled={disabled}
              onChange={(event) => onLabel(index, event.target.value)}
              aria-label={`Column ${index + 1} heading`}
              className="h-7 w-32 border-0 px-1 text-xs shadow-none focus-visible:ring-0"
              required
            />
            <MoveButtons
              disabled={disabled}
              onUp={() => onMove(index, -1)}
              onDown={() => onMove(index, 1)}
              upDisabled={index === 0}
              downDisabled={index === section.columns.length - 1}
              label={`column ${index + 1}`}
              className="size-6"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || section.columns.length <= 1}
              onClick={() => onRemove(index)}
              aria-label={`Delete column ${index + 1}`}
              className="text-muted-foreground hover:text-destructive size-6"
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-7 text-xs"
        disabled={disabled || section.columns.length >= MAX_COLUMNS}
        onClick={onAdd}
      >
        <Plus /> Add column
      </Button>
    </div>
  )
}

function RowEditor({
  row,
  section,
  index,
  disabled,
  isFirst,
  isLast,
  onLabel,
  onCell,
  onMove,
  onRemove,
}: {
  row: Row<BuilderRow>
  section: SectionRow
  index: number
  disabled: boolean
  isFirst: boolean
  isLast: boolean
  onLabel: (label: string) => void
  onCell: (cellIndex: number, value: string) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const controls = (
    <div className="flex shrink-0 items-start">
      <MoveButtons
        disabled={disabled}
        onUp={() => onMove(-1)}
        onDown={() => onMove(1)}
        upDisabled={isFirst}
        downDisabled={isLast}
        label={`row ${index + 1}`}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Delete row ${index + 1}`}
        className="text-muted-foreground hover:text-destructive size-8"
      >
        <Trash2 />
      </Button>
    </div>
  )

  return (
    <div className="bg-muted/30 rounded-lg border p-2.5">
      {/* rowId and rowLabel are written for every kind, in the same order, so
          the parallel arrays never fall out of step even though only FIELDS
          shows a label input. */}
      <input type="hidden" name="rowId" value={row.id ?? ""} />
      {section.kind === "FIELDS" ? null : <input type="hidden" name="rowLabel" value="" />}

      {section.kind === "FIELDS" ? (
        <div className="flex items-start gap-2">
          <Input
            name="rowLabel"
            value={row.label}
            disabled={disabled}
            onChange={(event) => onLabel(event.target.value)}
            placeholder="Field name"
            aria-label={`Field ${index + 1} name`}
            className="bg-background h-9 w-40 shrink-0 text-sm"
          />
          <Textarea
            name="cellValue"
            value={row.cells[0] ?? ""}
            disabled={disabled}
            onChange={(event) => onCell(0, event.target.value)}
            placeholder="Value"
            aria-label={`Field ${index + 1} value`}
            className="bg-background min-h-16 min-w-0 flex-1 resize-y text-sm"
          />
          {controls}
        </div>
      ) : section.kind === "TABLE" ? (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground mt-2.5 w-5 shrink-0 text-right text-xs tabular-nums">
            {index + 1}
          </span>
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {section.columns.map((column, cellIndex) => (
              <label key={column.key} className="min-w-0">
                <span className="text-muted-foreground text-[11px]">
                  {column.label || `Column ${cellIndex + 1}`}
                </span>
                <Textarea
                  name="cellValue"
                  value={row.cells[cellIndex] ?? ""}
                  disabled={disabled}
                  onChange={(event) => onCell(cellIndex, event.target.value)}
                  className="bg-background mt-0.5 min-h-14 resize-y text-sm"
                />
              </label>
            ))}
          </div>
          {controls}
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <span aria-hidden className="bg-primary/40 mt-4 size-1.5 shrink-0 rounded-full" />
          <Textarea
            name="cellValue"
            value={row.cells[0] ?? ""}
            disabled={disabled}
            onChange={(event) => onCell(0, event.target.value)}
            placeholder="Bullet point"
            aria-label={`Bullet ${index + 1}`}
            className="bg-background min-h-14 min-w-0 flex-1 resize-y text-sm"
          />
          {controls}
        </div>
      )}
    </div>
  )
}
