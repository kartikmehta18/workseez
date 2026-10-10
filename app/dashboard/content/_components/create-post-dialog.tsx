"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

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
  CONTENT_KIND_LABELS,
  contentKindsForPlatform,
  CONTENT_PLATFORMS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_STATUS_HINTS,
  CONTENT_STATUS_LABELS,
  contentLinkLabels,
  defaultStatusForKind,
  normalizeStatusForKind,
  hasCaption,
  isVideoKind,
  statusesForKind,
  toContentKind,
  toContentPlatform,
  toContentStatus,
  type ContentKind,
  type ContentPlatform,
  type ContentStatus,
} from "@/lib/content"
import { StatusOption, statusFieldClass } from "./content-badges"
import { PostContentEditor, seedDraft } from "./post-content-editor"
import { createPost } from "../actions"

/**
 * Adds a post to a calendar, script and all.
 *
 * The script is written here rather than only in the edit dialog: a strategist
 * adding a reel already has the hooks and the shoot direction in front of them,
 * and making them save an empty post first just to reopen it is a step for the
 * software's benefit, not theirs. Picking the type decides what they get — a
 * reel gets a script skeleton of shoot direction and hooks, a post or a carousel
 * gets the title and copy that go out instead.
 *
 * "Publish now" is off by default. Writing a post and showing it to the client
 * are two decisions, and the wrong default puts unfinished direction in front
 * of them.
 */
export function CreatePostDialog({
  calendarId,
  defaultDate,
  open: controlledOpen,
  onOpenChange,
}: {
  calendarId: string
  /** Pre-fills the date field — usually the selected cycle's start. */
  defaultDate?: string | null
  /**
   * Drives the dialog from outside and drops its own button, which is what the
   * "+" on a day in the month grid uses: the date comes from the square that
   * was tapped, so there is nothing for a header button to open.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)

  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen
  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlled ? null : (
        <DialogTrigger asChild>
          <Button>
            <Plus /> New post
          </Button>
        </DialogTrigger>
      )}
      {/* No max-h override — DialogContent already caps at 100dvh-2rem. A vh cap
          measures the viewport behind mobile browser chrome, which put the
          footer buttons under the address bar on a phone. */}
      <DialogContent
        className="sm:max-w-3xl"
        // A half-written post is too easy to lose to a stray click: this closes
        // only on save, Cancel or the cross, never on the backdrop or Escape.
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        {/* Mounted only while open, so every new post starts from a clean draft
            instead of whatever the last one was left at. */}
        {open ? (
          <NewPostForm
            calendarId={calendarId}
            defaultDate={defaultDate}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** What a new post starts as: LinkedIn, and the first type LinkedIn offers. */
const DEFAULT_PLATFORM: ContentPlatform = "LINKEDIN"
const DEFAULT_KIND: ContentKind = contentKindsForPlatform(DEFAULT_PLATFORM)[0]

function NewPostForm({
  calendarId,
  defaultDate,
  onDone,
}: {
  calendarId: string
  defaultDate?: string | null
  onDone: () => void
}) {
  const [pending, startTransition] = React.useTransition()
  const [kind, setKind] = React.useState<ContentKind>(DEFAULT_KIND)
  const [platform, setPlatform] = React.useState<ContentPlatform>(DEFAULT_PLATFORM)
  const [chosenStatus, setStatus] = React.useState<ContentStatus>(defaultStatusForKind(DEFAULT_KIND, DEFAULT_PLATFORM))

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createPost(formData)
      if (result.ok) {
        toast.success(
          formData.get("publishNow") === "on"
            ? "Post created and published. The client has been emailed."
            : "Post created.",
        )
        onDone()
      } else {
        toast.error(result.error)
      }
    })
  }

  const isVideo = isVideoKind(kind)
  // Read against the current type and platform, so the select can never hold a
  // status its own list does not offer.
  const status = normalizeStatusForKind(kind, platform, chosenStatus)
  const statuses = statusesForKind(kind, platform)
  const linkLabels = contentLinkLabels(kind, platform)

  /**
   * Switching Reel → Post moves the post onto the other track entirely, so a
   * status the new type cannot be in drops back to that track's first step
   * rather than leaving the select showing a value that is no longer on offer.
   */
  const changeKind = (value: string, onPlatform: ContentPlatform = platform) => {
    const next = toContentKind(value)
    setKind(next)
    if (!statusesForKind(next, onPlatform).includes(status)) {
      setStatus(defaultStatusForKind(next, onPlatform))
    }
  }

  /**
   * The platform can move the post onto another track too — LinkedIn has its
   * own statuses whatever the type — so the status is re-checked against the
   * new platform even when the type survives the switch.
   */
  const changePlatform = (value: string) => {
    const next = toContentPlatform(value)
    setPlatform(next)
    const kinds = contentKindsForPlatform(next)
    changeKind(kinds.includes(kind) ? kind : kinds[0], next)
  }

  return (
    <form action={onSubmit}>
      <input type="hidden" name="calendarId" value={calendarId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="status" value={status} />

      <DialogHeader>
        <DialogTitle>New post</DialogTitle>
        <DialogDescription>
          The type you pick decides what gets written: a reel starts with the standard script lines,
          a post or a carousel with a title and its copy.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 py-5">
        <div className="grid gap-2">
          <Label htmlFor="new-post-title">Title</Label>
          <Input
            id="new-post-title"
            name="title"
            required
            maxLength={180}
            placeholder="e.g. Difference between diff tech jobs"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="grid gap-2">
            <Label htmlFor="new-post-platform">Platform</Label>
            <Select
              value={platform}
              onValueChange={changePlatform}
            >
              <SelectTrigger id="new-post-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_PLATFORMS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {CONTENT_PLATFORM_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-post-kind">Type</Label>
            <Select value={kind} onValueChange={(value) => changeKind(value)}>
              <SelectTrigger id="new-post-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contentKindsForPlatform(platform).map((option) => (
                  <SelectItem key={option} value={option}>
                    {CONTENT_KIND_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-post-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(toContentStatus(value))}
            >
              <SelectTrigger id="new-post-status" className={statusFieldClass(status)}>
                <SelectValue />
              </SelectTrigger>
              {/* Only the statuses this type can be in — a carousel is never
                  waiting on a shoot or sitting with an editor. */}
              <SelectContent>
                {statuses.map((option) => (
                  <SelectItem key={option} value={option}>
                    <StatusOption status={option} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-post-date">Planned date</Label>
            <Input
              id="new-post-date"
              name="scheduledFor"
              type="date"
              defaultValue={defaultDate ?? ""}
            />
          </div>
        </div>

        <p className="text-muted-foreground -mt-2 text-xs">
          {CONTENT_STATUS_HINTS[status]}
        </p>

        {isVideo ? (
          <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              name="needsRawUpload"
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">Ask the client for raw footage</span>
              <span className="text-muted-foreground block text-xs">
                Puts the upload panel on their card for this post.
              </span>
            </span>
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="new-post-raw">{linkLabels.rawLink}</Label>
            <Input
              id="new-post-raw"
              name="rawFileUrl"
              type="url"
              placeholder="Optional — add it later"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-post-final">{linkLabels.final} link</Label>
            <Input
              id="new-post-final"
              name="finalEditUrl"
              type="url"
              placeholder="Optional — add it later"
            />
          </div>
        </div>

        {/* Follows the type above: a script for anything filmed, Title and
            Content for a post or a carousel. Re-seeded only while nothing has
            been written, so switching Reel → Story swaps the skeleton but never
            discards anything already typed. */}
        <PostContentEditor
          idPrefix="New"
          kind={kind}
          platform={platform}
          initialLines={seedDraft(DEFAULT_KIND)}
          reseedOnKindChange
        />

        {/* LinkedIn has no caption — the description above is what goes out. */}
        {hasCaption(platform) ? (
          <div className="grid gap-2">
            <Label htmlFor="new-post-caption">Caption</Label>
            <Textarea
              id="new-post-caption"
              name="caption"
              placeholder="Optional. The caption that goes out with the post."
              className="min-h-16 resize-y"
            />
          </div>
        ) : null}

        <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
          <input type="checkbox" name="publishNow" className="accent-primary mt-0.5 size-4" />
          <span>
            <span className="font-medium">Publish to the client straight away</span>
            <span className="text-muted-foreground block text-xs">
              They see it on their calendar and get an email. Leave this off if the script still
              needs work.
            </span>
          </span>
        </label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Creating…" : "Create post"}
        </Button>
      </DialogFooter>
    </form>
  )
}
