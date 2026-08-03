"use client"

import * as React from "react"

import { useDelayedNavigationPending } from "@/lib/use-navigation-pending"
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/skeletons"

/**
 * Puts a skeleton in the content area while the next page is being fetched.
 *
 * The route-level `loading.tsx` files cover the render, but not the fetch
 * before it: until the router has the new route it keeps the current page on
 * screen, so a slow link leaves the previous page sitting there looking
 * interactive. This bridges that window, and hands over to the destination's
 * own `loading.tsx` the moment the router commits.
 *
 * Only the content area is replaced. The sidebar and top bar stay live and
 * clickable, so a slow page can be abandoned for another without waiting.
 *
 * The current page is hidden rather than unmounted: a navigation that gets
 * cancelled, or one the router resolves from cache, returns to a page with its
 * scroll position and component state intact.
 */

/** Below this, the swap is fast enough that showing anything is just a flicker. */
const DELAY_MS = 200

export function PageTransition({ children }: { children: React.ReactNode }) {
  const loading = useDelayedNavigationPending(DELAY_MS)

  return (
    <>
      {/* `contents` so this wrapper never becomes a box of its own — the page
          below lays out against the padding container exactly as it does
          without the transition in the tree. */}
      <div style={{ display: loading ? "none" : "contents" }}>{children}</div>

      {loading ? <TransitionSkeleton /> : null}
    </>
  )
}

/**
 * Deliberately generic: which page is coming is not known yet. It is the shape
 * every dashboard page shares — a heading, a subtitle, and blocks under it — so
 * the handover to the destination's own skeleton reads as the same screen
 * settling rather than two different loaders.
 */
function TransitionSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto w-full max-w-6xl">
      <span className="sr-only">Loading page</span>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  )
}
