import { can, type Actor } from "@/lib/rbac"

/**
 * Content calendar — constants, types and pure helpers.
 *
 * Like lib/onboarding.ts and lib/strategy.ts this module must stay free of
 * `prisma`: client components import the constants below, and a database import
 * here would pull the MariaDB driver into the browser bundle. Reads live in
 * lib/content-queries.ts.
 *
 * The calendar is the third document in the client workspace. Onboarding is the
 * client writing for the team, the strategy sheet is the team writing for the
 * client, and this is the two of them working — the team writes each post and
 * publishes it, the client reads the script, uploads footage and says what needs
 * changing.
 *
 * A post is invisible to the client until `sharedAt` is set. `status` is a
 * separate axis: it says where the work is, not who can see it.
 */

export const CONTENT_KINDS = ["REEL", "POST", "CAROUSEL", "STORY", "YOUTUBE"] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  REEL: "Reel",
  POST: "Post",
  CAROUSEL: "Carousel",
  STORY: "Story",
  YOUTUBE: "YouTube",
}

/** Plural form, for counts like "9 reels". */
export const CONTENT_KIND_PLURALS: Record<ContentKind, string> = {
  REEL: "reels",
  POST: "posts",
  CAROUSEL: "carousels",
  STORY: "stories",
  YOUTUBE: "videos",
}

/** Which kinds are shot on camera — the ones a raw-footage upload makes sense for. */
export const VIDEO_KINDS: ContentKind[] = ["REEL", "STORY", "YOUTUBE"]

/**
 * Where the post goes out. Separate from `kind`: a reel is a reel whether it
 * lands on Instagram or YouTube, and the client filters their calendar by
 * channel ("show me the LinkedIn ones") far more often than by format.
 */
export const CONTENT_PLATFORMS = ["INSTAGRAM", "LINKEDIN", "YOUTUBE", "TWITTER"] as const
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number]

export const CONTENT_PLATFORM_LABELS: Record<ContentPlatform, string> = {
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TWITTER: "X (Twitter)",
}

export const CONTENT_STATUSES = [
  "SCRIPTING",
  "SHOOT_PENDING",
  "IN_PRODUCTION",
  "SCHEDULED",
  "PUBLISHED",
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  SCRIPTING: "Scripting",
  SHOOT_PENDING: "Shoot pending",
  IN_PRODUCTION: "In production",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
}

/** One line of explanation per status, shown wherever the status is chosen. */
export const CONTENT_STATUS_HINTS: Record<ContentStatus, string> = {
  SCRIPTING: "The script is still being written.",
  SHOOT_PENDING: "Script is ready — waiting on footage.",
  IN_PRODUCTION: "Footage is in, the editor is working on it.",
  SCHEDULED: "Edit approved and queued to go out.",
  PUBLISHED: "Live on the client's account.",
}

export const ASSET_KINDS = ["RAW", "EDIT"] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const MAX_SCRIPT_LINES = 40
export const MAX_COMMENT_LENGTH = 4000
export const MAX_UPLOAD_FILES = 10
/**
 * 2 GB per file. Drive itself allows far more, but the upload goes through a
 * Next.js route handler that buffers the body, so this is the point past which
 * the server would rather the client used the Drive folder link directly.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

export const DEFAULT_CYCLE_LENGTH = 30

export function isContentKind(value: string): value is ContentKind {
  return (CONTENT_KINDS as readonly string[]).includes(value)
}

export function isContentPlatform(value: string): value is ContentPlatform {
  return (CONTENT_PLATFORMS as readonly string[]).includes(value)
}

export function isContentStatus(value: string): value is ContentStatus {
  return (CONTENT_STATUSES as readonly string[]).includes(value)
}

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value)
}

export function toContentKind(value: string | null | undefined): ContentKind {
  return value && isContentKind(value) ? value : "REEL"
}

export function toContentPlatform(value: string | null | undefined): ContentPlatform {
  return value && isContentPlatform(value) ? value : "INSTAGRAM"
}

export function toContentStatus(value: string | null | undefined): ContentStatus {
  return value && isContentStatus(value) ? value : "SCRIPTING"
}

/**
 * The starting script for a new post, by kind. Labels only — the bodies are
 * what the strategist writes, and seeding example copy would be worse than a
 * blank line because it reads as real direction until someone notices.
 *
 * Every label is editable and any number more can be added, so this is a head
 * start rather than a schema.
 */
const VIDEO_SCRIPT_LABELS = [
  "Shoot Direction",
  "Ref",
  "Text hook",
  "Verbal Hook",
  "Voice over",
  "Body",
  "Cta",
  "GUIDE",
]

const STATIC_SCRIPT_LABELS = ["Concept", "Ref", "Headline", "Copy", "Cta", "GUIDE"]

export function defaultScriptLabels(kind: ContentKind) {
  return VIDEO_KINDS.includes(kind) ? VIDEO_SCRIPT_LABELS : STATIC_SCRIPT_LABELS
}

/** Nested create payload for a new post's script skeleton. */
export function seedScriptLines(kind: ContentKind) {
  return defaultScriptLabels(kind).map((label, index) => ({
    label,
    body: "",
    sortOrder: index,
  }))
}

/* ------------------------------------------------------------------ *
 * Cycles
 * ------------------------------------------------------------------ */

export type Cycle = {
  /** 1-based, the way the client refers to them ("Cycle 4"). */
  number: number
  start: Date
  /** Inclusive — the last day of the cycle, not the first day of the next. */
  end: Date
}

/** Midnight local time, so day arithmetic never straddles a DST boundary. */
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Whole days between two dates, ignoring the time of day. */
function daysBetween(from: Date, to: Date) {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.floor(ms / 86_400_000)
}

/**
 * Which cycle a date falls in, 1-based. Dates before the anchor return 0 — the
 * caller treats that as "outside the schedule" rather than clamping, because a
 * post dated before cycle 1 is a mistake worth showing, not hiding.
 */
export function cycleNumberFor(date: Date, cycleStart: Date, cycleLength: number) {
  const offset = daysBetween(cycleStart, date)
  if (offset < 0) return 0
  return Math.floor(offset / Math.max(1, cycleLength)) + 1
}

export function cycleFor(number: number, cycleStart: Date, cycleLength: number): Cycle {
  const length = Math.max(1, cycleLength)
  const start = addDays(startOfDay(cycleStart), (number - 1) * length)
  return { number, start, end: addDays(start, length - 1) }
}

/**
 * Every cycle worth offering in the dropdown: from cycle 1 through whichever is
 * later, today's cycle or the cycle the last scheduled post lands in. Planning a
 * post three cycles ahead has to make that cycle selectable, and a client
 * catching up months later still needs to reach the current one.
 */
export function buildCycles({
  cycleStart,
  cycleLength,
  dates,
  today = new Date(),
}: {
  cycleStart: Date
  cycleLength: number
  dates: (Date | null)[]
  today?: Date
}): Cycle[] {
  const length = Math.max(1, cycleLength)
  const highest = dates.reduce(
    (max, date) => (date ? Math.max(max, cycleNumberFor(date, cycleStart, length)) : max),
    cycleNumberFor(today, cycleStart, length),
  )
  return Array.from({ length: Math.max(1, highest) }, (_, index) =>
    cycleFor(index + 1, cycleStart, length),
  )
}

export function currentCycleNumber(cycleStart: Date, cycleLength: number, today = new Date()) {
  return Math.max(1, cycleNumberFor(today, cycleStart, cycleLength))
}

/** A cycle as the browser gets it — ISO bounds to compare on, a label to show. */
export type CycleOption = {
  number: number
  startDate: string
  endDate: string
  label: string
  isCurrent: boolean
}

/**
 * The cycle dropdown's options.
 *
 * Labels are formatted here, on the server, and the bounds travel as ISO
 * strings: dates that cross to the browser as Date objects would be formatted
 * against whichever locale rendered them, and ISO strings sort and compare
 * correctly as plain text, which is what the filter relies on.
 */
export function toCycleOptions(
  calendar: { cycleStart: Date | null; cycleLength: number },
  dates: (Date | null)[],
): CycleOption[] {
  if (!calendar.cycleStart) return []

  const current = currentCycleNumber(calendar.cycleStart, calendar.cycleLength)
  return buildCycles({
    cycleStart: calendar.cycleStart,
    cycleLength: calendar.cycleLength,
    dates,
  }).map((cycle) => ({
    number: cycle.number,
    startDate: toDateInputValue(cycle.start),
    endDate: toDateInputValue(cycle.end),
    label: formatCycleRange(cycle),
    isCurrent: cycle.number === current,
  }))
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }

/** "15 Jul – 13 Aug" — the label the cycle dropdown shows. */
export function formatCycleRange(cycle: Cycle) {
  return `${cycle.start.toLocaleDateString(undefined, DAY_MONTH)} – ${cycle.end.toLocaleDateString(
    undefined,
    DAY_MONTH,
  )}`
}

export function formatDayMonth(date: Date) {
  return date.toLocaleDateString(undefined, DAY_MONTH)
}

/** Formats a date for an `<input type="date">`, which takes nothing else. */
export function toDateInputValue(date: Date | null | undefined) {
  if (!date) return ""
  // Local parts, not toISOString — UTC conversion shifts the date by a day for
  // anyone east or west of Greenwich at the wrong hour.
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Reads a `<input type="date">` value as local midnight.
 *
 * `new Date("2026-07-15")` parses as UTC midnight, which is the previous day
 * for anyone west of Greenwich — the exact bug that makes a post show up on the
 * wrong square of the calendar.
 */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) {
    const fallback = new Date(trimmed)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? null : date
}

/* ------------------------------------------------------------------ *
 * Visibility
 * ------------------------------------------------------------------ */

/** Whether this actor is the client the calendar belongs to. */
export function isCalendarOwner(actor: Actor, calendar: { client: { ownerUserId: string | null } }) {
  return calendar.client.ownerUserId === actor.id
}

/**
 * Who may read a post. The team reads everything; the client only sees posts
 * that have been published to them — an unshared post is working material.
 */
export function canViewPost(actor: Actor, post: { sharedAt: Date | null }, isOwner: boolean) {
  if (can(actor, "content:manage")) return true
  return isOwner && post.sharedAt !== null
}

/** Who may post feedback. Both sides talk here, on shared posts only. */
export function canCommentOnPost(actor: Actor, post: { sharedAt: Date | null }, isOwner: boolean) {
  if (can(actor, "content:manage")) return true
  return isOwner && post.sharedAt !== null
}

/* ------------------------------------------------------------------ *
 * View models
 * ------------------------------------------------------------------ */

type LoadedComment = {
  id: string
  body: string
  createdAt: Date
  authorId: string | null
  authorRole: string | null
  author: { name: string | null; email: string; avatarUrl: string | null } | null
}

export type PostComment = {
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
 * Flattens loaded comments into the plain props the feedback thread takes.
 * Delete rights are resolved server-side so the browser never decides — the
 * action re-checks anyway, but a button that appears and then fails is worse
 * than no button.
 */
export function toPostComments(comments: LoadedComment[], actor: Actor): PostComment[] {
  const canModerate = can(actor, "content:delete")
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

type LoadedPost = {
  id: string
  title: string
  kind: string
  platform: string
  status: string
  scheduledFor: Date | null
  sharedAt: Date | null
  needsRawUpload: boolean
  caption: string | null
  notes: string | null
  rawFileUrl: string | null
  finalEditUrl: string | null
  rawFolderUrl: string | null
  editsFolderUrl: string | null
  lines: { id: string; label: string; body: string }[]
  assets: {
    id: string
    name: string
    kind: string
    url: string | null
    sizeBytes: number | null
    createdAt: Date
    uploadedBy: { name: string | null; email: string } | null
  }[]
  comments: LoadedComment[]
}

export type PostView = {
  id: string
  title: string
  kind: ContentKind
  platform: ContentPlatform
  status: ContentStatus
  /** ISO yyyy-mm-dd, so the browser can filter and group without re-parsing. */
  scheduledDate: string | null
  scheduledLabel: string | null
  shared: boolean
  needsRawUpload: boolean
  caption: string | null
  notes: string | null
  rawFileUrl: string | null
  finalEditUrl: string | null
  rawFolderUrl: string | null
  editsFolderUrl: string | null
  script: { id: string; label: string; body: string }[]
  assets: {
    id: string
    name: string
    kind: string
    url: string | null
    size: string | null
    uploadedAt: string
    uploadedBy: string | null
  }[]
  comments: PostComment[]
  commentCount: number
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return null
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

/**
 * Reshapes a loaded post into the plain props every card renders from — dates
 * pre-formatted, because Date objects cross the server/client boundary but then
 * format against the server's locale, which is not the reader's.
 */
export function toPostView(post: LoadedPost, actor: Actor): PostView {
  return {
    id: post.id,
    title: post.title,
    kind: toContentKind(post.kind),
    platform: toContentPlatform(post.platform),
    status: toContentStatus(post.status),
    scheduledDate: toDateInputValue(post.scheduledFor) || null,
    scheduledLabel: post.scheduledFor ? formatDayMonth(post.scheduledFor) : null,
    shared: post.sharedAt !== null,
    needsRawUpload: post.needsRawUpload,
    caption: post.caption,
    // Internal notes are stripped here rather than merely hidden by the card:
    // props reach the browser whether or not they are rendered, so the client's
    // payload must not carry them at all.
    notes: can(actor, "content:manage") ? post.notes : null,
    rawFileUrl: post.rawFileUrl,
    finalEditUrl: post.finalEditUrl,
    rawFolderUrl: post.rawFolderUrl,
    editsFolderUrl: post.editsFolderUrl,
    script: post.lines.map(({ id, label, body }) => ({ id, label, body })),
    assets: post.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      url: asset.url,
      size: formatBytes(asset.sizeBytes),
      uploadedAt: asset.createdAt.toLocaleDateString(undefined, DAY_MONTH),
      uploadedBy: asset.uploadedBy?.name ?? asset.uploadedBy?.email ?? null,
    })),
    comments: toPostComments(post.comments, actor),
    commentCount: post.comments.length,
  }
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

type CountablePost = { status: string; sharedAt: Date | null }

/**
 * Headline counts for a calendar: how much of it the client can see, and how
 * much has actually gone out. Both are what a manager scanning the roster wants
 * to know, and neither is derivable from the other.
 */
export function calendarProgress(posts: CountablePost[]) {
  const total = posts.length
  const shared = posts.filter((post) => post.sharedAt !== null).length
  const published = posts.filter((post) => post.status === "PUBLISHED").length
  return {
    total,
    shared,
    published,
    percent: total === 0 ? 0 : Math.round((published / total) * 100),
  }
}

/**
 * Splits a body into text and URL runs so the renderer can link them without
 * `dangerouslySetInnerHTML`. Scripts are full of reference links — the whole
 * point of the block is that a client can tap the reel it is modelled on.
 */
export function linkify(text: string): { type: "text" | "link"; value: string }[] {
  const parts: { type: "text" | "link"; value: string }[] = []
  const pattern = /https?:\/\/[^\s<>"')]+/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push({ type: "text", value: text.slice(lastIndex, index) })
    // Trailing punctuation is almost always the sentence, not the URL.
    const url = match[0].replace(/[.,;:!?]+$/, "")
    parts.push({ type: "link", value: url })
    lastIndex = index + url.length
  }

  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) })
  return parts
}
