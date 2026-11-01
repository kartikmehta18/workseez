import { prisma } from "@/lib/db"
import { getCurrentActor } from "@/lib/auth"
import { clientScopeFor } from "@/lib/clients"
import { driveConfigured } from "@/lib/drive"
import { can } from "@/lib/rbac"

/** Lives here because a route file may only export its handlers. */
export const DRIVE_OAUTH_STATE_COOKIE = "workseez_drive_oauth_state"

/**
 * Who may upload to a post, shared by both steps of an upload.
 *
 * Everything is re-checked server-side — a client may only upload to their own
 * post, and only once the team has published it to them.
 */
export async function authorizeUpload(postId: string) {
  const actor = await getCurrentActor()
  if (!actor || actor.status !== "ACTIVE") {
    return { ok: false as const, status: 401, error: "Your session has expired. Sign in again." }
  }

  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
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
  if (!post) return { ok: false as const, status: 404, error: "Post not found." }

  const isOwner = post.calendar.client.ownerUserId === actor.id
  const canManage =
    can(actor, "content:manage") &&
    (await prisma.client.count({
      where: { AND: [{ id: post.calendar.clientId }, clientScopeFor(actor)] },
    })) > 0

  if (!isOwner && !canManage) {
    return { ok: false as const, status: 403, error: "You can't upload to this post." }
  }
  if (isOwner && !canManage && !post.sharedAt) {
    return { ok: false as const, status: 403, error: "This post isn't open yet." }
  }

  if (!driveConfigured()) {
    return {
      ok: false as const,
      status: 503,
      error:
        "Uploads aren't switched on for this portal yet. Add your files to the Drive folder directly — the link is on the card.",
    }
  }

  return { ok: true as const, actor, post, isOwner, canManage }
}
