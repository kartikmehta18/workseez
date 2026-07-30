"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  type ContentStatus,
  type PostView,
} from "@/lib/content"

/**
 * The month view.
 *
 * Built from plain arithmetic on a Date rather than a calendar library: the
 * whole requirement is "six rows of seven days, Monday first", and the nearest
 * library is 40 kB of locale data for that.
 *
 * Weeks start on Monday because the agency plans in Mon–Sun cycles, and a
 * Sunday-first grid puts the two quietest days at opposite ends of the row.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const DOT_STYLES: Record<ContentStatus, string> = {
  SCRIPTING: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  SHOOT_PENDING: "bg-rose-100 text-rose-800 hover:bg-rose-200",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  SCHEDULED: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
}

/** yyyy-mm-dd in local time, matching PostView.scheduledDate. */
function isoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The 42 days covering a month, padded out to whole Monday-start weeks. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-based; shift it so Monday is 0.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function CalendarGrid({
  posts,
  initialMonth,
  onSelect,
}: {
  posts: PostView[]
  /** yyyy-mm-dd to open on — the selected cycle's start, usually. */
  initialMonth: string | null
  onSelect: (postId: string) => void
}) {
  const monthOf = (iso: string | null) => {
    const seed = iso ? new Date(`${iso}T00:00:00`) : new Date()
    const date = Number.isNaN(seed.getTime()) ? new Date() : seed
    return new Date(date.getFullYear(), date.getMonth(), 1)
  }

  const [cursor, setCursor] = React.useState(() => monthOf(initialMonth))
  const [lastMonth, setLastMonth] = React.useState(initialMonth)

  // The grid follows the cycle dropdown: picking cycle 4 should land on the
  // month cycle 4 starts in, not leave the grid wherever it was. Adjusted
  // during render rather than in an effect — an effect would paint the old
  // month first and then immediately re-render over it.
  if (initialMonth !== lastMonth) {
    setLastMonth(initialMonth)
    if (initialMonth) setCursor(monthOf(initialMonth))
  }

  const byDate = React.useMemo(() => {
    const map = new Map<string, PostView[]>()
    for (const post of posts) {
      if (!post.scheduledDate) continue
      const bucket = map.get(post.scheduledDate)
      if (bucket) bucket.push(post)
      else map.set(post.scheduledDate, [post])
    }
    return map
  }, [posts])

  const days = React.useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  )

  const shift = (delta: number) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

  const today = isoDate(new Date())
  const undated = posts.filter((post) => !post.scheduledDate)

  return (
    <div className="bg-card rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="font-medium">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shift(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => shift(1)}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* The grid keeps its own horizontal scroll: seven readable columns need
          more than a 360px phone has, and letting the page scroll sideways
          instead would take the whole dashboard with it. */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px] p-3">
          <div className="text-muted-foreground grid grid-cols-7 gap-1 text-[11px] font-semibold tracking-wider uppercase">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-1 text-center">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((date) => {
              const key = isoDate(date)
              const inMonth = date.getMonth() === cursor.getMonth()
              const entries = byDate.get(key) ?? []

              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 rounded-lg border p-1.5",
                    inMonth ? "bg-background" : "bg-muted/30 opacity-60",
                    key === today && "border-primary/50 ring-primary/20 ring-2",
                  )}
                >
                  <div
                    className={cn(
                      "px-0.5 text-xs tabular-nums",
                      key === today ? "text-primary font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {date.getDate()}
                  </div>
                  <div className="mt-1 space-y-1">
                    {entries.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => onSelect(post.id)}
                        title={`${CONTENT_KIND_LABELS[post.kind]} · ${CONTENT_STATUS_LABELS[post.status]} — ${post.title}`}
                        className={cn(
                          "block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight font-medium transition-colors",
                          DOT_STYLES[post.status],
                        )}
                      >
                        {post.title}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 ? (
        <div className="border-t px-4 py-3">
          <p className="text-muted-foreground text-xs font-medium">
            Not dated yet — {undated.length} {undated.length === 1 ? "post" : "posts"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {undated.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelect(post.id)}
                className={cn(
                  "max-w-full truncate rounded px-2 py-1 text-xs font-medium transition-colors",
                  DOT_STYLES[post.status],
                )}
              >
                {post.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
