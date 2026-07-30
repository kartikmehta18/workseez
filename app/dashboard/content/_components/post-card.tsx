"use client"

import { CalendarDays, ChevronDown, ExternalLink, FileText, FolderOpen, Video } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { VIDEO_KINDS, type PostView } from "@/lib/content"
import { PostKindBadge, PostStatusBadge, RawUploadBadge, SharedBadge } from "./content-badges"
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
 */
export function PostCard({
  post,
  viewerRole,
  canManage,
  canDelete,
  canComment,
  driveEnabled,
  open,
  onToggle,
}: {
  post: PostView
  viewerRole: string
  canManage: boolean
  canDelete: boolean
  canComment: boolean
  driveEnabled: boolean
  open: boolean
  onToggle: () => void
}) {
  const bodyId = `post-body-${post.id}`

  const isVideo = VIDEO_KINDS.includes(post.kind)
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
        onClick={onToggle}
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
            {post.assets.length > 0 ? (
              <span>
                {post.assets.length} {post.assets.length === 1 ? "file" : "files"}
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
          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <PostControls
                postId={post.id}
                status={post.status}
                shared={post.shared}
                canDelete={canDelete}
              />
              <PostEditor post={post} />
            </div>
          ) : null}

          {post.needsRawUpload && !canManage ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Your team is waiting on footage for this one. Upload it below and they&apos;ll take it
              from there.
            </p>
          ) : null}

          {showUpload ? (
            <RawUpload
              postId={post.id}
              postTitle={post.title}
              folderUrl={post.rawFolderUrl}
              assets={post.assets}
              driveEnabled={driveEnabled}
              urgent={post.needsRawUpload}
            />
          ) : null}

          {(post.rawFileUrl || post.finalEditUrl || post.editsFolderUrl) ? (
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

          <div>
            <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Script
            </h4>
            <ScriptView lines={post.script} className="mt-2" />
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

          {/* Server-stripped for clients, so this block simply never renders for
              them — the prop is null, not merely hidden. */}
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
            comments={post.comments}
            canPost={canComment}
            viewerRole={viewerRole}
            compact
            emptyHint={
              canManage
                ? "No feedback on this one yet."
                : "Nothing here yet. Anything you'd like changed — say so and your team will pick it up."
            }
          />
        </div>
      ) : null}
    </li>
  )
}
