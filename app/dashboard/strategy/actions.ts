"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { clientScopeFor } from "@/lib/clients"
import { assertCan, can, ForbiddenError, type Actor } from "@/lib/rbac"
import {
  isSectionKind,
  MAX_COLUMNS,
  MAX_COMMENT_LENGTH,
  MAX_ROWS_PER_SECTION,
  MAX_SECTIONS,
  seedSections,
} from "@/lib/strategy"

export type ActionResult = { ok: true } | { ok: false; error: string }

function fail(error: string): ActionResult {
  return { ok: false, error }
}

/** Revalidates every route that renders this sheet. */
function revalidateSheet(clientId: string) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/strategy")
  revalidatePath("/dashboard/clients")
  revalidatePath(`/dashboard/clients/${clientId}`)
  revalidatePath(`/dashboard/clients/${clientId}/strategy`)
}

/**
 * Loads a sheet the actor is allowed to manage.
 *
 * strategy:manage is a global permission, so the client scope has to be
 * re-applied here — otherwise a manager could edit the sheet of a client they
 * were never assigned to.
 */
async function loadManageableSheet(actor: Actor, sheetId: string) {
  return prisma.strategySheet.findFirst({
    where: { AND: [{ id: sheetId }, { client: clientScopeFor(actor) }] },
    select: { id: true, clientId: true, status: true },
  })
}

/** Creates the strategy sheet for a client, pre-filled with the default skeleton. */
export async function createStrategySheet(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "strategy:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to create strategy sheets.")
    }
    throw error
  }

  const clientId = String(formData.get("clientId") ?? "")
  if (!clientId) return fail("Select a client first.")

  const client = await prisma.client.findFirst({
    where: { AND: [{ id: clientId }, clientScopeFor(actor)] },
    select: { id: true, strategySheet: { select: { id: true } } },
  })
  if (!client) return fail("Client not found.")
  if (client.strategySheet) return fail("That client already has a strategy sheet.")

  await prisma.strategySheet.create({
    data: {
      client: { connect: { id: clientId } },
      createdBy: { connect: { id: actor.id } },
      sections: { create: seedSections() },
    },
  })

  revalidateSheet(clientId)
  return { ok: true }
}

export async function deleteStrategySheet(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "strategy:delete")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("Only an admin can delete a strategy sheet.")
    }
    throw error
  }

  const sheetId = String(formData.get("sheetId") ?? "")
  const sheet = await loadManageableSheet(actor, sheetId)
  if (!sheet) return fail("Strategy sheet not found.")

  await prisma.strategySheet.delete({ where: { id: sheet.id } })
  revalidateSheet(sheet.clientId)
  return { ok: true }
}

type ParsedRow = { id: string | null; label: string; cells: string[] }

type ParsedSection = {
  id: string | null
  title: string
  kind: string
  intro: string | null
  columns: { id: string | null; label: string }[]
  rows: ParsedRow[]
}

/**
 * The builder posts sections, columns and rows as flat parallel arrays plus a
 * per-section column and row count, which is what regroups them here. Rows
 * carry their existing id (blank for a new row) so editing a value in place
 * never orphans the row it belongs to.
 *
 * Cells are posted one form field per cell, in row-major order, so the cell
 * cursor advances by that section's column count for every row.
 */
function parseStructure(formData: FormData): ParsedSection[] | { error: string } {
  const sectionIds = formData.getAll("sectionId").map(String)
  const sectionTitles = formData.getAll("sectionTitle").map(String)
  const sectionKinds = formData.getAll("sectionKind").map(String)
  const sectionIntros = formData.getAll("sectionIntro").map(String)
  const sectionColumnCounts = formData.getAll("sectionColumnCount").map(Number)
  const sectionRowCounts = formData.getAll("sectionRowCount").map(Number)

  const columnIds = formData.getAll("columnId").map(String)
  const columnLabels = formData.getAll("columnLabel").map(String)

  const rowIds = formData.getAll("rowId").map(String)
  const rowLabels = formData.getAll("rowLabel").map(String)
  const cellValues = formData.getAll("cellValue").map(String)

  if (sectionTitles.length > MAX_SECTIONS) {
    return { error: `A sheet can have at most ${MAX_SECTIONS} sections.` }
  }
  if (
    sectionIds.length !== sectionTitles.length ||
    sectionKinds.length !== sectionTitles.length ||
    sectionIntros.length !== sectionTitles.length ||
    sectionColumnCounts.length !== sectionTitles.length ||
    sectionRowCounts.length !== sectionTitles.length ||
    columnIds.length !== columnLabels.length ||
    rowIds.length !== rowLabels.length
  ) {
    return { error: "The sheet couldn't be read. Reload the page and try again." }
  }

  const sections: ParsedSection[] = []
  let columnCursor = 0
  let rowCursor = 0
  let cellCursor = 0

  for (let i = 0; i < sectionTitles.length; i++) {
    const title = sectionTitles[i].trim()
    if (!title) return { error: `Section ${i + 1} needs a title.` }

    const kind = sectionKinds[i]
    if (!isSectionKind(kind)) return { error: "Unknown section type." }

    const columnCount = sectionColumnCounts[i]
    const rowCount = sectionRowCounts[i]
    if (
      !Number.isInteger(columnCount) ||
      columnCount < 0 ||
      !Number.isInteger(rowCount) ||
      rowCount < 0
    ) {
      return { error: "The sheet couldn't be read. Reload the page and try again." }
    }
    if (columnCount > MAX_COLUMNS) {
      return { error: `"${title}" can have at most ${MAX_COLUMNS} columns.` }
    }
    if (rowCount > MAX_ROWS_PER_SECTION) {
      return { error: `"${title}" can have at most ${MAX_ROWS_PER_SECTION} rows.` }
    }

    const columns: { id: string | null; label: string }[] = []
    for (let c = 0; c < columnCount; c++) {
      const index = columnCursor + c
      const label = (columnLabels[index] ?? "").trim()
      if (!label) return { error: `Every column in "${title}" needs a heading.` }
      columns.push({ id: columnIds[index] || null, label })
    }

    // FIELDS and NOTES always store exactly one cell per row, whatever the
    // column table happens to hold — switching a section's kind must not leave
    // rows the wrong width.
    const cellsPerRow = kind === "TABLE" ? columnCount : 1
    if (kind === "TABLE" && columnCount === 0) {
      return { error: `"${title}" is a table, so it needs at least one column.` }
    }

    const rows: ParsedRow[] = []
    for (let r = 0; r < rowCount; r++) {
      const index = rowCursor + r
      const label = (rowLabels[index] ?? "").trim()
      const cells = cellValues
        .slice(cellCursor + r * cellsPerRow, cellCursor + (r + 1) * cellsPerRow)
        .map((cell) => cell.trim())

      // A row with nothing in it is dropped rather than rejected, so clicking
      // "+" and changing your mind never blocks a save.
      const isEmpty = !label && cells.every((cell) => !cell)
      if (isEmpty) continue

      rows.push({
        id: rowIds[index] || null,
        label,
        // Pad back to full width — slice() runs short on the last row if the
        // browser dropped a disabled input.
        cells: Array.from({ length: cellsPerRow }, (_, k) => cells[k] ?? ""),
      })
    }

    columnCursor += columnCount
    rowCursor += rowCount
    cellCursor += rowCount * cellsPerRow

    sections.push({
      id: sectionIds[i] || null,
      title,
      kind,
      intro: sectionIntros[i].trim() || null,
      columns,
      rows,
    })
  }

  if (sections.length === 0) return { error: "Add at least one section before saving." }

  return sections
}

/** Replaces the sheet's sections, columns and rows with what the builder submitted. */
export async function saveSheetStructure(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "strategy:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to edit strategy sheets.")
    }
    throw error
  }

  const sheetId = String(formData.get("sheetId") ?? "")
  const sheet = await loadManageableSheet(actor, sheetId)
  if (!sheet) return fail("Strategy sheet not found.")

  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  if (!title) return fail("The sheet needs a title.")

  const sections = parseStructure(formData)
  if (!Array.isArray(sections)) return fail(sections.error)

  // Ids are assigned here rather than by the database so the whole structure can
  // be written with a fixed number of statements. Writing it row-by-row meant one
  // round-trip per column and per row — up to ~2000 against a remote host, which
  // overran the transaction timeout long before the sheet was saved. Existing ids
  // are reused so a row keeps its identity across a save; only genuinely new
  // rows get a fresh one.
  const sectionRecords = sections.map((section, sectionIndex) => ({
    id: section.id ?? crypto.randomUUID(),
    sheetId: sheet.id,
    title: section.title,
    kind: section.kind,
    intro: section.intro,
    sortOrder: sectionIndex,
  }))

  const columnRecords = sections.flatMap((section, sectionIndex) =>
    section.columns.map((column, columnIndex) => ({
      id: column.id ?? crypto.randomUUID(),
      sectionId: sectionRecords[sectionIndex].id,
      label: column.label,
      sortOrder: columnIndex,
    })),
  )

  const rowRecords = sections.flatMap((section, sectionIndex) =>
    section.rows.map((row, rowIndex) => ({
      id: row.id ?? crypto.randomUUID(),
      sectionId: sectionRecords[sectionIndex].id,
      label: row.label || null,
      cells: JSON.stringify(row.cells),
      sortOrder: rowIndex,
    })),
  )

  // Delete-then-recreate rather than a diff of updates and inserts. Nothing
  // references a section, column or row, so identity only has to survive the
  // save — which reusing the posted ids above already guarantees. Deleting the
  // sections cascades to their columns and rows, so one delete clears all three.
  // A NOTES-only sheet has no columns, and a brand-new section has no rows, so
  // the createMany calls are only included when they have something to write.
  await prisma.$transaction([
    prisma.strategySection.deleteMany({ where: { sheetId: sheet.id } }),
    ...(sectionRecords.length > 0
      ? [prisma.strategySection.createMany({ data: sectionRecords })]
      : []),
    ...(columnRecords.length > 0
      ? [prisma.strategyColumn.createMany({ data: columnRecords })]
      : []),
    ...(rowRecords.length > 0 ? [prisma.strategyRow.createMany({ data: rowRecords })] : []),
    prisma.strategySheet.update({
      where: { id: sheet.id },
      data: { title, description: description || null },
    }),
  ])

  revalidateSheet(sheet.clientId)
  return { ok: true }
}

/** Saves the strategist / team lead sign-off block. */
export async function saveSignOff(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "strategy:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to edit this sheet.")
    }
    throw error
  }

  const sheetId = String(formData.get("sheetId") ?? "")
  const sheet = await loadManageableSheet(actor, sheetId)
  if (!sheet) return fail("Strategy sheet not found.")

  const strategistName = String(formData.get("strategistName") ?? "").trim()
  const teamLeadName = String(formData.get("teamLeadName") ?? "").trim()

  // A name with no date is the normal half-filled state, so the date is only
  // stamped when there is someone to attach it to.
  const parseDate = (raw: string) => {
    const value = raw.trim()
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  await prisma.strategySheet.update({
    where: { id: sheet.id },
    data: {
      strategistName: strategistName || null,
      strategistDate: strategistName ? parseDate(String(formData.get("strategistDate") ?? "")) : null,
      teamLeadName: teamLeadName || null,
      teamLeadDate: teamLeadName ? parseDate(String(formData.get("teamLeadDate") ?? "")) : null,
    },
  })

  revalidateSheet(sheet.clientId)
  return { ok: true }
}

/** Makes the sheet visible to the client, or pulls it back to draft. */
export async function setSheetStatus(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  try {
    assertCan(actor, "strategy:manage")
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return fail("You don't have permission to publish strategy sheets.")
    }
    throw error
  }

  const sheetId = String(formData.get("sheetId") ?? "")
  const next = String(formData.get("status") ?? "")
  if (next !== "DRAFT" && next !== "PUBLISHED") return fail("Invalid status.")

  const sheet = await loadManageableSheet(actor, sheetId)
  if (!sheet) return fail("Strategy sheet not found.")

  if (next === "PUBLISHED") {
    const rowCount = await prisma.strategyRow.count({
      where: { section: { sheetId: sheet.id } },
    })
    if (rowCount === 0) return fail("Fill in at least one row before publishing.")
  }

  await prisma.strategySheet.update({
    where: { id: sheet.id },
    data:
      next === "PUBLISHED"
        ? { status: "PUBLISHED", publishedAt: new Date(), approvedAt: null }
        : // Unpublishing clears the approval too — a sheet the client can no
          // longer see cannot meaningfully still be signed off.
          { status: "DRAFT", approvedAt: null },
  })

  revalidateSheet(sheet.clientId)
  return { ok: true }
}

/**
 * The client's sign-off, and the way back out of it. Approving is the client's
 * own call, so this is gated on ownership rather than a permission — the team
 * can also flip it, which is what lets them reopen a sheet to make changes.
 */
export async function setApproval(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const sheetId = String(formData.get("sheetId") ?? "")
  const approved = String(formData.get("approved") ?? "") === "true"

  const sheet = await prisma.strategySheet.findUnique({
    where: { id: sheetId },
    select: { id: true, status: true, clientId: true, client: { select: { ownerUserId: true } } },
  })
  if (!sheet) return fail("Strategy sheet not found.")

  const isOwner = sheet.client.ownerUserId === actor.id
  const canManage =
    can(actor, "strategy:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: sheet.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) return fail("You don't have permission to approve this sheet.")
  if (sheet.status === "DRAFT") return fail("This sheet hasn't been published yet.")

  await prisma.strategySheet.update({
    where: { id: sheet.id },
    data: approved
      ? { status: "APPROVED", approvedAt: new Date() }
      : { status: "PUBLISHED", approvedAt: null },
  })

  revalidateSheet(sheet.clientId)
  return { ok: true }
}

/** Posts to the feedback thread. Both the client and the team write here. */
export async function addComment(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const sheetId = String(formData.get("sheetId") ?? "")
  const body = String(formData.get("body") ?? "").trim()
  if (!body) return fail("Write something first.")
  if (body.length > MAX_COMMENT_LENGTH) {
    return fail(`Feedback is limited to ${MAX_COMMENT_LENGTH} characters.`)
  }

  const sheet = await prisma.strategySheet.findUnique({
    where: { id: sheetId },
    select: { id: true, status: true, clientId: true, client: { select: { ownerUserId: true } } },
  })
  if (!sheet) return fail("Strategy sheet not found.")

  const isOwner = sheet.client.ownerUserId === actor.id
  const canManage =
    can(actor, "strategy:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: sheet.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) return fail("You don't have permission to comment on this sheet.")
  if (isOwner && !canManage && sheet.status === "DRAFT") {
    return fail("This sheet isn't open yet. Your team is still preparing it.")
  }

  await prisma.strategyComment.create({
    data: { sheetId: sheet.id, body, authorId: actor.id, authorRole: actor.role },
  })

  revalidateSheet(sheet.clientId)
  return { ok: true }
}

/** Removes a comment. You can always delete your own; admins can delete any. */
export async function deleteComment(formData: FormData): Promise<ActionResult> {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") return fail("Your session has expired. Sign in again.")

  const commentId = String(formData.get("commentId") ?? "")
  const comment = await prisma.strategyComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, sheet: { select: { clientId: true } } },
  })
  if (!comment) return fail("Comment not found.")

  const isAuthor = comment.authorId === actor.id
  const canModerate =
    can(actor, "strategy:delete") &&
    (await prisma.client.count({
      where: { AND: [{ id: comment.sheet.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isAuthor && !canModerate) return fail("You can only delete your own feedback.")

  await prisma.strategyComment.delete({ where: { id: comment.id } })
  revalidateSheet(comment.sheet.clientId)
  return { ok: true }
}
