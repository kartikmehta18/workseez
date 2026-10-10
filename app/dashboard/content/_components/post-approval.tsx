"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Loader2, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MAX_COMMENT_LENGTH, type PostApproval as Approval } from "@/lib/content"
import { setPostApproval } from "../actions"

/**
 * The client's sign-off on a post: approve it, or reject it with an optional
 * reason.
 *
 * Separate from the feedback thread below it on purpose. A comment is a
 * conversation; this is the answer to "is this one good to go?", and the team
 * needs to read it off the card without scrolling a thread to work it out.
 *
 * Rejecting asks for the reason in place rather than in a dialog — the client is
 * already looking at the thing they are rejecting, and a dialog would cover it.
 */
export function PostApproval({
  postId,
  approval,
  note,
  decidedLabel,
  canDecide,
  isTeam,
}: {
  postId: string
  approval: Approval | null
  note: string | null
  /** When the decision was made, already formatted. */
  decidedLabel: string | null
  canDecide: boolean
  /** Only changes the wording — the team reads about the client, the client about themselves. */
  isTeam: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const [rejecting, setRejecting] = React.useState(false)
  const [reason, setReason] = React.useState("")

  const decide = (decision: Approval | "", message: string) => {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("postId", postId)
      formData.set("decision", decision)
      formData.set("reason", decision === "REJECTED" ? reason : "")
      const result = await setPostApproval(formData)
      if (result.ok) {
        toast.success(message)
        setRejecting(false)
        setReason("")
      } else {
        toast.error(result.error)
      }
    })
  }

  const heading = (
    <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
      Approval
    </h4>
  )

  if (approval) {
    const approved = approval === "APPROVED"
    return (
      <div>
        {heading}
        <div
          className={cn(
            "mt-2 rounded-lg border px-4 py-3 text-sm",
            approved
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-medium">
              {approved ? <Check className="size-4" /> : <X className="size-4" />}
              {approved ? "Approved" : "Rejected"}
              {decidedLabel ? <span className="font-normal opacity-80">· {decidedLabel}</span> : null}
            </p>
            {canDecide ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => decide("", "Decision cleared.")}
              >
                {pending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Change decision
              </Button>
            ) : null}
          </div>
          {!approved && note ? (
            <p className="mt-2 leading-relaxed whitespace-pre-wrap wrap-break-word">
              <span className="font-medium">Reason: </span>
              {note}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (!canDecide) return null

  return (
    <div>
      {heading}
      <div className="mt-2 rounded-lg border p-4">
        <p className="text-muted-foreground text-sm">
          {isTeam
            ? "The client hasn't approved or rejected this post yet."
            : "Happy with this post? Approve it, or reject it and tell your team what to change."}
        </p>

        {rejecting ? (
          <div className="mt-3 grid gap-2">
            <Label htmlFor={`reject-reason-${postId}`}>
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id={`reject-reason-${postId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="What should change?"
              className="min-h-20 resize-y"
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                onClick={() => decide("REJECTED", "Post rejected.")}
              >
                {pending ? <Loader2 className="animate-spin" /> : <X />} Confirm reject
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setRejecting(false)
                  setReason("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => decide("APPROVED", "Post approved.")}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check />} Approve
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setRejecting(true)}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            >
              <X /> Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
