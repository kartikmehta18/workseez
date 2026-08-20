"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MAX_COMMENT_LENGTH, type ThreadComment } from "@/lib/strategy"
import { addComment, deleteComment } from "../actions"

/**
 * The single feedback conversation on a sheet — the client raises what they
 * want changed, the team answers.
 *
 * Client comments are aligned and tinted differently from team comments so the
 * two sides of the conversation are legible at a glance. `authorRole` drives
 * that rather than the author record, so a comment from a since-deleted account
 * still renders on the correct side.
 */
export function FeedbackThread({
  sheetId,
  comments,
  canPost,
  viewerRole,
  emptyHint,
}: {
  sheetId: string
  comments: ThreadComment[]
  canPost: boolean
  viewerRole: string
  emptyHint: string
}) {
  const [pending, startTransition] = React.useTransition()
  const [body, setBody] = React.useState("")

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set("sheetId", sheetId)
      formData.set("body", trimmed)
      const result = await addComment(formData)
      if (result.ok) {
        // Cleared only on success, so a failed post doesn't lose what they wrote.
        setBody("")
      } else {
        toast.error(result.error)
      }
    })
  }

  const onDelete = (commentId: string) => {
    if (!window.confirm("Delete this feedback?")) return
    startTransition(async () => {
      const formData = new FormData()
      formData.set("commentId", commentId)
      const result = await deleteComment(formData)
      if (result.ok) {
        toast.success("Feedback deleted.")
      } else {
        toast.error(result.error)
      }
    })
  }

  const viewerIsClient = viewerRole === "CLIENT"

  return (
    <section className="bg-card rounded-xl border shadow-sm">
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <MessageSquare className="text-muted-foreground size-4 shrink-0" />
        <h2 className="font-medium">Feedback</h2>
        {comments.length > 0 ? (
          <span className="text-muted-foreground text-sm tabular-nums">({comments.length})</span>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {comments.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{emptyHint}</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => {
              const fromClient = comment.authorRole === "CLIENT"
              // "Mine" is by side of the conversation, not by user id — a
              // second admin replying should still look like the team.
              const mine = fromClient === viewerIsClient

              return (
                <li
                  key={comment.id}
                  className={cn("flex gap-3", mine && "flex-row-reverse")}
                >
                  <Avatar className="size-8 shrink-0">
                    {comment.authorAvatar ? (
                      <AvatarImage src={comment.authorAvatar} alt="" />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "text-xs font-medium",
                        fromClient ? "bg-primary/10 text-primary" : "bg-muted",
                      )}
                    >
                      {(comment.authorName ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className={cn("min-w-0 max-w-[85%]", mine && "text-right")}>
                    <div
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs",
                        mine && "justify-end",
                      )}
                    >
                      <span className="font-medium">{comment.authorName ?? "Removed user"}</span>
                      <span className="text-muted-foreground">
                        {fromClient ? "Client" : "Team"} · {comment.createdAt}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 inline-block rounded-lg border px-3 py-2 text-left text-sm leading-relaxed whitespace-pre-wrap",
                        fromClient ? "bg-primary/5 border-primary/15" : "bg-muted/50",
                      )}
                    >
                      {comment.body}
                    </div>
                    {comment.canDelete ? (
                      <div className={cn("mt-0.5", mine && "flex justify-end")}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => onDelete(comment.id)}
                          className="text-muted-foreground hover:text-destructive h-6 px-1.5 text-xs"
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canPost ? (
          <form onSubmit={onSubmit} className="mt-5 border-t pt-4">
            <Textarea
              value={body}
              maxLength={MAX_COMMENT_LENGTH}
              disabled={pending}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                viewerIsClient
                  ? "Anything you'd like changed, or questions on the strategy?"
                  : "Reply to the client…"
              }
              aria-label="Your feedback"
              className="min-h-24 resize-y"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-xs">
                {body.length > MAX_COMMENT_LENGTH - 200
                  ? `${MAX_COMMENT_LENGTH - body.length} characters left`
                  : ""}
              </span>
              <Button type="submit" size="sm" disabled={pending || !body.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : <Send />}
                {pending ? "Sending…" : "Send feedback"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  )
}
