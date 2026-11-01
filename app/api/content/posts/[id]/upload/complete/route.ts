import { revalidatePath } from "next/cache"
import type { NextRequest } from "next/server"

import { prisma } from "@/lib/db"
import { calendarRecipients } from "@/lib/content-queries"
import { sendContentUploadEmail } from "@/lib/emails"
import { isAssetKind, MAX_UPLOAD_FILES } from "@/lib/content"
import { driveErrorMessage, findUploadedFile, type UploadedFile } from "@/lib/drive"
import { authorizeUpload } from "@/lib/post-upload"

/**
 * Records the files a browser finished sending to Drive.
 *
 * Nothing the browser says is taken at face value: each id is read back from
 * Drive, and only a file sitting in this post's folder becomes an asset. It is
 * called for every file that was attempted, because a browser can lose sight of
 * Drive's final response on a file that arrived safely.
 */

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/content/posts/[id]/upload/complete">,
) {
  const { id } = await ctx.params

  const access = await authorizeUpload(id)
  if (!access.ok) return json({ error: access.error }, access.status)
  const { actor, post, isOwner, canManage } = access

  const body = (await request.json().catch(() => null)) as {
    fileIds?: unknown
    kind?: unknown
  } | null
  const fileIds = Array.isArray(body?.fileIds) ? body.fileIds : []
  const kindValue = String(body?.kind ?? "RAW")
  const kind = isAssetKind(kindValue) ? kindValue : "RAW"

  if (
    fileIds.length === 0 ||
    fileIds.length > MAX_UPLOAD_FILES ||
    !fileIds.every((fileId) => typeof fileId === "string" && /^[\w-]+$/.test(fileId))
  ) {
    return json({ error: "Nothing to record." }, 400)
  }

  const folderId = post.rawFolderId
  if (!folderId) return json({ error: "This post has no upload folder yet." }, 409)

  let found: (UploadedFile | null)[]
  try {
    found = await Promise.all(
      (fileIds as string[]).map((fileId) => findUploadedFile(fileId, folderId)),
    )
  } catch (error) {
    return json({ error: driveErrorMessage(error) }, 502)
  }
  const arrived = found.filter((file) => file !== null)
  if (arrived.length < fileIds.length) {
    console.warn(
      `[drive] ${fileIds.length - arrived.length} of ${fileIds.length} files never arrived for post ${post.id}`,
    )
  }

  // Retrying a failed request must not list the same file twice.
  const recorded = await prisma.contentAsset.findMany({
    where: { postId: post.id, driveFileId: { in: arrived.map((file) => file.id) } },
    select: { driveFileId: true },
  })
  const known = new Set(recorded.map((asset) => asset.driveFileId))
  const fresh = arrived.filter((file) => !known.has(file.id))

  if (fresh.length > 0) {
    await prisma.contentAsset.createMany({
      data: fresh.map((file) => ({
        postId: post.id,
        name: file.name,
        kind,
        driveFileId: file.id,
        url: file.url,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        uploadedById: actor.id,
      })),
    })

    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        // The first raw file doubles as the "Raw file" button on the card, unless
        // the team has already pointed that at something specific.
        rawFileUrl: post.rawFileUrl ?? fresh[0].url,
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
            fileCount: fresh.length,
            folderUrl: post.rawFolderUrl,
            clientId: post.calendar.clientId,
          })
        }
      } catch (error) {
        console.error("[content] upload notification failed", error)
      }
    }

    revalidatePath("/dashboard/content")
    revalidatePath(`/dashboard/clients/${post.calendar.clientId}/content`)
  }

  return json({ uploaded: arrived.length, missing: fileIds.length - arrived.length })
}
