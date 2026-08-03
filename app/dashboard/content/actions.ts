"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { clientScopeFor } from "@/lib/clients"
import { calendarRecipients } from "@/lib/content-queries"
import {
  sendContentFeedbackEmail,
  sendContentPublishedEmail,
  sendContentStatusEmail,
} from "@/lib/emails"
import { assertCan, can, ForbiddenError, type Actor } from "@/lib/rbac"
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  DEFAULT_CYCLE_LENGTH,
  formatDayMonth,
  isContentKind,
  isContentPlatform,
  isContentStatus,
  MAX_COMMENT_LENGTH,
  MAX_SCRIPT_LINES,
  parseDateInput,
  seedScriptLines,
  toContentKind,
  toContentStatus,
  type ContentKind,
  type ContentPlatform,
  type ContentStatus,
} from "@/lib/content"

export type ActionResult = { ok: true } | { ok: false; error: string }

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Revalidates every route that renders this client's calendar. */
function revalidateCalendar(clientId: string) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/content")
  revalidatePath("/dashboard/clients")
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath(`/dashboard/clients/${clientId}/content`)
}

/**
 * Loads a calendar the actor is allowed to manage.
 *
 * content:manage is a global permission, so the client scope has to be
 * re-applied here — otherwise a manager could edit the calendar of a client
 * they were never assigned to.
 */
async function loadManageableCalendar(actor: Actor, calendarId: string) {
  return prisma.contentCalendar.findFirst({
    where: { AND: [{ id: calendarId }, { client: clientScopeFor(actor) }] },
    select: {
      id: true,
      clientId: true,
      cycleStart: true,
      cycleLength: true,
      rawFolderId: true,
      rawFolderUrl: true,
      editsFolderUrl: true,
    },
  })
}

async function loadManageablePost(actor: Actor, postId: string) {
  return prisma.contentPost.findFirst({
    where: { AND: [{ id: postId }, { calendar: { client: clientScopeFor(actor) } }] },
    select: {
      id: true,
      title: true,
      kind: true,
      status: true,
      sharedAt: true,
      scheduledFor: true,
      needsRawUpload: true,
      calendarId: true,
      calendar: { select: { clientId: true } },
    },
  })
}

/**
 * Guards every write with a permission check, returning either the actor or the
 * message to show. A discriminated union rather than a throw so each action
 * still returns the same ActionResult shape the forms expect.
 */
type Guard = { ok: true; actor: Actor } | { ok: false; error: string }

async function actorWith(
  permission: "content:manage" | "content:delete",
  message: string,
): Promise<Guard> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, permission)
    return { ok: true, actor }
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: message }
    throw error
  }
}

/* ------------------------------------------------------------------ *
 * Notifications
 *
 * Mail is a courtesy, never a precondition: a send that fails is logged by the
 * mailer and the action still reports success, because the change itself did
 * happen and the client will see it the next time they open the portal.
 * ------------------------------------------------------------------ */

type NotifiablePost = {
  title: string
  kind: string
  status: string
  scheduledFor: Date | null
  needsRawUpload: boolean
}

async function notifyClientPublished(clientId: string, post: NotifiablePost) {
  try {
    const recipients = await calendarRecipients(clientId)
    if (!recipients?.clientEmail) return
    await sendContentPublishedEmail({
      to: recipients.clientEmail,
      name: recipients.clientName,
      postTitle: post.title,
      kindLabel: CONTENT_KIND_LABELS[toContentKind(post.kind)],
      statusLabel: CONTENT_STATUS_LABELS[toContentStatus(post.status)],
      dateLabel: post.scheduledFor ? formatDayMonth(post.scheduledFor) : null,
      needsRawUpload: post.needsRawUpload,
    })
  } catch (error) {
    console.error("[content] publish notification failed", error)
  }
}

async function notifyClientStatus(
  clientId: string,
  post: NotifiablePost,
  previousStatus: string,
) {
  try {
    const recipients = await calendarRecipients(clientId)
    if (!recipients?.clientEmail) return
    await sendContentStatusEmail({
      to: recipients.clientEmail,
      name: recipients.clientName,
      postTitle: post.title,
      kindLabel: CONTENT_KIND_LABELS[toContentKind(post.kind)],
      statusLabel: CONTENT_STATUS_LABELS[toContentStatus(post.status)],
      dateLabel: post.scheduledFor ? formatDayMonth(post.scheduledFor) : null,
      previousStatusLabel: CONTENT_STATUS_LABELS[toContentStatus(previousStatus)],
    })
  } catch (error) {
    console.error("[content] status notification failed", error)
  }
}

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

/** Creates the content calendar for a client. Starts empty — posts are added one by one. */
export async function createCalendar(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to create calendars.")
  if (!guard.ok) return fail(guard.error)
  const { actor } = guard

  const clientId = String(formData.get("clientId") ?? "")
  if (!clientId) return fail("Select a client first.")

  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true, driveUrl: true, contentCalendar: { select: { id: true } } },
  })
  if (!client) return fail("Client not found.")
  if (client.contentCalendar) return fail("That client already has a content calendar.")

  const cycleStart = parseDateInput(String(formData.get("cycleStart") ?? ""))

  await prisma.contentCalendar.create({
    data: {
      client: { connect: { id: clientId } },
      createdBy: { connect: { id: actor.id } },
      cycleStart,
      cycleLength: DEFAULT_CYCLE_LENGTH,
      // Seeded from the client's existing Drive link so the first upload has
      // somewhere to go without a second setup step.
      rawFolderUrl: client.driveUrl,
      editsFolderUrl: client.driveUrl,
    },
  })

  revalidateCalendar(clientId)
  return { ok: true }
}

export async function deleteCalendar(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:delete", "Only an admin can delete a content calendar.")
  if (!guard.ok) return fail(guard.error)

  const calendar = await loadManageableCalendar(guard.actor, String(formData.get("calendarId") ?? ""))
  if (!calendar) return fail("Content calendar not found.")

  await prisma.contentCalendar.delete({ where: { id: calendar.id } })
  revalidateCalendar(calendar.clientId)
  return { ok: true }
}

/**
 * The cycle anchor, the cycle length and the two Drive folders.
 *
 * Every 30-day cycle is derived from `cycleStart`, so this one date moves the
 * whole schedule — which is exactly what the "Edit" next to it in the header is
 * for when a launch slips by a week.
 */
export async function saveCalendarSettings(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to edit this calendar.")
  if (!guard.ok) return fail(guard.error)

  const calendar = await loadManageableCalendar(guard.actor, String(formData.get("calendarId") ?? ""))
  if (!calendar) return fail("Content calendar not found.")

  const title = String(formData.get("title") ?? "").trim()
  const rawLength = Number(formData.get("cycleLength") ?? DEFAULT_CYCLE_LENGTH)
  if (!Number.isInteger(rawLength) || rawLength < 1 || rawLength > 365) {
    return fail("A cycle has to be between 1 and 365 days.")
  }

  const rawFolderUrl = String(formData.get("rawFolderUrl") ?? "").trim()
  const editsFolderUrl = String(formData.get("editsFolderUrl") ?? "").trim()

  await prisma.contentCalendar.update({
    where: { id: calendar.id },
    data: {
      title: title || "Content Calendar",
      cycleStart: parseDateInput(String(formData.get("cycleStart") ?? "")),
      cycleLength: rawLength,
      rawFolderUrl: rawFolderUrl || null,
      editsFolderUrl: editsFolderUrl || null,
      // The resolved folder id is derived from the pasted URL, so changing the
      // URL must not leave the old id behind for the uploader to write into.
      rawFolderId: null,
    },
  })

  revalidateCalendar(calendar.clientId)
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * Posts
 * ------------------------------------------------------------------ */

type ParsedLine = { id: string | null; label: string; body: string }

/**
 * The editor posts script lines as flat parallel arrays. A line with neither a
 * label nor a body is dropped rather than rejected, so clicking "+" and
 * changing your mind never blocks a save.
 */
function parseScriptLines(formData: FormData): ParsedLine[] | { error: string } {
  const ids = formData.getAll("lineId").map(String)
  const labels = formData.getAll("lineLabel").map(String)
  const bodies = formData.getAll("lineBody").map(String)

  if (labels.length !== bodies.length || ids.length !== labels.length) {
    return { error: "The script couldn't be read. Reload the page and try again." }
  }
  if (labels.length > MAX_SCRIPT_LINES) {
    return { error: `A script can have at most ${MAX_SCRIPT_LINES} lines.` }
  }

  const lines: ParsedLine[] = []
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim()
    const body = bodies[i].trim()
    if (!label && !body) continue
    if (!label) return { error: "Every script line needs a label." }
    lines.push({ id: ids[i] || null, label, body })
  }
  return lines
}

type PostFields = {
  title: string
  kind: ContentKind
  platform: ContentPlatform
  status: ContentStatus
  scheduledFor: Date | null
  needsRawUpload: boolean
  caption: string | null
  notes: string | null
  rawFileUrl: string | null
  finalEditUrl: string | null
  rawFolderUrl: string | null
  editsFolderUrl: string | null
}

/** Reads the fields shared by create and save. */
function parsePostFields(formData: FormData): PostFields | { error: string } {
  const title = String(formData.get("title") ?? "").trim()
  if (!title) return { error: "Give the post a title." }

  const kind = String(formData.get("kind") ?? "REEL")
  if (!isContentKind(kind)) return { error: "Pick a content type." }

  const platform = String(formData.get("platform") ?? "INSTAGRAM")
  if (!isContentPlatform(platform)) return { error: "Pick a platform." }

  const status = String(formData.get("status") ?? "SCRIPTING")
  if (!isContentStatus(status)) return { error: "Pick a status." }

  const url = (field: string) => String(formData.get(field) ?? "").trim() || null

  return {
    title,
    kind,
    platform,
    status,
    scheduledFor: parseDateInput(String(formData.get("scheduledFor") ?? "")),
    needsRawUpload: formData.get("needsRawUpload") === "on",
    caption: String(formData.get("caption") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    rawFileUrl: url("rawFileUrl"),
    finalEditUrl: url("finalEditUrl"),
    rawFolderUrl: url("rawFolderUrl"),
    editsFolderUrl: url("editsFolderUrl"),
  }
}

/**
 * Creates a post, with its script seeded from the default labels for the kind
 * chosen — a reel gets shoot direction, hooks and a CTA, a static post gets a
 * concept and copy. Every label is editable afterwards.
 *
 * A post starts unshared whatever the form says, unless "publish now" is
 * ticked: writing a script and publishing it are two decisions, and defaulting
 * to visible would put half-written direction in front of the client.
 */
export async function createPost(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to add posts.")
  if (!guard.ok) return fail(guard.error)
  const { actor } = guard

  const calendar = await loadManageableCalendar(actor, String(formData.get("calendarId") ?? ""))
  if (!calendar) return fail("Content calendar not found.")

  const fields = parsePostFields(formData)
  if ("error" in fields) return fail(fields.error)

  const lines = parseScriptLines(formData)
  if (!Array.isArray(lines)) return fail(lines.error)

  const publishNow = formData.get("publishNow") === "on"

  // Appended to the end of its day, so two posts created for the same date keep
  // the order they were added in.
  const last = await prisma.contentPost.findFirst({
    where: { calendarId: calendar.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })

  const post = await prisma.contentPost.create({
    data: {
      calendar: { connect: { id: calendar.id } },
      createdBy: { connect: { id: actor.id } },
      title: fields.title,
      kind: fields.kind,
      platform: fields.platform,
      status: fields.status,
      scheduledFor: fields.scheduledFor,
      needsRawUpload: fields.needsRawUpload,
      caption: fields.caption,
      notes: fields.notes,
      rawFileUrl: fields.rawFileUrl,
      finalEditUrl: fields.finalEditUrl,
      // Falls back to the calendar's folders, so every post is uploadable from
      // day one without anyone pasting a link per post.
      rawFolderUrl: fields.rawFolderUrl ?? calendar.rawFolderUrl,
      editsFolderUrl: fields.editsFolderUrl ?? calendar.editsFolderUrl,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      sharedAt: publishNow ? new Date() : null,
      // Whatever the dialog's script builder posted. It arrives pre-seeded with
      // the skeleton for this kind, so the fallback only matters if every line
      // was deleted before saving — in which case the skeleton is still the
      // most useful thing to reopen the post on.
      lines: {
        create:
          lines.length > 0
            ? lines.map((line, index) => ({
                label: line.label,
                body: line.body,
                sortOrder: index,
              }))
            : seedScriptLines(fields.kind),
      },
    },
    select: { title: true, kind: true, status: true, scheduledFor: true, needsRawUpload: true },
  })

  if (publishNow) await notifyClientPublished(calendar.clientId, post)

  revalidateCalendar(calendar.clientId)
  return { ok: true }
}

/**
 * Saves everything on a post, script included.
 *
 * The client is emailed only when a post they can already see reaches
 * Published — the steps in between are the team's working state, not news, and
 * a post they cannot see has nothing to report.
 */
export async function savePost(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to edit posts.")
  if (!guard.ok) return fail(guard.error)

  const existing = await loadManageablePost(guard.actor, String(formData.get("postId") ?? ""))
  if (!existing) return fail("Post not found.")

  const fields = parsePostFields(formData)
  if ("error" in fields) return fail(fields.error)

  const lines = parseScriptLines(formData)
  if (!Array.isArray(lines)) return fail(lines.error)

  // Ids are assigned here rather than by the database so the whole script can be
  // written with a fixed number of statements — the same approach the strategy
  // builder takes. Existing ids are reused, so a line keeps its identity across
  // a save and only genuinely new lines get a fresh one.
  const lineRecords = lines.map((line, index) => ({
    id: line.id ?? crypto.randomUUID(),
    postId: existing.id,
    label: line.label,
    body: line.body,
    sortOrder: index,
  }))

  await prisma.$transaction([
    prisma.contentScriptLine.deleteMany({ where: { postId: existing.id } }),
    ...(lineRecords.length > 0
      ? [prisma.contentScriptLine.createMany({ data: lineRecords })]
      : []),
    prisma.contentPost.update({
      where: { id: existing.id },
      data: {
        title: fields.title,
        kind: fields.kind,
        platform: fields.platform,
        status: fields.status,
        scheduledFor: fields.scheduledFor,
        needsRawUpload: fields.needsRawUpload,
        caption: fields.caption,
        notes: fields.notes,
        rawFileUrl: fields.rawFileUrl,
        finalEditUrl: fields.finalEditUrl,
        rawFolderUrl: fields.rawFolderUrl,
        editsFolderUrl: fields.editsFolderUrl,
      },
    }),
  ])

  if (existing.sharedAt && fields.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    await notifyClientStatus(
      existing.calendar.clientId,
      { ...fields, scheduledFor: fields.scheduledFor },
      existing.status,
    )
  }

  revalidateCalendar(existing.calendar.clientId)
  return { ok: true }
}

/**
 * The one-click status change on a card, without opening the full editor.
 * Only the move to Published is worth a mail — see savePost.
 */
export async function setPostStatus(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to edit posts.")
  if (!guard.ok) return fail(guard.error)

  const status = String(formData.get("status") ?? "")
  if (!isContentStatus(status)) return fail("Unknown status.")

  const post = await loadManageablePost(guard.actor, String(formData.get("postId") ?? ""))
  if (!post) return fail("Post not found.")
  if (post.status === status) return { ok: true }

  const updated = await prisma.contentPost.update({
    where: { id: post.id },
    data: {
      status,
      // Reaching PUBLISHED means it is live, so the shoot request that got it
      // there is spent — leaving the call-out up would ask the client for
      // footage on a reel that has already gone out.
      needsRawUpload: status === "PUBLISHED" ? false : post.needsRawUpload,
    },
    select: { title: true, kind: true, status: true, scheduledFor: true, needsRawUpload: true },
  })

  if (post.sharedAt && status === "PUBLISHED") {
    await notifyClientStatus(post.calendar.clientId, updated, post.status)
  }

  revalidateCalendar(post.calendar.clientId)
  return { ok: true }
}

/** Publishes the post to the client, or pulls it back out of sight. */
export async function setPostShared(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to publish posts.")
  if (!guard.ok) return fail(guard.error)

  const shared = String(formData.get("shared") ?? "") === "true"
  const post = await loadManageablePost(guard.actor, String(formData.get("postId") ?? ""))
  if (!post) return fail("Post not found.")

  const updated = await prisma.contentPost.update({
    where: { id: post.id },
    data: { sharedAt: shared ? (post.sharedAt ?? new Date()) : null },
    select: { title: true, kind: true, status: true, scheduledFor: true, needsRawUpload: true },
  })

  // Only on the transition into visibility — re-publishing something the client
  // has already been told about would just be a second copy of the same mail.
  if (shared && !post.sharedAt) await notifyClientPublished(post.calendar.clientId, updated)

  revalidateCalendar(post.calendar.clientId)
  return { ok: true }
}

/** Publishes every unshared post in one go, mailing the client once per post. */
export async function publishAllPosts(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:manage", "You don't have permission to publish posts.")
  if (!guard.ok) return fail(guard.error)

  const calendar = await loadManageableCalendar(guard.actor, String(formData.get("calendarId") ?? ""))
  if (!calendar) return fail("Content calendar not found.")

  const pending = await prisma.contentPost.findMany({
    where: { calendarId: calendar.id, sharedAt: null },
    select: { id: true, title: true, kind: true, status: true, scheduledFor: true, needsRawUpload: true },
  })
  if (pending.length === 0) return fail("Everything here is already published.")

  await prisma.contentPost.updateMany({
    where: { calendarId: calendar.id, sharedAt: null },
    data: { sharedAt: new Date() },
  })

  // Sequential, not Promise.all: the SMTP transport is a single pooled
  // connection, and a burst of parallel sends is how you get rate-limited.
  for (const post of pending) await notifyClientPublished(calendar.clientId, post)

  revalidateCalendar(calendar.clientId)
  return { ok: true }
}

export async function deletePost(formData: FormData): Promise<ActionResult> {
  const guard = await actorWith("content:delete", "Only an admin can delete a post.")
  if (!guard.ok) return fail(guard.error)

  const post = await loadManageablePost(guard.actor, String(formData.get("postId") ?? ""))
  if (!post) return fail("Post not found.")

  await prisma.contentPost.delete({ where: { id: post.id } })
  revalidateCalendar(post.calendar.clientId)
  return { ok: true }
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

/** Posts to a post's feedback thread. Both the client and the team write here. */
export async function addPostComment(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const postId = String(formData.get("postId") ?? "")
  const body = String(formData.get("body") ?? "").trim()
  if (!body) return fail("Write something first.")
  if (body.length > MAX_COMMENT_LENGTH) {
    return fail(`Feedback is limited to ${MAX_COMMENT_LENGTH} characters.`)
  }

  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      sharedAt: true,
      calendar: {
        select: { clientId: true, client: { select: { name: true, ownerUserId: true } } },
      },
    },
  })
  if (!post) return fail("Post not found.")

  const isOwner = post.calendar.client.ownerUserId === actor.id
  const canManage =
    can(actor, "content:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: post.calendar.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) return fail("You don't have permission to comment on this post.")
  if (isOwner && !canManage && !post.sharedAt) {
    return fail("This post isn't open yet. Your team is still preparing it.")
  }

  await prisma.contentComment.create({
    data: { postId: post.id, body, authorId: actor.id, authorRole: actor.role },
  })

  // The team is told when the client speaks, not the other way round: the
  // client already gets a mail for every publish and status change, and a reply
  // notification on top of that is one mail too many.
  if (isOwner && !canManage) {
    try {
      const recipients = await calendarRecipients(post.calendar.clientId)
      const excerpt = body.length > 400 ? `${body.slice(0, 400)}…` : body
      for (const member of recipients?.team ?? []) {
        await sendContentFeedbackEmail({
          to: member.email,
          clientName: post.calendar.client.name,
          postTitle: post.title,
          excerpt,
          clientId: post.calendar.clientId,
        })
      }
    } catch (error) {
      console.error("[content] feedback notification failed", error)
    }
  }

  revalidateCalendar(post.calendar.clientId)
  return { ok: true }
}

/** Removes feedback. You can always delete your own; admins can delete any. */
export async function deletePostComment(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const comment = await prisma.contentComment.findUnique({
    where: { id: String(formData.get("commentId") ?? "") },
    select: { id: true, authorId: true, post: { select: { calendar: { select: { clientId: true } } } } },
  })
  if (!comment) return fail("Comment not found.")

  const clientId = comment.post.calendar.clientId
  const isAuthor = comment.authorId === actor.id
  const canModerate =
    can(actor, "content:delete") &&
    (await prisma.client.count({ where: { AND: [{ id: clientId }, clientScopeFor(actor)] } })) > 0

  if (!isAuthor && !canModerate) return fail("You can only delete your own feedback.")

  await prisma.contentComment.delete({ where: { id: comment.id } })
  revalidateCalendar(clientId)
  return { ok: true }
}

/** Removes an uploaded file's record. The file itself stays in Drive. */
export async function deleteAsset(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const asset = await prisma.contentAsset.findUnique({
    where: { id: String(formData.get("assetId") ?? "") },
    select: {
      id: true,
      uploadedById: true,
      post: { select: { calendar: { select: { clientId: true } } } },
    },
  })
  if (!asset) return fail("File not found.")

  const clientId = asset.post.calendar.clientId
  const canManage =
    can(actor, "content:manage") &&
    (await prisma.client.count({ where: { AND: [{ id: clientId }, clientScopeFor(actor)] } })) > 0

  if (asset.uploadedById !== actor.id && !canManage) {
    return fail("You can only remove files you uploaded.")
  }

  await prisma.contentAsset.delete({ where: { id: asset.id } })
  revalidateCalendar(clientId)
  return { ok: true }
}
