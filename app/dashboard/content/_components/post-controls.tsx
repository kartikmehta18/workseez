"use client"

import * as React from "react"
import { toast } from "sonner"
import { EyeOff, Loader2, Send, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CONTENT_STATUS_LABELS,
  statusesForKind,
  type ContentKind,
  type ContentStatus,
} from "@/lib/content"
import { deletePost, setPostShared, setPostStatus } from "../actions"

/**
 * The team's controls on a card: move the status, publish to the client, and
 * (for admins) delete.
 *
 * Status lives here as well as in the editor because moving eight reels from
 * "shoot pending" to "in production" is the single most repeated action in a
 * cycle, and it should not need a dialog.
 */
export function PostControls({
  postId,
  kind,
  status,
  shared,
  canDelete,
}: {
  postId: string
  kind: ContentKind
  status: ContentStatus
  shared: boolean
  canDelete: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  const changeStatus = (next: string) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("postId", postId)
      formData.set("status", next)
      const result = await setPostStatus(formData)
      if (result.ok) {
        toast.success(
          shared
            ? `Moved to ${CONTENT_STATUS_LABELS[next as ContentStatus]}. The client has been emailed.`
            : `Moved to ${CONTENT_STATUS_LABELS[next as ContentStatus]}.`,
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  const changeShared = (next: boolean) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("postId", postId)
      formData.set("shared", next ? "true" : "false")
      const result = await setPostShared(formData)
      if (result.ok) {
        toast.success(
          next
            ? "Published. The client can see it and has been emailed."
            : "Pulled back. The client can no longer see it.",
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this post? The script, the uploaded file list and every piece of feedback on it go with it.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set("postId", postId)
      const result = await deletePost(formData)
      if (result.ok) {
        toast.success("Post deleted.")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={status} onValueChange={changeStatus} disabled={pending}>
        <SelectTrigger className="h-9 w-44" aria-label="Post status">
          <SelectValue />
        </SelectTrigger>
        {/* Only the statuses this type can be in — a carousel is never waiting
            on a shoot or sitting with an editor. The post's own status stays
            listed either way, so an older one still shows what it is. */}
        <SelectContent>
          {statusesForKind(kind, status).map((option) => (
            <SelectItem key={option} value={option}>
              {CONTENT_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {shared ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => changeShared(false)}>
          {pending ? <Loader2 className="animate-spin" /> : <EyeOff />} Unpublish
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={() => changeShared(true)}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Publish to client
        </Button>
      )}

      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 /> Delete
        </Button>
      ) : null}
    </div>
  )
}
