"use client"

import * as React from "react"

import { useNavigationPending } from "@/lib/use-navigation-pending"

/**
 * The thin bar across the top of the viewport during a page change.
 *
 * Companion to the in-page skeletons, not a replacement: the skeleton says what
 * is arriving, this says that something is. It also covers the routes outside
 * the dashboard — the marketing page and login — which have no content-area
 * transition of their own.
 *
 * Deliberately late and unhurried: nothing is drawn for DELAY_MS so a fast
 * navigation never flashes, and when the new route commits the bar completes to
 * full before fading, rather than vanishing mid-travel, which reads as a
 * cancelled load.
 */

/** Below this, a navigation is fast enough that showing anything is noise. */
const DELAY_MS = 200
/** How long the completed bar rests at full width before it fades out. */
const DONE_MS = 260

export function RouteProgress() {
  const pending = useNavigationPending()
  // Held one beat past `pending` so the bar can finish rather than disappear.
  const [finishing, setFinishing] = React.useState(false)
  const [previous, setPrevious] = React.useState(pending)

  // Adjusted during render, not in an effect: the handover from travelling to
  // finishing has to land in the same commit the pending flag flips, or the bar
  // blinks out for a frame before the completing state paints.
  if (previous !== pending) {
    setPrevious(pending)
    setFinishing(!pending)
  }

  React.useEffect(() => {
    if (!finishing) return
    const timer = window.setTimeout(() => setFinishing(false), DONE_MS)
    return () => window.clearTimeout(timer)
  }, [finishing])

  if (!pending && !finishing) return null

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      aria-busy={pending}
      className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.5"
    >
      <div
        className={
          pending
            ? // The delay sits on the animation, so a navigation that resolves
              // inside DELAY_MS unmounts before the bar has drawn anything.
              "bg-primary animate-nav-progress h-full origin-left scale-x-0"
            : "bg-primary h-full origin-left scale-x-100 opacity-0 transition-[transform,opacity] duration-200"
        }
        style={pending ? { animationDelay: `${DELAY_MS}ms` } : undefined}
      />
    </div>
  )
}
