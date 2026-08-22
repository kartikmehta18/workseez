"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  type ContentStatus,
  type PostView,
} from "@/lib/content"
import { PlatformDot } from "./content-badges"

/**
 * The month view.
 *
 * Built from plain arithmetic on a Date rather than a calendar library: the
 * whole requirement is "whole Monday-start weeks", and the nearest library is
 * 40 kB of locale data for that.
 *
 * Weeks start on Monday because the agency plans in Mon–Sun cycles, and a
 * Sunday-first grid puts the two quietest days at opposite ends of the row.
 *
 * Drawn as one continuous lattice — hairline dividers between squares rather
 * than a gap between 42 little rounded cards — because a client reading their
 * month wants it to look like a calendar, and the gaps made every square read
 * as a separate thing to inspect.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** The same scale PostStatusBadge uses — see the note on STATUS_STYLES there. */
const DOT_STYLES: Record<ContentStatus, string> = {
  SCRIPTING: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  SHOOT_PENDING: "bg-rose-100 text-rose-800 hover:bg-rose-200",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  CONTENT_TOPICS: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  CONTENT_RESEARCH: "bg-violet-100 text-violet-800 hover:bg-violet-200",
  DESIGNING: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
  CAPTIONING: "bg-orange-100 text-orange-800 hover:bg-orange-200",
  SCHEDULED: "bg-sky-100 text-sky-800 hover:bg-sky-200",
  PUBLISHED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
}

/** The legend's swatch — the chip colour without the interactive states. */
const LEGEND_STYLES: Record<ContentStatus, string> = {
  SCRIPTING: "bg-amber-200",
  SHOOT_PENDING: "bg-rose-200",
  IN_PRODUCTION: "bg-indigo-200",
  CONTENT_TOPICS: "bg-amber-200",
  CONTENT_RESEARCH: "bg-violet-200",
  DESIGNING: "bg-indigo-200",
  CAPTIONING: "bg-orange-200",
  SCHEDULED: "bg-sky-200",
  PUBLISHED: "bg-emerald-200",
}

/** yyyy-mm-dd in local time, matching PostView.scheduledDate. */
function isoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The whole weeks a month spans — five rows most of the time, six when it needs
 * them, four for a February that starts on a Monday. Always drawing six left a
 * blank row of greyed-out next-month days under most months, which reads as
 * part of the calendar and is nothing but noise.
 */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-based; shift it so Monday is 0.
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((lead + daysInMonth) / 7)
  const start = new Date(year, month, 1 - lead)

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function CalendarGrid({
  posts,
  initialMonth,
  onSelect,
  onAdd,
}: {
  posts: PostView[]
  /** yyyy-mm-dd to open on — the selected cycle's start, usually. */
  initialMonth: string | null
  onSelect: (postId: string) => void
  /**
   * Team only. Adds a post already dated to the square that was tapped, which
   * is the one thing planning a cycle in the month view kept having to leave
   * the month view to do.
   */
  onAdd?: (date: string) => void
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

  /** Only the statuses actually on screen — a key to eight colours explains nothing. */
  const legend = React.useMemo(
    () => CONTENT_STATUSES.filter((status) => posts.some((post) => post.status === status)),
    [posts],
  )

  const shift = (delta: number) =>
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))

  const today = isoDate(new Date())
  const undated = posts.filter((post) => !post.scheduledDate)

  // On the ISO prefix rather than by re-parsing every date — the same reason
  // scheduledDate is carried as a string in the first place.
  const monthPrefix = isoDate(cursor).slice(0, 7)
  const inMonthCount = posts.filter((post) => post.scheduledDate?.startsWith(monthPrefix)).length

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-medium">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h3>
          <p className="text-muted-foreground text-xs">
            {inMonthCount === 0
              ? "Nothing planned this month"
              : `${inMonthCount} ${inMonthCount === 1 ? "post" : "posts"} this month`}
          </p>
        </div>
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
        <div className="min-w-160">
          <div className="text-muted-foreground bg-muted/40 grid grid-cols-7 border-y text-[11px] font-semibold tracking-wider uppercase">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={cn("py-2 text-center", index > 0 && "border-l")}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const key = isoDate(date)
              const inMonth = date.getMonth() === cursor.getMonth()
              const isToday = key === today
              const isWeekend = index % 7 >= 5
              const entries = byDate.get(key) ?? []

              return (
                <div
                  key={key}
                  className={cn(
                    "group/day flex min-h-28 flex-col p-1.5",
                    // Hairlines only between squares, never around the outside —
                    // the container's own border is the frame.
                    index % 7 !== 0 && "border-l",
                    index < days.length - 7 && "border-b",
                    !inMonth && "bg-muted/40",
                    inMonth && isWeekend && "bg-muted/15",
                  )}
                >
                  {/* Today is a filled pill on the number rather than a ring
                      around the square: at this size a ring competed with the
                      chips inside it for the eye. */}
                  <span
                    className={cn(
                      "mb-1 grid size-5 shrink-0 place-items-center rounded-full text-xs tabular-nums",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                      !isToday && inMonth && "text-foreground/70",
                      !isToday && !inMonth && "text-muted-foreground/50",
                    )}
                  >
                    {date.getDate()}
                  </span>

                  <div className="space-y-1">
                    {entries.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => onSelect(post.id)}
                        title={`${CONTENT_KIND_LABELS[post.kind]} · ${CONTENT_STATUS_LABELS[post.status]} — ${post.title}`}
                        className={cn(
                          "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] leading-tight font-medium transition-colors",
                          DOT_STYLES[post.status],
                        )}
                      >
                        <PlatformDot platform={post.platform} className="size-1.5" />
                        <span className="truncate">{post.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Sits at the foot of the square whatever is above it, so the
                      button is in the same place in every column. Kept faint
                      until the square is hovered or the button is tabbed to —
                      thirty of these at full strength would out-shout the posts
                      they are there to add to. */}
                  {onAdd && inMonth ? (
                    <button
                      type="button"
                      onClick={() => onAdd(key)}
                      aria-label={`Add a post on ${date.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                      })}`}
                      className="text-muted-foreground/40 hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 group-hover/day:text-muted-foreground/80 group-focus-within/day:text-muted-foreground/80 mt-auto flex items-center justify-center gap-1 rounded py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Plus className="size-3" />
                      <span className="opacity-0 transition-opacity group-hover/day:opacity-100 group-focus-within/day:opacity-100">
                        Add
                      </span>
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {legend.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-4 py-2.5">
          {legend.map((status) => (
            <span key={status} className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className={cn("size-2.5 rounded-full", LEGEND_STYLES[status])} />
              {CONTENT_STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      ) : null}

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
                  "flex max-w-full items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
                  DOT_STYLES[post.status],
                )}
              >
                <PlatformDot platform={post.platform} className="size-1.5" />
                <span className="truncate">{post.title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
