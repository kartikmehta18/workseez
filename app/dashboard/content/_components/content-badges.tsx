import { Clapperboard, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  toContentKind,
  toContentStatus,
  type ContentStatus,
} from "@/lib/content"

/**
 * Where a post is in production.
 *
 * The scale matches FormStatusBadge and SheetStatusBadge — amber = ours, sky =
 * waiting on someone, emerald = done — so a client page showing all three
 * features' badges reads consistently. Two statuses sit outside that scale:
 * SHOOT_PENDING is rose because it is the one state that needs the client to
 * act, and IN_PRODUCTION is indigo to separate "being edited" from "waiting".
 */
const STATUS_STYLES: Record<ContentStatus, string> = {
  SCRIPTING: "border-amber-200 bg-amber-50 text-amber-700",
  SHOOT_PENDING: "border-rose-200 bg-rose-50 text-rose-700",
  IN_PRODUCTION: "border-indigo-200 bg-indigo-50 text-indigo-700",
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

export function PostStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground font-medium", className)}>
        Not created
      </Badge>
    )
  }
  const resolved = toContentStatus(status)
  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[11px] font-semibold tracking-wide uppercase",
        STATUS_STYLES[resolved],
        className,
      )}
    >
      {CONTENT_STATUS_LABELS[resolved]}
    </Badge>
  )
}

/** Reel / Post / Carousel — quieter than the status, since it rarely changes. */
export function PostKindBadge({ kind, className }: { kind: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-muted-foreground gap-1 font-medium", className)}>
      <Clapperboard className="size-3" />
      {CONTENT_KIND_LABELS[toContentKind(kind)]}
    </Badge>
  )
}

/**
 * The "upload raw video" call-out. Deliberately the loudest thing on a card:
 * it is the only badge that is a request rather than a report, and a client
 * scanning nine cards needs to spot the two that are waiting on them.
 */
export function RawUploadBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 border-rose-300 bg-rose-100 text-[11px] font-semibold tracking-wide text-rose-700 uppercase",
        className,
      )}
    >
      <Upload className="size-3" />
      Upload raw video
    </Badge>
  )
}

/** Whether the client can see this post yet. Team-side only. */
export function SharedBadge({ shared }: { shared: boolean }) {
  return shared ? (
    <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700">
      Published to client
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground font-medium">
      Draft — hidden
    </Badge>
  )
}

/** Thin published/total bar, matching the onboarding and strategy progress bars. */
export function CalendarProgressBar({
  percent,
  published,
  total,
  className,
}: {
  percent: number
  published: number
  total: number
  className?: string
}) {
  const complete = total > 0 && published === total

  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
        <span>
          {published} of {total} published
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Content calendar progress"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            complete ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
