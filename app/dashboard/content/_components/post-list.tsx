"use client"

import * as React from "react"
import { CalendarDays, CalendarRange, List, Search, SlidersHorizontal, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  CONTENT_KINDS,
  CONTENT_KIND_LABELS,
  CONTENT_PLATFORMS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  type CycleOption,
  type PostView,
} from "@/lib/content"
import { CalendarGrid } from "./calendar-grid"
import { PlatformIcon } from "./content-badges"
import { PostCard } from "./post-card"

type View = "list" | "calendar"

/**
 * The calendar body — filters, then either the card list or the month grid.
 *
 * Filtering runs in the browser over the posts already on the page rather than
 * round-tripping to the server. A calendar is a few dozen posts, all of which
 * are needed for the month grid anyway, and typing into a search box that waits
 * on the network feels broken at this size.
 */
export function PostList({
  posts,
  cycles,
  initialCycle,
  viewerRole,
  canManage,
  canDelete,
  canComment,
  driveEnabled,
  emptyTitle,
  emptyHint,
}: {
  posts: PostView[]
  cycles: CycleOption[]
  initialCycle: number | null
  viewerRole: string
  canManage: boolean
  canDelete: boolean
  canComment: boolean
  driveEnabled: boolean
  emptyTitle: string
  emptyHint: string
}) {
  const [view, setView] = React.useState<View>("list")
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("ALL")
  const [kind, setKind] = React.useState("ALL")
  const [platform, setPlatform] = React.useState("ALL")
  const [cycle, setCycle] = React.useState(() => (initialCycle ? String(initialCycle) : "ALL"))
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [showFilters, setShowFilters] = React.useState(false)
  const [openIds, setOpenIds] = React.useState<ReadonlySet<string>>(() => new Set())

  const selectedCycle = cycles.find((option) => String(option.number) === cycle) ?? null

  /**
   * Everything except the platform tabs. Kept separate so the tabs can be built
   * from it: a tab's count is what tapping it would actually show, and a channel
   * with nothing left after the other filters gets no tab at all.
   */
  const beforePlatform = React.useMemo(() => {
    const needle = query.trim().toLowerCase()

    return posts.filter((post) => {
      if (status !== "ALL" && post.status !== status) return false
      if (kind !== "ALL" && post.kind !== kind) return false

      if (selectedCycle) {
        // Undated posts belong to no cycle, so they drop out of a cycle filter
        // rather than pile up in cycle 1.
        if (!post.scheduledDate) return false
        if (post.scheduledDate < selectedCycle.startDate) return false
        if (post.scheduledDate > selectedCycle.endDate) return false
      }

      // ISO dates compare correctly as strings, which is the whole reason
      // scheduledDate is carried in that shape.
      if (from && (!post.scheduledDate || post.scheduledDate < from)) return false
      if (to && (!post.scheduledDate || post.scheduledDate > to)) return false

      if (needle) {
        const haystack = [
          post.title,
          post.caption ?? "",
          post.notes ?? "",
          ...post.script.flatMap((line) => [line.label, line.body]),
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }

      return true
    })
  }, [posts, query, status, kind, selectedCycle, from, to])

  const filtered = React.useMemo(
    () =>
      platform === "ALL"
        ? beforePlatform
        : beforePlatform.filter((post) => post.platform === platform),
    [beforePlatform, platform],
  )

  /**
   * A tab per channel that has something to show — a count of zero means the
   * tab leads nowhere, so it is not drawn at all. The one exception is whatever
   * is currently selected: a tab that vanishes under your finger takes the only
   * way back to "All" with it.
   *
   * Counts come from beforePlatform, so they answer "what would tapping this
   * show" under the filters already set, and the strip stays down to a single
   * channel — one Instagram post and nothing else still gets All + Instagram.
   */
  const platformTabs = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of beforePlatform) {
      counts.set(post.platform, (counts.get(post.platform) ?? 0) + 1)
    }
    return [
      { value: "ALL", label: "All", count: beforePlatform.length },
      ...CONTENT_PLATFORMS.filter(
        (option) => (counts.get(option) ?? 0) > 0 || option === platform,
      ).map((option) => ({
        value: option as string,
        label: CONTENT_PLATFORM_LABELS[option],
        count: counts.get(option) ?? 0,
      })),
    ]
  }, [beforePlatform, platform])

  const toggle = (postId: string) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })

  /** Tapping a day in the month view jumps to that card, opened. */
  const openFromCalendar = (postId: string) => {
    setOpenIds((current) => new Set(current).add(postId))
    setView("list")
    // After the list has rendered — the card does not exist to scroll to yet.
    requestAnimationFrame(() => {
      document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  const filtersActive =
    query !== "" ||
    status !== "ALL" ||
    kind !== "ALL" ||
    platform !== "ALL" ||
    cycle !== "ALL" ||
    from !== "" ||
    to !== ""

  const clearFilters = () => {
    setQuery("")
    setStatus("ALL")
    setKind("ALL")
    setPlatform("ALL")
    setCycle("ALL")
    setFrom("")
    setTo("")
  }

  const countLabel = `${filtered.length} ${filtered.length === 1 ? "post" : "posts"}`

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-card rounded-xl border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* basis-full on a phone so the search owns its own row instead of
              fighting the cycle dropdown for a 300px line. */}
          <div className="relative min-w-0 flex-1 basis-full sm:basis-56">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, scripts and captions…"
              aria-label="Search posts"
              className="pl-9"
            />
          </div>

          {cycles.length > 0 ? (
            <select
              value={cycle}
              onChange={(event) => setCycle(event.target.value)}
              aria-label="Cycle"
              className="border-input bg-background h-10 min-w-0 basis-full rounded-md border px-3 text-sm sm:basis-auto"
            >
              <option value="ALL">All cycles</option>
              {cycles.map((option) => (
                <option key={option.number} value={option.number}>
                  Cycle {option.number} · {option.label}
                  {option.isCurrent ? " — current" : ""}
                </option>
              ))}
            </select>
          ) : null}

          {/* Phone: Filters left, view switch right, on their own row. From sm
              up they ride at the end of the search row as before. */}
          <div className="ml-auto flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal /> Filters
            </Button>
            <div className="bg-muted flex rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "list" ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <List className="size-3.5" /> List
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                aria-pressed={view === "calendar"}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors",
                  view === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground",
                )}
              >
                <CalendarRange className="size-3.5" /> Calendar
              </button>
            </div>
          </div>
        </div>

        {showFilters ? (
          <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-xs font-medium">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm font-normal"
              >
                <option value="ALL">Any status</option>
                {CONTENT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {CONTENT_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium">
              Type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                className="border-input bg-background h-9 rounded-md border px-2 text-sm font-normal"
              >
                <option value="ALL">Any type</option>
                {CONTENT_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {CONTENT_KIND_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium">
              From
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-9"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-medium">
              To
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-9"
              />
            </label>
          </div>
        ) : null}

        <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <span className="tabular-nums">{countLabel}</span>
          {selectedCycle ? (
            <span>
              · Cycle {selectedCycle.number}, {selectedCycle.label}
            </span>
          ) : null}
          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto h-7 px-2 text-xs"
            >
              <X className="size-3" /> Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {/* Platform tabs, as the same segmented control the people directory uses
          for roles: picking a channel is the coarsest cut anyone makes here, so
          it stays one tap away rather than living behind the Filters panel, and
          the counts riding alongside each label make the split obvious without
          opening anything. Horizontally scrollable because four channels plus
          All overflow a phone. */}
      <div
        role="tablist"
        aria-label="Filter by platform"
        className="bg-muted flex w-full gap-1 overflow-x-auto rounded-md p-1 sm:w-fit"
      >
        {platformTabs.map((tab) => {
          const active = platform === tab.value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPlatform(tab.value)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.value === "ALL" ? null : <PlatformIcon platform={tab.value} />}
              {tab.label}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  active ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {view === "calendar" ? (
        <CalendarGrid
          posts={filtered}
          initialMonth={selectedCycle?.startDate ?? null}
          onSelect={openFromCalendar}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center sm:p-12">
          <CalendarDays className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">{filtersActive ? "Nothing matches" : emptyTitle}</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {filtersActive
              ? "No post matches the filters you've set. Try widening them."
              : emptyHint}
          </p>
          {filtersActive ? (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Tap any post to read the script and leave feedback.
          </p>
          <ul className="space-y-3">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewerRole={viewerRole}
                canManage={canManage}
                canDelete={canDelete}
                canComment={canComment}
                driveEnabled={driveEnabled}
                open={openIds.has(post.id)}
                onToggle={() => toggle(post.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
