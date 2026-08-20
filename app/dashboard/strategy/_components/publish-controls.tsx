"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Eye, EyeOff, Loader2, RotateCcw, Send, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { deleteStrategySheet, setApproval, setSheetStatus } from "../actions"

/**
 * Publish / unpublish, plus delete for admins.
 *
 * Unpublishing is offered rather than hidden because a sheet is often published
 * a section too early; pulling it back to draft hides it from the client
 * without touching what has been written or the feedback already given.
 */
export function PublishControls({
  sheetId,
  status,
  rowCount,
  canDelete,
}: {
  sheetId: string
  status: string
  rowCount: number
  canDelete: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const published = status !== "DRAFT"

  const setStatus = (next: "DRAFT" | "PUBLISHED") => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("sheetId", sheetId)
      formData.set("status", next)
      const result = await setSheetStatus(formData)
      if (result.ok) {
        toast.success(
          next === "PUBLISHED"
            ? "Published. The client can now read it and leave feedback."
            : "Moved back to draft. The client can no longer see it.",
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this strategy sheet? Every section, row and piece of feedback on it is removed permanently.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set("sheetId", sheetId)
      const result = await deleteStrategySheet(formData)
      if (result.ok) {
        toast.success("Strategy sheet deleted.")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {published ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => setStatus("DRAFT")}>
          {pending ? <Loader2 className="animate-spin" /> : <EyeOff />} Unpublish
        </Button>
      ) : (
        <Button size="sm" disabled={pending || rowCount === 0} onClick={() => setStatus("PUBLISHED")}>
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Publish to client
        </Button>
      )}

      {published ? (
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Eye className="size-3.5" /> Visible to the client
        </span>
      ) : null}
    </div>
  )
}

/**
 * The client's sign-off button, and the way back out of it.
 *
 * Also rendered for the team, who can reopen an approved sheet when they need
 * to revise it — approval is the client's to give, but not a one-way door.
 */
export function ApprovalControl({
  sheetId,
  status,
  approvedAt,
  isOwner,
}: {
  sheetId: string
  status: string
  approvedAt: string | null
  isOwner: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const approved = status === "APPROVED"

  const submit = (next: boolean) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("sheetId", sheetId)
      formData.set("approved", next ? "true" : "false")
      const result = await setApproval(formData)
      if (result.ok) {
        toast.success(
          next ? "Approved. Your team will see the sign-off on their side." : "Reopened for changes.",
        )
      } else {
        toast.error(result.error)
      }
    })
  }

  if (approved) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <Check className="size-4 shrink-0 text-emerald-600" />
        <p className="min-w-0 flex-1 text-sm text-emerald-900">
          <span className="font-medium">Approved</span>
          {approvedAt ? <span className="text-emerald-700"> · {approvedAt}</span> : null}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => submit(false)}
          className="border-emerald-300 bg-white hover:bg-emerald-100"
        >
          {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reopen
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
      <p className="text-muted-foreground min-w-0 flex-1 text-sm">
        {isOwner
          ? "Happy with this strategy? Approve it to let your team know you're on board."
          : "Waiting on the client to approve."}
      </p>
      {isOwner ? (
        <Button size="sm" disabled={pending} onClick={() => submit(true)}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />} Approve strategy
        </Button>
      ) : null}
    </div>
  )
}
