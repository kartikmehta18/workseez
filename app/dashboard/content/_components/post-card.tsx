"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Video,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { contentBlockTitle, isVideoKind, type PostDetail, type PostView } from "@/lib/content"
import { loadPostDetail } from "../actions"
import {
  PostKindBadge,
  PostPlatformBadge,
  PostStatusBadge,
  RawUploadBadge,
  SharedBadge,
} from "./content-badges"
import { PostControls } from "./post-controls"
import { PostEditor } from "./post-editor"
import { PostFeedback } from "./post-feedback"
import { RawUpload } from "./raw-upload"
import { ScriptView } from "./script-view"

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const

function LinkButton({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: typeof FileText
}) {
  return (
    <a
      href={href}
      {...EXTERNAL}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-w-full")}
    >
      <Icon className="text-muted-foreground" />
      <span className="truncate">{label}</span>
      <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
    </a>
  )
}

/**
 * Fetches the script, files and feedback for a card the first time it opens.
 *
 * The list deliberately no longer carries them: a cycle is nine or ten posts,
 * and loading every script line, every comment with its author and every
 * uploaded file for all of them — to render cards that start collapsed — was
 * most of what the calendar page spent its time on.
 *
 * Kept once fetched, so closing and reopening a card is instant. `version` is
 * bumped by the list after a mutation, which is what re-fetches a thread the
 * reader has just posted to.
 */
function usePostDetail(postId: string, open: boolean, version: number) {
  const [detail, setDetail] = React.useState<PostDetail | null>(null)
  const [loading, setLoading] = React.useState(false)
  const loadedVersion = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!open || loadedVersion.current === version) return

    let cancelled = false
    loadedVersion.current = version
    setLoading(true)

    loadPostDetail(postId)
      .then((result) => {
        if (cancelled) return
        if (result.ok) {
          setDetail(result.detail)
        } else {
          // Let the next open try again rather than leaving the card empty.
          loadedVersion.current = null
          toast.error(result.error)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [postId, open, version])

  return { detail, loading }
}

function DetailSkeleton() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm" role="status">
      <Loader2 className="size-4 animate-spin" />
      Loading post…
    </div>
  )
}

/**
 * One post, collapsed to its headline and expanded to everything on it.
 *
 * Collapsed by default because a cycle is nine or ten of these and the client's
 * first job is to scan the list; the script, the files and the feedback thread
 * are all one tap away. The whole header is the toggle — a small chevron target
 * is the wrong control on a phone, which is where most clients read this.
 *
 * Open state is owned by the list, not by the card: tapping a day in the month
 * view has to be able to open the post it belongs to, and "expand all" has to
 * reach every card at once.
 *
 * Memoised because the list re-renders on every keystroke in its filter box,
 * and an expanded card is an expensive thing to rebuild — a Radix dialog, a
 * select, an upload panel and a whole feedback thread. `onToggle` takes the id
 * so the list can pass one stable callback rather than a fresh closure per card,
 * which is what would defeat the memo.
 */
export const PostCard = React.memo(function PostCard({
  post,
  viewerRole,
  canManage,
  canDelete,
  canComment,
  driveEnabled,
  open,
  detailVersion,
  onToggle,
}: {
  post: PostView
  viewerRole: string
  canManage: boolean
  canDelete: boolean
  canComment: boolean
  driveEnabled: boolean
  open: boolean
  detailVersion: number
  onToggle: (postId: string) => void
}) {
  const bodyId = `post-body-${post.id}`
  const { detail, loading } = usePostDetail(post.id, open, detailVersion)

  const isVideo = isVideoKind(post.kind)
  // The client only gets the upload panel when it is asked for; the team always
  // has it, so they can drop an edit or a stand-in file in themselves.
  const showUpload = isVideo && (canManage || post.needsRawUpload)

  return (
    <li
      id={`post-${post.id}`}
      className={cn(
        "bg-card scroll-mt-20 overflow-hidden rounded-xl border transition-shadow",
        open && "shadow-sm",
        post.needsRawUpload && !canManage && "border-rose-200",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(post.id)}
        aria-expanded={open}
        aria-controls={bodyId}
        className={cn(
          "hover:bg-muted/40 flex w-full items-start gap-3 p-4 text-left transition-colors sm:p-5",
          open && "bg-muted/30",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <PostStatusBadge status={post.status} />
            {/* Shown to both sides, unlike the kind badge — which channel a post
                goes out on is the client's own question, not working detail. */}
            <PostPlatformBadge platform={post.platform} />
            {post.needsRawUpload ? <RawUploadBadge /> : null}
            {canManage ? (
              <>
                <PostKindBadge kind={post.kind} />
                <SharedBadge shared={post.shared} />
              </>
            ) : null}
          </div>

          <p className="mt-2 text-base leading-snug font-semibold tracking-tight wrap-break-word">
            {post.title}
          </p>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {post.scheduledLabel ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {post.scheduledLabel}
              </span>
            ) : (
              <span className="italic">No date yet</span>
            )}
            {post.commentCount > 0 ? <span>{post.commentCount} feedback</span> : null}
            {post.assetCount > 0 ? (
              <span>
                {post.assetCount} {post.assetCount === 1 ? "file" : "files"}
              </span>
            ) : null}
          </div>
        </div>

        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground mt-1 size-5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div id={bodyId} className="space-y-5 border-t p-4 sm:p-5">
          {detail === null ? (
            loading ? (
              <DetailSkeleton />
            ) : null
          ) : (
            <>
              {canManage ? (
                <div className="flex flex-wrap items-center gap-2">
                  <PostControls
                    postId={post.id}
                    kind={post.kind}
                    status={post.status}
                    shared={post.shared}
                    canDelete={canDelete}
                  />
                  <PostEditor post={post} script={detail.script} />
                </div>
              ) : null}

              {post.needsRawUpload && !canManage ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  Your team is waiting on footage for this one. Upload it below and they&apos;ll
                  take it from there.
                </p>
              ) : null}

              {showUpload ? (
                <RawUpload
                  postId={post.id}
                  postTitle={post.title}
                  folderUrl={post.rawFolderUrl}
                  assets={detail.assets}
                  driveEnabled={driveEnabled}
                  urgent={post.needsRawUpload}
                />
              ) : null}

              {post.rawFileUrl || post.finalEditUrl || post.editsFolderUrl ? (
                <div className="flex flex-wrap gap-2">
                  {post.rawFileUrl ? (
                    <LinkButton href={post.rawFileUrl} label="Raw file" icon={Video} />
                  ) : null}
                  {post.finalEditUrl ? (
                    <LinkButton href={post.finalEditUrl} label="Final edit" icon={FileText} />
                  ) : null}
                  {post.editsFolderUrl ? (
                    <LinkButton href={post.editsFolderUrl} label="Edits folder" icon={FolderOpen} />
                  ) : null}
                </div>
              ) : null}

              {/* "Script" on a reel, "Content" on a post or carousel — the
                  client reads this block too, so it has to name what they are
                  actually looking at. */}
              <div>
                <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  {contentBlockTitle(post.kind)}
                </h4>
                <ScriptView lines={detail.script} kind={post.kind} className="mt-2" />
              </div>

              {post.caption ? (
                <div>
                  <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Caption
                  </h4>
                  <p className="bg-muted/40 mt-2 rounded-lg border px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                    {post.caption}
                  </p>
                </div>
              ) : null}

              {/* Server-stripped for clients, so this block simply never renders
                  for them — the prop is null, not merely hidden. */}
              {post.notes ? (
                <div>
                  <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                    Internal notes · team only
                  </h4>
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-amber-900">
                    {post.notes}
                  </p>
                </div>
              ) : null}

              <PostFeedback
                postId={post.id}
                comments={detail.comments}
                canPost={canComment}
                viewerRole={viewerRole}
                compact
                emptyHint={
                  canManage
                    ? "No feedback on this one yet."
                    : "Nothing here yet. Anything you'd like changed — say so and your team will pick it up."
                }
              />
            </>
          )}
        </div>
      ) : null}
    </li>
  )
})
