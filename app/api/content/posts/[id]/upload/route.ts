import { revalidatePath } from "next/cache"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { clientScopeFor } from "@/lib/clients"
import { calendarRecipients } from "@/lib/content-queries"
import { sendContentUploadEmail } from "@/lib/emails"
import { can } from "@/lib/rbac"
import { isAssetKind, MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, toDateInputValue } from "@/lib/content"
import {
  driveConfigured,
  driveErrorMessage,
  ensureFolder,
  folderIdFromUrl,
  folderUrl,
  uploadFile,
} from "@/lib/drive"

/**
 * Raw footage upload for one post.
 *
 * A route handler rather than a server action on purpose: server actions cap
 * the request body at a couple of megabytes, and this endpoint exists to move
 * video. Here the file is handed to Drive as a Blob, so it streams through
 * instead of being buffered whole.
 *
 * Everything is re-checked server-side — a client may only upload to their own
 * post, and only once the team has published it to them.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/content/posts/[id]/upload">) {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") {
    return json({ error: "Your session has expired. Sign in again." }, 401)
  }

  const { id } = await ctx.params

  const post = await prisma.contentPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      sharedAt: true,
      scheduledFor: true,
      rawFolderId: true,
      rawFolderUrl: true,
      rawFileUrl: true,
      calendar: {
        select: {
          clientId: true,
          rawFolderId: true,
          rawFolderUrl: true,
          client: { select: { name: true, ownerUserId: true, driveUrl: true } },
        },
      },
    },
  })
  if (!post) return json({ error: "Post not found." }, 404)

  const isOwner = post.calendar.client.ownerUserId === actor.id
  const canManage =
    can(actor, "content:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: post.calendar.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) return json({ error: "You can't upload to this post." }, 403)
  if (isOwner && !canManage && !post.sharedAt) {
    return json({ error: "This post isn't open yet." }, 403)
  }

  if (!driveConfigured()) {
    return json(
      {
        error:
          "Uploads aren't switched on for this portal yet. Add your files to the Drive folder directly — the link is on the card.",
      },
      503,
    )
  }

  const formData = await request.formData()
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File)
  const kindValue = String(formData.get("kind") ?? "RAW")
  const kind = isAssetKind(kindValue) ? kindValue : "RAW"

  if (files.length === 0) return json({ error: "Choose at least one file." }, 400)
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

  // Where the files land. The post gets its own folder under the calendar's raw
  // folder, created on first upload, so a month of shoots does not end up as one
  // undifferentiated pile.
  let parentId = post.rawFolderId
  let parentUrl = post.rawFolderUrl

  if (!parentId) {
    const calendarFolderId =
      post.calendar.rawFolderId ??
      folderIdFromUrl(post.calendar.rawFolderUrl) ??
      folderIdFromUrl(post.calendar.client.driveUrl)

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
      parentUrl = folder.webViewLink ?? folderUrl(folder.id)
    } catch (error) {
      return json({ error: driveErrorMessage(error) }, 502)
    }
  }

  const uploaded: { id: string; name: string; url: string | null }[] = []

  for (const file of files) {
    try {
      const result = await uploadFile({
        parentId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        body: file,
      })

      const asset = await prisma.contentAsset.create({
        data: {
          postId: post.id,
          name: result.name,
          kind,
          driveFileId: result.id,
          url: result.webViewLink,
          mimeType: file.type || null,
          sizeBytes: file.size,
          uploadedById: actor.id,
        },
        select: { id: true, name: true, url: true },
      })
      uploaded.push(asset)
    } catch (error) {
      // Partial success is reported as success for what got through: re-running
      // the upload for the remaining files is easy, re-uploading a 1 GB file
      // that already landed is not.
      const message = driveErrorMessage(error)
      if (uploaded.length === 0) return json({ error: message }, 502)
      return json({ uploaded, error: message, partial: true }, 207)
    }
  }

  await prisma.contentPost.update({
    where: { id: post.id },
    data: {
      rawFolderId: parentId,
      rawFolderUrl: parentUrl,
      // The first raw file doubles as the "Raw file" button on the card, unless
      // the team has already pointed that at something specific.
      rawFileUrl: post.rawFileUrl ?? uploaded[0]?.url ?? null,
      // The ask has been answered.
      ...(kind === "RAW" && isOwner ? { needsRawUpload: false } : {}),
    },
  })

  // The team is told the footage arrived — the client's card already shows it.
  if (isOwner && !canManage) {
    try {
      const recipients = await calendarRecipients(post.calendar.clientId)
      for (const member of recipients?.team ?? []) {
        await sendContentUploadEmail({
          to: member.email,
          clientName: post.calendar.client.name,
          postTitle: post.title,
          fileCount: uploaded.length,
          folderUrl: parentUrl,
          clientId: post.calendar.clientId,
        })
      }
    } catch (error) {
      console.error("[content] upload notification failed", error)
    }
  }

  revalidatePath("/dashboard/content")
  revalidatePath(`/dashboard/clients/${post.calendar.clientId}/content`)

  return json({ uploaded, folderUrl: parentUrl })
}
