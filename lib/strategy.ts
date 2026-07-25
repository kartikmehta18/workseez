import { can, type Actor } from "@/lib/rbac"

/**
 * Strategy sheets — constants, types and pure helpers.
 *
 * Like lib/onboarding.ts this module must stay free of `prisma`: client
 * components import the constants below, and a database import here would pull
 * the MariaDB driver into the browser bundle. Reads live in
 * lib/strategy-queries.ts.
 *
 * The strategy sheet is the mirror of the onboarding form. Onboarding is the
 * client writing for the team; the strategy sheet is the team writing for the
 * client, who reads it and leaves feedback.
 *
 * Each client gets their own sheet, seeded from DEFAULT_SECTIONS and then fully
 * restructurable — sections, columns and rows are all editable at any time, so
 * reshaping one client's strategy never touches another's.
 *
 * Lifecycle: DRAFT (team is still writing, client sees nothing)
 *         -> PUBLISHED (client can read it and leave feedback)
 *         -> APPROVED (client signed off; the team can still edit, and either
 *            side can reopen it back to PUBLISHED).
 */
export const SHEET_STATUSES = ["DRAFT", "PUBLISHED", "APPROVED"] as const
export type SheetStatus = (typeof SHEET_STATUSES)[number]

export const SHEET_STATUS_LABELS: Record<SheetStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Ready for review",
  APPROVED: "Approved",
}

/**
 * How a section renders and what the builder offers for it:
 *   FIELDS — label/value rows, the two-column tables in sections 01 and 02
 *   TABLE  — custom columns with positional cells, the Content Pillars grid
 *   NOTES  — a bullet list, the "Key patterns" block
 */
export const SECTION_KINDS = ["FIELDS", "TABLE", "NOTES"] as const
export type SectionKind = (typeof SECTION_KINDS)[number]

export const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  FIELDS: "Field list",
  TABLE: "Table",
  NOTES: "Bullet notes",
}

export const SECTION_KIND_HINTS: Record<SectionKind, string> = {
  FIELDS: "Two columns — a field name and its value.",
  TABLE: "Your own columns, one row per entry.",
  NOTES: "A simple list of bullet points.",
}

export const MAX_SECTIONS = 30
export const MAX_ROWS_PER_SECTION = 60
export const MAX_COLUMNS = 8
export const MAX_COMMENT_LENGTH = 4000

export function isSheetStatus(value: string): value is SheetStatus {
  return (SHEET_STATUSES as readonly string[]).includes(value)
}

export function isSectionKind(value: string): value is SectionKind {
  return (SECTION_KINDS as readonly string[]).includes(value)
}

/** Row cells are stored as a JSON string; never let a bad row throw. */
export function parseCells(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((cell) => String(cell ?? "")) : []
  } catch {
    return []
  }
}

/**
 * Pads or trims a row's cells to the section's column count, so the renderer
 * and the builder can both index columns without guarding every access. A row
 * saved before a column was added is simply short, and gets blanks here.
 */
export function alignCells(cells: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? "")
}

type SeedSection = {
  title: string
  kind: SectionKind
  intro?: string
  columns?: string[]
  /** FIELDS: [label, value]. TABLE: positional cells. NOTES: [bullet]. */
  rows: { label?: string; cells: string[] }[]
}

/**
 * The starting document, transcribed from the agency's existing strategy sheet.
 * Copied into a sheet at creation time — editing this constant does not change
 * sheets that already exist.
 *
 * Values are left blank on purpose: this is the skeleton a strategist fills in
 * per client, so seeding one client's answers would be actively misleading.
 * The competitor blocks are seeded as one table plus a notes section rather
 * than a repeated block per competitor, because sections are freely addable —
 * a strategist covering five competitors just adds rows.
 */
export const DEFAULT_SECTIONS: SeedSection[] = [
  {
    title: "01 · Client Strategy Overview",
    kind: "FIELDS",
    rows: [
      { label: "Name", cells: [""] },
      { label: "Niche / Industry", cells: [""] },
      { label: "Instagram Goal", cells: [""] },
      { label: "Primary Offer", cells: [""] },
      { label: "Target Audience Snapshot", cells: [""] },
      { label: "Positioning Statement", cells: [""] },
      { label: "Niche Related Keywords", cells: [""] },
      { label: "Brand Tone", cells: [""] },
      { label: "Language", cells: [""] },
      { label: "Posting Frequency", cells: [""] },
      { label: "Success Metrics", cells: [""] },
    ],
  },
  {
    title: "02 · Target Audience",
    kind: "FIELDS",
    rows: [
      { label: "Audience Persona Name", cells: [""] },
      { label: "Age Range", cells: [""] },
      { label: "Biggest Pain Points", cells: [""] },
      { label: "Top Objections", cells: [""] },
      { label: "What Makes Them Stop Scrolling", cells: [""] },
      { label: "Core Desires", cells: [""] },
    ],
  },
  {
    title: "03 · Content Pillars",
    kind: "TABLE",
    columns: ["#", "Content Pillar", "What it is", "Examples", "Client's view"],
    rows: [
      { cells: ["1", "", "", "", ""] },
      { cells: ["2", "", "", "", ""] },
      { cells: ["3", "", "", "", ""] },
      { cells: ["4", "", "", "", ""] },
      { cells: ["5", "", "", "", ""] },
    ],
  },
  {
    title: "04 · Competitors",
    kind: "TABLE",
    intro: "Who else the audience already follows, and what is working for them.",
    columns: ["Competitor Handle / Name", "Top Performing Content", "Hook Used"],
    rows: [
      { cells: ["", "", ""] },
      { cells: ["", "", ""] },
      { cells: ["", "", ""] },
    ],
  },
  {
    title: "Key patterns & the gap to fill",
    kind: "NOTES",
    intro: "What the competitor set has in common, and where this client can be different.",
    rows: [{ cells: [""] }, { cells: [""] }, { cells: [""] }],
  },
]

/** Nested create payload for a brand-new sheet, seeded from DEFAULT_SECTIONS. */
export function seedSections() {
  return DEFAULT_SECTIONS.map((section, sectionIndex) => ({
    title: section.title,
    kind: section.kind,
    intro: section.intro ?? null,
    sortOrder: sectionIndex,
    columns: {
      create: (section.columns ?? []).map((label, columnIndex) => ({
        label,
        sortOrder: columnIndex,
      })),
    },
    rows: {
      create: section.rows.map((row, rowIndex) => ({
        label: row.label ?? null,
        cells: JSON.stringify(row.cells),
        sortOrder: rowIndex,
      })),
    },
  }))
}

type LoadedSections = {
  sections: {
    id: string
    title: string
    kind: string
    intro: string | null
    columns: { id: string; label: string }[]
    rows: { id: string; label: string | null; cells: string }[]
  }[]
}

/**
 * Reshapes a loaded sheet into the plain props both the viewer and the builder
 * take — cells parsed out of JSON and aligned to the column count.
 */
export function toSheetSections(sheet: LoadedSections) {
  return sheet.sections.map((section) => {
    const kind: SectionKind = isSectionKind(section.kind) ? section.kind : "FIELDS"
    // FIELDS and NOTES rows carry exactly one cell whatever the column table
    // says, so alignment is against a fixed 1 for them.
    const width = kind === "TABLE" ? section.columns.length : 1

    return {
      id: section.id,
      title: section.title,
      kind,
      intro: section.intro,
      columns: section.columns.map(({ id, label }) => ({ id, label })),
      rows: section.rows.map((row) => ({
        id: row.id,
        label: row.label ?? "",
        cells: alignCells(parseCells(row.cells), width),
      })),
    }
  })
}

export type SheetSection = ReturnType<typeof toSheetSections>[number]

type CountableSections = {
  sections: { kind: string; columns: unknown[]; rows: { label: string | null; cells: string }[] }[]
}

/**
 * Filled / total counts used by every progress indicator in the feature.
 *
 * A row counts as filled when it has content in a cell — a FIELDS row with a
 * label but no value is exactly the unfinished state this is meant to surface,
 * so the label alone is not enough.
 */
export function sheetProgress(sheet: CountableSections) {
  const rows = sheet.sections.flatMap((section) => section.rows)
  const filled = rows.filter((row) =>
    parseCells(row.cells).some((cell) => cell.trim().length > 0),
  )
  return {
    total: rows.length,
    filled: filled.length,
    percent: rows.length === 0 ? 0 : Math.round((filled.length / rows.length) * 100),
  }
}

/** Whether this actor is the client the sheet belongs to. */
export function isSheetOwner(actor: Actor, sheet: { client: { ownerUserId: string | null } }) {
  return sheet.client.ownerUserId === actor.id
}

/**
 * Who may read the sheet right now. The team reads it at any point; the client
 * only once it leaves draft — an unpublished sheet is working material.
 */
export function canViewSheet(actor: Actor, sheet: { status: string }, isOwner: boolean) {
  if (can(actor, "strategy:manage")) return true
  return isOwner && sheet.status !== "DRAFT"
}

/**
 * Who may post to the feedback thread. Both sides talk here, but the client
 * cannot comment on a sheet they are not yet meant to see.
 */
export function canComment(actor: Actor, sheet: { status: string }, isOwner: boolean) {
  if (can(actor, "strategy:manage")) return true
  return isOwner && sheet.status !== "DRAFT"
}

type LoadedComment = {
  id: string
  body: string
  createdAt: Date
  authorId: string | null
  authorRole: string | null
  author: { name: string | null; email: string; avatarUrl: string | null } | null
}

export type ThreadComment = {
  id: string
  body: string
  createdAt: string
  authorId: string | null
  authorRole: string | null
  authorName: string | null
  authorAvatar: string | null
  canDelete: boolean
}

/**
 * Flattens loaded comments into the plain props FeedbackThread takes.
 *
 * Delete rights are resolved here, on the server, so the browser is never the
 * one deciding — the action re-checks anyway, but a button that appears and
 * then fails is worse than no button.
 */
export function toThreadComments(comments: LoadedComment[], actor: Actor): ThreadComment[] {
  const canModerate = can(actor, "strategy:delete")
  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    authorId: comment.authorId,
    authorRole: comment.authorRole,
    authorName: comment.author?.name ?? comment.author?.email ?? null,
    authorAvatar: comment.author?.avatarUrl ?? null,
    canDelete: comment.authorId === actor.id || canModerate,
  }))
}

/** Formats a date for a `<input type="date">`, which takes nothing else. */
export function toDateInputValue(date: Date | null) {
  if (!date) return null
  // Local parts, not toISOString — UTC conversion shifts the date by a day for
  // anyone east or west of Greenwich at the wrong hour.
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
