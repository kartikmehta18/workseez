"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_HINTS,
  CONTENT_STATUS_LABELS,
  toContentKind,
  toContentStatus,
  type ContentKind,
  type PostView,
} from "@/lib/content"
import { ScriptEditor, toDraft } from "./script-editor"
import { savePost } from "../actions"

/**
 * The full post editor — every field on the card, plus the script.
 *
 * A dialog rather than a page: a manager working through a cycle edits eight
 * posts in a row, and a round trip to a detail route and back for each one is
 * the difference between doing it and not bothering.
 *
 * The script itself is ScriptEditor, shared with the create dialog so a post can
 * be written the moment it is added and reworked here later.
 */
export function PostEditor({ post }: { post: PostView }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      {/* See CreatePostDialog — the base dvh cap is the mobile-safe one. */}
      <DialogContent className="sm:max-w-3xl">
        {/* The form is a child so its draft state is created on open and thrown
            away on close. Resetting it in an effect instead would mean the
            dialog paints last session's draft for a frame before correcting
            itself, and would go stale the moment a save changed the post. */}
        {open ? <PostForm post={post} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function PostForm({ post, onDone }: { post: PostView; onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const [kind, setKind] = React.useState<ContentKind>(post.kind)
  const [status, setStatus] = React.useState(post.status)

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await savePost(formData)
      if (result.ok) {
        toast.success("Saved.")
        onDone()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="postId" value={post.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="status" value={status} />

      <DialogHeader>
        <DialogTitle>Edit post</DialogTitle>
        <DialogDescription>
          Everything here is editable at any point, including after the post has gone out. The
          client sees the change the next time they open their calendar.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 py-5">
        <div className="grid gap-2">
          <Label htmlFor={`title-${post.id}`}>Title</Label>
          <Input
            id={`title-${post.id}`}
            name="title"
            defaultValue={post.title}
            required
            maxLength={180}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor={`kind-${post.id}`}>Type</Label>
            <Select value={kind} onValueChange={(value) => setKind(toContentKind(value))}>
              <SelectTrigger id={`kind-${post.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_KINDS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {CONTENT_KIND_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`status-${post.id}`}>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(toContentStatus(value))}>
              <SelectTrigger id={`status-${post.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {CONTENT_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`date-${post.id}`}>Planned date</Label>
            <Input
              id={`date-${post.id}`}
              name="scheduledFor"
              type="date"
              defaultValue={post.scheduledDate ?? ""}
            />
          </div>
        </div>

        <p className="text-muted-foreground -mt-2 text-xs">
          {CONTENT_STATUS_HINTS[status]} Changing the status emails the client, as long as the
          post is already published to them.
        </p>

        <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            name="needsRawUpload"
            defaultChecked={post.needsRawUpload}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            <span className="font-medium">Ask the client for raw footage</span>
            <span className="text-muted-foreground block text-xs">
              Puts the red upload panel on their card for this post.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={`raw-${post.id}`}>Raw file link</Label>
            <Input
              id={`raw-${post.id}`}
              name="rawFileUrl"
              type="url"
              defaultValue={post.rawFileUrl ?? ""}
              placeholder="https://drive.google.com/…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`final-${post.id}`}>Final edit link</Label>
            <Input
              id={`final-${post.id}`}
              name="finalEditUrl"
              type="url"
              defaultValue={post.finalEditUrl ?? ""}
              placeholder="https://drive.google.com/…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`rawfolder-${post.id}`}>Raw folder</Label>
            <Input
              id={`rawfolder-${post.id}`}
              name="rawFolderUrl"
              type="url"
              defaultValue={post.rawFolderUrl ?? ""}
              placeholder="Where the client's uploads land"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`editsfolder-${post.id}`}>Edits folder</Label>
            <Input
              id={`editsfolder-${post.id}`}
              name="editsFolderUrl"
              type="url"
              defaultValue={post.editsFolderUrl ?? ""}
              placeholder="Where the finished cuts live"
            />
          </div>
        </div>

        <ScriptEditor idPrefix="Edit" kind={kind} initialLines={toDraft(post.script)} />

        <div className="grid gap-2">
          <Label htmlFor={`caption-${post.id}`}>Caption</Label>
          <Textarea
            id={`caption-${post.id}`}
            name="caption"
            defaultValue={post.caption ?? ""}
            placeholder="The caption that goes out with the post."
            className="min-h-20 resize-y"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`notes-${post.id}`}>Internal notes</Label>
          <Textarea
            id={`notes-${post.id}`}
            name="notes"
            defaultValue={post.notes ?? ""}
            placeholder="Only your team sees this — never shown to the client."
            className="min-h-16 resize-y"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save post"}
        </Button>
      </DialogFooter>
    </form>
  )
}
