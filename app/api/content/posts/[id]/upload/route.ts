import type { NextRequest } from "next/server"

import { prisma } from "@/lib/db"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, toDateInputValue } from "@/lib/content"
import {
  createUploadSession,
  driveErrorMessage,
  ensureFolder,
  folderIdFromUrl,
  folderUrl,
} from "@/lib/drive"
import { authorizeUpload } from "@/lib/post-upload"
import { publicOrigin } from "@/lib/urls"

/**
 * Starts a raw footage upload for one post.
 *
 * The browser sends the files straight to Drive, so this only sees their names
 * and sizes: it finds the post's folder and opens one upload session per file.
 * The `complete` route beside this one records what actually arrived.
 *
 * A route handler rather than a server action so both steps share one URL and
 * one set of status codes for the upload dialog to read.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

type RequestedFile = { name: string; size: number; type: string }

function isRequestedFile(value: unknown): value is RequestedFile {
  const file = value as RequestedFile | null
  return (
    typeof file?.name === "string" &&
    file.name.length > 0 &&
    Number.isSafeInteger(file.size) &&
    file.size >= 0 &&
    typeof file.type === "string"
  )
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/content/posts/[id]/upload">) {
  const { id } = await ctx.params

  const access = await authorizeUpload(id)
  if (!access.ok) return json({ error: access.error }, access.status)
  const { post } = access

  const body = (await request.json().catch(() => null)) as { files?: unknown } | null
  const files = Array.isArray(body?.files) ? body.files : []

  if (files.length === 0 || !files.every(isRequestedFile)) {
    return json({ error: "Choose at least one file." }, 400)
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return json({ error: `Up to ${MAX_UPLOAD_FILES} files at a time.` }, 400)
  }
  const tooBig = files.find((file) => file.size > MAX_UPLOAD_BYTES)
  if (tooBig) {
    return json(
      { error: `"${tooBig.name}" is over 2 GB — add that one to the Drive folder directly.` },
      400,
    )
  }

  const calendarFolderId =
    post.calendar.rawFolderId ??
    folderIdFromUrl(post.calendar.rawFolderUrl) ??
    folderIdFromUrl(post.calendar.client.driveUrl)

  // Where the files land: the Raw folder link on the post, read fresh so a link
  // the team changes takes effect on the next upload. A new post starts with a
  // copy of the calendar's link, though, and uploading straight into that would
  // leave a month of shoots as one undifferentiated pile — so a link that is
  // still the calendar's gets a folder of its own inside it instead.
  const linkedFolderId = folderIdFromUrl(post.rawFolderUrl)
  let parentId = linkedFolderId !== calendarFolderId ? linkedFolderId : null

  if (parentId && parentId !== post.rawFolderId) {
    // What `complete` checks the arriving files against.
    await prisma.contentPost.update({ where: { id: post.id }, data: { rawFolderId: parentId } })
  }

  if (!parentId) {
    if (!calendarFolderId) {
      return json(
        {
          error:
            "No Drive folder is linked for this client yet. Ask your team to add one in the calendar settings.",
        },
        409,
      )
    }

    try {
      // Dated first so the folder list sorts chronologically in Drive.
      const datePrefix = post.scheduledFor ? `${toDateInputValue(post.scheduledFor)} · ` : ""
      const folder = await ensureFolder(
        // Drive treats "/" as a path separator in some clients, so it is the one
        // character a title cannot bring along.
        `${datePrefix}${post.title.replace(/[/\\]/g, "-").slice(0, 90)}`,
        calendarFolderId,
      )
      parentId = folder.id

      // Saved now, not at the end: this is the folder `complete` checks the
      // files against, and a second upload should reuse it either way.
      await prisma.contentPost.update({
        where: { id: post.id },
        data: { rawFolderId: folder.id, rawFolderUrl: folder.webViewLink ?? folderUrl(folder.id) },
      })
    } catch (error) {
      return json({ error: driveErrorMessage(error) }, 502)
    }
  }

  const origin = request.headers.get("origin") ?? publicOrigin(request)

  try {
    const folderId = parentId
    const uploads = await Promise.all(
      files.map(async (file) => {
        const session = await createUploadSession({
          parentId: folderId,
          name: file.name,
          // Sent to Drive as a header, so anything but a plain media type is dropped.
          mimeType: /^[\w.+-]+\/[\w.+-]+$/.test(file.type) ? file.type : "application/octet-stream",
          size: file.size,
          origin,
        })
        return { name: file.name, ...session }
      }),
    )
    return json({ uploads })
  } catch (error) {
    return json({ error: driveErrorMessage(error) }, 502)
  }
}
