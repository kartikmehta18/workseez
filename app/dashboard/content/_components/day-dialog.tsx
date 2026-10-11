"use client"

import { ArrowRight, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CONTENT_KIND_LABELS, type PostView } from "@/lib/content"
import { KindIcon, PostPlatformBadge, PostStatusBadge } from "./content-badges"

/**
 * One day of the month grid, opened.
 *
 * A square that already has a post on it is two different taps to the team:
 * rework what is there, or put something else on the same day. The grid cannot
 * tell which was meant, so it asks — here, over the month, rather than by
 * dropping them into the list to find the Edit button on a card.
 */
export function DayDialog({
  date,
  posts,
  onClose,
  onView,
  onEdit,
  onAdd,
}: {
  /** yyyy-mm-dd — the square that was tapped. */
  date: string
  posts: PostView[]
  onClose: () => void
  /** Jumps to the post's card in the list, opened. */
  onView: (postId: string) => void
  onEdit: (postId: string) => void
  onAdd: () => void
}) {
  const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {posts.length === 0
              ? "Nothing on this day yet."
              : `${posts.length} ${posts.length === 1 ? "post" : "posts"} on this day. Edit one, or add another.`}
          </DialogDescription>
        </DialogHeader>

        {posts.length > 0 ? (
          <ul className="grid gap-2">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <PostStatusBadge status={post.status} kind={post.kind} platform={post.platform} />
                  <PostPlatformBadge platform={post.platform} />
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <KindIcon kind={post.kind} />
                    {CONTENT_KIND_LABELS[post.kind]}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-snug font-medium wrap-break-word">{post.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => onEdit(post.id)}>
                    <Pencil /> Edit post
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onView(post.id)}>
                    Open in list <ArrowRight />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus /> Add new post
        </Button>
      </DialogContent>
    </Dialog>
  )
}
