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
 * The line the whole module is split along: a reel is filmed, a carousel is
 * designed, and almost everything below — which statuses exist, what the
 * content block looks like, whether raw footage is even a concept — follows
 * from which side of it a kind falls on.
 */
export function isVideoKind(kind: ContentKind) {
  return VIDEO_KINDS.includes(kind)
}

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

/**
 * Every status a post can be in, across both tracks.
 *
 * The order is the order the "Any status" filter lists them in: the video track
 * top to bottom, then the static track, then the one state they share. Nothing
 * else reads this list positionally — a select offers `statusesForKind` instead.
 */
export const CONTENT_STATUSES = [
  // Filmed work: written, shot, edited.
  "SCRIPTING",
  "SHOOT_PENDING",
  "IN_PRODUCTION",
  // Designed work: decided, researched, made.
  "CONTENT_TOPICS",
  "CONTENT_RESEARCH",
  "DESIGNING",
  // The end of both tracks. SCHEDULED is filmed-only and sits inside it.
  "CAPTIONING",
  "SCHEDULED",
  "PUBLISHED",
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  SCRIPTING: "Scripting",
  SHOOT_PENDING: "Shoot pending",
  IN_PRODUCTION: "In production",
  CONTENT_TOPICS: "Content topics",
  CONTENT_RESEARCH: "Content research",
  DESIGNING: "Designing",
  CAPTIONING: "Captioning",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
}

/**
 * The two pipelines, in the order the work moves through them.
 *
 * How the thing gets made is what differs — filmed or designed — and the middle
 * of each track says so. A carousel is never waiting on footage, never with an
 * editor and never sitting behind an approved cut; a reel is never "with the
 * designer". One shared list of vaguely applicable states is how a calendar
 * ends up misreporting where the work is, so each kind gets the vocabulary that
 * actually describes it.
 *
 * Two steps are on both: whatever the thing is, its caption gets written and
 * then it goes out. SCHEDULED sits between them on the filmed track only —
 * queueing behind an approved cut is a step a carousel does not have.
 */
const VIDEO_STATUSES: ContentStatus[] = [
  "SCRIPTING",
  "SHOOT_PENDING",
  "IN_PRODUCTION",
  "CAPTIONING",
  "SCHEDULED",
  "PUBLISHED",
]

const STATIC_STATUSES: ContentStatus[] = [
  "CONTENT_TOPICS",
  "CONTENT_RESEARCH",
  "DESIGNING",
  "CAPTIONING",
  "PUBLISHED",
]

/**
 * Which statuses a given type can be in — its track and nothing else.
 *
 * There is deliberately no escape hatch for a value already on the row. A
 * carousel must never offer "Scripting", not even because that is what it
 * happens to be stored as: the whole point of the split is that the wrong
 * vocabulary is never on the menu. `normalizeStatusForKind` is what keeps a row
 * like that renderable instead.
 */
export function statusesForKind(kind: ContentKind): ContentStatus[] {
  return isVideoKind(kind) ? VIDEO_STATUSES : STATIC_STATUSES
}

/**
 * A status this kind can actually be in.
 *
 * Rows written before the tracks were split — or by an older client that has
 * not reloaded — can hold a status the type no longer allows. Rather than show
 * it, which would put "Scripting" back on a carousel, the UI reads it as the
 * first step of the track it does belong to. The row itself catches up on its
 * next save, or in bulk via the migration that moves them.
 */
export function normalizeStatusForKind(kind: ContentKind, status: ContentStatus): ContentStatus {
  return statusesForKind(kind).includes(status) ? status : defaultStatusForKind(kind)
}

/**
 * Where a post of this type starts — and where a post drops back to when its
 * type changes to one its current status doesn't belong to.
 */
export function defaultStatusForKind(kind: ContentKind): ContentStatus {
  return statusesForKind(kind)[0]
}

/** One line of explanation per status, shown wherever the status is chosen. */
export const CONTENT_STATUS_HINTS: Record<ContentStatus, string> = {
  SCRIPTING: "The script is still being written.",
  SHOOT_PENDING: "Script is ready — waiting on footage.",
  IN_PRODUCTION: "Footage is in, the editor is working on it.",
  CONTENT_TOPICS: "Still deciding what this one is about.",
  CONTENT_RESEARCH: "Topic is set — gathering the angle and the references.",
  DESIGNING: "With the designer.",
  CAPTIONING: "Made — writing the caption that goes out with it.",
  SCHEDULED: "Caption approved and queued to go out.",
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
 * The starting script for a new filmed post. Labels only — the bodies are what
 * the strategist writes, and seeding example copy would be worse than a blank
 * line because it reads as real direction until someone notices.
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

/**
 * A designed post has no script — it has a headline and the copy that goes with
 * it. Fixed, unlike the labels above: these two are the whole block, so there is
 * nothing to rename and nothing to add.
 */
export const STATIC_CONTENT_LABELS = ["Title", "Content"] as const

export function defaultScriptLabels(kind: ContentKind): readonly string[] {
  return isVideoKind(kind) ? VIDEO_SCRIPT_LABELS : STATIC_CONTENT_LABELS
}

/**
 * What the block is called wherever it is shown — the editor heading, the card
 * heading on both sides, and the sentence shown when it is still empty.
 */
export function contentBlockTitle(kind: ContentKind) {
  return isVideoKind(kind) ? "Script" : "Content"
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

/**
 * A post as the *list* loads it. Deliberately narrower than what a post
 * actually holds: a cycle's worth of cards renders collapsed, so the list has
 * no use for comment bodies, author avatars or the file table, and loading them
 * for every post meant four extra relation queries and a payload dominated by
 * text nobody had asked to see yet. Counts are enough for the collapsed row;
 * the rest arrives when a card is opened.
 */
type LoadedListPost = {
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
  /** Read to build the search index below, never sent to the browser. */
  lines: { label: string; body: string }[]
  _count: { comments: number; assets: number }
}

/** Everything on one post, as the expanded card loads it. */
type LoadedPost = {
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
  notes: string | null
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
  commentCount: number
  assetCount: number
  /**
   * Everything the search box matches on, lowercased once here.
   *
   * The list used to rebuild this per post on every keystroke — joining the
   * title, caption, notes and every script line, then lowercasing the result —
   * which is what made typing in the filter stutter. It also lets the script
   * stay searchable now that its text no longer travels to the browser.
   */
  search: string
}

/** The parts of a post that only an expanded card needs. */
export type PostDetail = {
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
export function toPostView(post: LoadedListPost, actor: Actor): PostView {
  const canManage = can(actor, "content:manage")
  const kind = toContentKind(post.kind)
  // Internal notes are stripped rather than merely hidden by the card: props
  // reach the browser whether or not they are rendered, so the client's payload
  // must not carry them at all — and for the same reason they stay out of the
  // search index a client receives.
  const notes = canManage ? post.notes : null

  return {
    id: post.id,
    title: post.title,
    kind,
    platform: toContentPlatform(post.platform),
    // Read against this post's own track, so a row still holding a status from
    // before the split renders as the step it maps to rather than showing a
    // carousel as "Scripting".
    status: normalizeStatusForKind(kind, toContentStatus(post.status)),
    scheduledDate: toDateInputValue(post.scheduledFor) || null,
    scheduledLabel: post.scheduledFor ? formatDayMonth(post.scheduledFor) : null,
    shared: post.sharedAt !== null,
    needsRawUpload: post.needsRawUpload,
    caption: post.caption,
    notes,
    rawFileUrl: post.rawFileUrl,
    finalEditUrl: post.finalEditUrl,
    rawFolderUrl: post.rawFolderUrl,
    editsFolderUrl: post.editsFolderUrl,
    commentCount: post._count.comments,
    assetCount: post._count.assets,
    search: [
      post.title,
      post.caption ?? "",
      notes ?? "",
      ...post.lines.flatMap((line) => [line.label, line.body]),
    ]
      .join(" ")
      .toLowerCase(),
  }
}

/** The same reshaping for the parts an expanded card asks for separately. */
export function toPostDetail(post: LoadedPost, actor: Actor): PostDetail {
  return {
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
