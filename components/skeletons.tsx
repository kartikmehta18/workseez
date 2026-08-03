import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Route-level loading skeletons.
 *
 * Every one of these mirrors the real page's container width, spacing and block
 * order, because that is the whole point: a skeleton that does not match what
 * lands causes a visible reflow the moment the data arrives, which reads worse
 * than a spinner. When you change a page's layout, change its skeleton.
 *
 * Built on the shadcn Skeleton primitive rather than a skeleton library so the
 * shimmer inherits `bg-muted` and follows the light/dark theme for free.
 *
 * Screen readers get one polite "Loading" per page from PageSkeleton — the bars
 * themselves are decorative and stay out of the accessibility tree.
 */

/**
 * Offsets the sweep per row so a list ripples instead of flashing in unison.
 * Wraps every sixth item, which is enough to look organic without the last row
 * of a long list lagging half a second behind the first.
 */
const stagger = (index: number) => ({ animationDelay: `${(index % 6) * 90}ms` })

/** The outer wrapper. Announces once, and matches the page's own max width. */
export function PageSkeleton({
  children,
  className,
  width = "max-w-6xl",
}: {
  children: React.ReactNode
  className?: string
  /** The page's own `max-w-*`, so the skeleton does not jump on swap. */
  width?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("mx-auto w-full", width, className)}
    >
      <span className="sr-only">Loading</span>
      {children}
    </div>
  )
}

/** Title, subtitle and the action button most pages carry top-right. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-32 rounded-md" /> : null}
    </div>
  )
}

/**
 * The header every client sub-page shares: a back link to the client, the
 * document title, the client's name underneath, and the actions on the right.
 */
export function ClientSubPageHeaderSkeleton({ actions = 2 }: { actions?: number }) {
  return (
    <>
      <Skeleton className="-ml-2 h-8 w-36 rounded-md" />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-full space-y-2 sm:basis-auto">
          <Skeleton className="h-7 w-52 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {Array.from({ length: actions }).map((_, index) => (
            <Skeleton key={index} className="h-9 flex-1 rounded-md sm:w-28 sm:flex-none" />
          ))}
        </div>
      </div>
    </>
  )
}

/** A bordered block of text lines — the shape most content sections take. */
export function CardSkeleton({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-3 rounded-xl border p-4 sm:p-5", className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          // The last line of a paragraph runs short — a stack of full-width
          // bars looks like a table rather than prose.
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
          style={stagger(index)}
        />
      ))}
    </div>
  )
}

/**
 * The clients table. Desktop only, mirroring the real page — below `lg` the
 * card list below takes over, exactly as the loaded table does.
 */
export function TableSkeleton({
  rows = 5,
  columns = 7,
  className = "mt-6 hidden rounded-lg border lg:block",
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex items-center gap-4 px-4 py-3 not-last:border-b"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" style={stagger(row)} />
            <Skeleton className="h-4 w-24" style={stagger(row)} />
          </div>
          {Array.from({ length: columns - 1 }).map((_, cell) => (
            <Skeleton key={cell} className="h-4 flex-1" style={stagger(row)} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** One card per record — the clients list below `lg`, and the calendar grid. */
export function CardGridSkeleton({
  count = 6,
  className = "mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
  avatar = false,
  progress = false,
}: {
  count?: number
  className?: string
  avatar?: boolean
  /** The thin completion bar the calendar, onboarding and strategy cards carry. */
  progress?: boolean
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            {avatar ? (
              <Skeleton className="size-10 shrink-0 rounded-full" style={stagger(index)} />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" style={stagger(index)} />
              <Skeleton className="h-3 w-1/2" style={stagger(index)} />
              <div className="flex flex-wrap gap-2 pt-1.5">
                <Skeleton className="h-5 w-20 rounded-full" style={stagger(index)} />
                <Skeleton className="h-5 w-24 rounded-full" style={stagger(index)} />
              </div>
              {progress ? (
                <Skeleton
                  className="mt-2 h-1.5 w-full rounded-full"
                  style={stagger(index)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The content calendar body: filter toolbar, platform tabs, then post cards.
 * Collapsed cards only — that is how the list actually first paints.
 */
export function PostListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 min-w-0 flex-1 basis-full rounded-md sm:basis-56" />
          <Skeleton className="h-10 basis-full rounded-md sm:w-52 sm:basis-auto" />
          <div className="ml-auto flex w-full items-center justify-between gap-1 sm:w-auto">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>
        </div>
        <div className="mt-3 border-t pt-3">
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      <Skeleton className="h-4 w-72 max-w-full" />

      <div className="space-y-3">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="bg-card rounded-xl border p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-5 w-24 rounded-full" style={stagger(index)} />
                  <Skeleton className="h-5 w-20 rounded-full" style={stagger(index)} />
                </div>
                {/* Titles vary in length; a column of identical bars reads as a
                    table, not a list of posts. */}
                <Skeleton
                  className={cn("h-5", index % 2 === 0 ? "w-3/4" : "w-1/2")}
                  style={stagger(index)}
                />
                <div className="flex flex-wrap gap-3">
                  <Skeleton className="h-3 w-20" style={stagger(index)} />
                  <Skeleton className="h-3 w-16" style={stagger(index)} />
                </div>
              </div>
              <Skeleton className="mt-1 size-5 shrink-0 rounded" style={stagger(index)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A question-and-answer document — the onboarding form and the strategy sheet.
 * Both render as a stack of labelled blocks under a progress bar.
 */
export function DocumentSkeleton({ sections = 4 }: { sections?: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-10" />
        </div>
        <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
      </div>

      {Array.from({ length: sections }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-4 sm:p-5">
          <Skeleton
            className={cn("h-4", index % 3 === 0 ? "w-1/3" : index % 3 === 1 ? "w-2/5" : "w-1/4")}
            style={stagger(index)}
          />
          <Skeleton
            className={cn("w-full rounded-md", index % 2 === 0 ? "h-16" : "h-24")}
            style={stagger(index)}
          />
        </div>
      ))}
    </div>
  )
}

/** Stat tiles — the counts across the top of the team dashboard. */
export function StatsSkeleton({
  count = 3,
  className = "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border p-5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" style={stagger(index)} />
            <Skeleton className="size-8 shrink-0 rounded-lg" style={stagger(index)} />
          </div>
          <Skeleton className="mt-3 h-8 w-12" style={stagger(index)} />
        </div>
      ))}
    </div>
  )
}
