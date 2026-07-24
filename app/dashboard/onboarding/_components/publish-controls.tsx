"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, Send, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { deleteOnboardingForm, setFormStatus } from "../actions"

/**
 * Publish / unpublish, plus delete for admins.
 *
 * Unpublishing is offered rather than hidden because a form is often published
 * a section too early; pulling it back to draft hides it from the client
 * without touching the answers they already gave.
 */
export function PublishControls({
  formId,
  status,
  questionCount,
  canDelete,
}: {
  formId: string
  status: string
  questionCount: number
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const published = status !== "DRAFT"

  const setStatus = (next: "DRAFT" | "PUBLISHED") => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("formId", formId)
      formData.set("status", next)
      const result = await setFormStatus(formData)
      if (result.ok) {
        toast.success(
          next === "PUBLISHED"
            ? "Published. The client can now fill it in."
            : "Moved back to draft. The client can no longer see it.",
        )
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this onboarding form? Every question and answer on it is removed permanently.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set("formId", formId)
      const result = await deleteOnboardingForm(formData)
      if (result.ok) {
        toast.success("Onboarding form deleted.")
        router.refresh()
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
        <Button
          size="sm"
          disabled={pending || questionCount === 0}
          onClick={() => setStatus("PUBLISHED")}
        >
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
