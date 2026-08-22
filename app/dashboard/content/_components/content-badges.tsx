import { SiInstagram, SiX, SiYoutube } from "@icons-pack/react-simple-icons"
import { Clapperboard, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  CONTENT_KIND_LABELS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_STATUS_LABELS,
  normalizeStatusForKind,
  toContentKind,
  toContentPlatform,
  toContentStatus,
  type ContentPlatform,
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
 *
 * The designed track is coloured to rhyme with the filmed one rather than to
 * stand apart from it: a calendar mixes reels and carousels in one list, and
 * what a reader wants from the colour is how far along a post is, not which
 * pipeline it happens to be on. So CONTENT_TOPICS takes the same amber as
 * SCRIPTING (both are "just started, ours"), and DESIGNING the same indigo as
 * IN_PRODUCTION (both are "being made"). Only CONTENT_RESEARCH needs a shade of
 * its own, and violet sits between the two without colliding with rose or sky.
 *
 * CAPTIONING is orange: it is on both tracks, and its neighbours there are
 * indigo before and sky after, so it has to differ from those two and from the
 * emerald beyond them. That leaves it only mildly close to amber, which is
 * never adjacent to it — amber opens a track, orange sits near the end of one.
 */
const STATUS_STYLES: Record<ContentStatus, string> = {
  SCRIPTING: "border-amber-200 bg-amber-50 text-amber-700",
  SHOOT_PENDING: "border-rose-200 bg-rose-50 text-rose-700",
  IN_PRODUCTION: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CONTENT_TOPICS: "border-amber-200 bg-amber-50 text-amber-700",
  CONTENT_RESEARCH: "border-violet-200 bg-violet-50 text-violet-700",
  DESIGNING: "border-indigo-200 bg-indigo-50 text-indigo-700",
  CAPTIONING: "border-orange-200 bg-orange-50 text-orange-700",
  SCHEDULED: "border-sky-200 bg-sky-50 text-sky-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

export function PostStatusBadge({
  status,
  kind,
  className,
}: {
  status: string | null | undefined
  /**
   * The post's type, where the caller has it. Statuses belong to one track or
   * the other, so this is what stops a row still stored as "Scripting" from
   * showing that word on a carousel. Callers reading a PostView are already
   * normalized; this is for the two places that render a status straight off
   * the query.
   */
  kind?: string | null
  className?: string
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground font-medium", className)}>
        Not created
      </Badge>
    )
  }
  const resolved = normalizeStatusForKind(toContentKind(kind), toContentStatus(status))
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

/**
 * Which channel the post goes out on.
 *
 * Each platform's own brand colour rather than the status scale: this badge
 * answers a different question from the rest of the row, and a client scanning
 * for "the LinkedIn ones" finds them by colour before they read the word.
 * lucide-react dropped its brand icons, so the mark is a dot, not a logo.
 */
const PLATFORM_STYLES: Record<ContentPlatform, { badge: string; dot: string }> = {
  INSTAGRAM: { badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", dot: "bg-fuchsia-500" },
  LINKEDIN: { badge: "border-blue-200 bg-blue-50 text-blue-700", dot: "bg-blue-600" },
  YOUTUBE: { badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-600" },
  TWITTER: { badge: "border-slate-300 bg-slate-100 text-slate-800", dot: "bg-slate-900" },
}

/** The coloured dot on its own, for the platform badge. */
export function PlatformDot({ platform, className }: { platform: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        PLATFORM_STYLES[toContentPlatform(platform)].dot,
        className,
      )}
    />
  )
}

/**
 * LinkedIn's mark, hand-drawn because Simple Icons had to drop it from the set
 * — see the note in components/ui/social-icon.tsx. That file falls back to a
 * globe; the platform tabs cannot, because a globe sitting between three brand
 * logos reads as "some other channel" rather than "LinkedIn".
 */
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451c.978 0 1.778-.773 1.778-1.729V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  )
}

const PLATFORM_MARKS: Record<
  ContentPlatform,
  { Icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  INSTAGRAM: { Icon: SiInstagram, color: "text-fuchsia-500" },
  LINKEDIN: { Icon: LinkedInMark, color: "text-blue-600" },
  YOUTUBE: { Icon: SiYoutube, color: "text-red-600" },
  // X's mark is black-on-white by brand, so it follows the text colour rather
  // than pinning a slate that would vanish on a dark background.
  TWITTER: { Icon: SiX, color: "text-foreground" },
}

/** The channel's brand mark, in its own colour — for the platform tabs. */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  // Picked from a module-scope map, so the element type is stable across
  // renders and React never remounts the icon.
  const { Icon, color } = PLATFORM_MARKS[toContentPlatform(platform)]
  return <Icon className={cn("size-3.5 shrink-0", color, className)} />
}

export function PostPlatformBadge({
  platform,
  className,
}: {
  platform: string
  className?: string
}) {
  const resolved = toContentPlatform(platform)
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 font-medium", PLATFORM_STYLES[resolved].badge, className)}
    >
      <PlatformDot platform={resolved} />
      {CONTENT_PLATFORM_LABELS[resolved]}
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
