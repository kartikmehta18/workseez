"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Whether a page change is in flight.
 *
 * `loading.tsx` only takes over once the router has started rendering the new
 * route. Before that — click sent, response not back — Next.js keeps the old
 * page on screen. The docs are explicit that the fallback is prefetched, "making
 * navigation immediate unless prefetching hasn't completed", and on a slow
 * connection, or a route the user reached before it was prefetched, that gap is
 * where the app looks frozen. This hook measures that gap.
 *
 * Detection is a single capture-phase click listener on the document rather
 * than `useLinkStatus`, which reports only for the one `<Link>` it sits under
 * and so would have to be threaded through every link in the app. The listener
 * also catches the browser's back and forward buttons, which no per-link hook
 * sees.
 */

/** Backstop: a click that never navigates must not leave the app in limbo. */
const TIMEOUT_MS = 15000

export function useNavigationPending() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = React.useState(false)

  // The URL the navigation left from. While this differs from the live one the
  // router has not committed, which is exactly the window being measured.
  const startedAt = React.useRef<string | null>(null)

  const start = React.useCallback(() => {
    startedAt.current = window.location.pathname + window.location.search
    setPending(true)
  }, [])

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Anything the browser will not treat as a plain in-page navigation:
      // a new tab, a download, a modified click, or an already-handled event.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest?.("a")
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Same page, or a jump to an anchor on it — no route change to wait for.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return
      }

      start()
    }

    const onPopState = () => start()

    // Capture phase, so a link inside a component that stops propagation is
    // still seen.
    document.addEventListener("click", onClick, { capture: true })
    window.addEventListener("popstate", onPopState)
    return () => {
      document.removeEventListener("click", onClick, { capture: true })
      window.removeEventListener("popstate", onPopState)
    }
  }, [start])

  // The router committed the new URL — the gap is over.
  React.useEffect(() => {
    if (!pending) return
    const query = searchParams.toString()
    const current = pathname + (query ? `?${query}` : "")
    if (startedAt.current === null || startedAt.current === current) return

    startedAt.current = null
    setPending(false)
  }, [pathname, searchParams, pending])

  // A click that turned out not to navigate: a dialog trigger, a guarded route,
  // a redirect back to where we already were.
  React.useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => {
      startedAt.current = null
      setPending(false)
    }, TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [pending])

  return pending
}

/**
 * The same signal, held back by `delayMs`.
 *
 * A navigation that resolves in 80ms should show nothing at all — a skeleton
 * that appears and vanishes within a frame or two reads as a glitch, and is
 * worse than the brief pause it was meant to cover.
 */
export function useDelayedNavigationPending(delayMs: number) {
  const pending = useNavigationPending()
  const [elapsed, setElapsed] = React.useState(false)
  const [previous, setPrevious] = React.useState(pending)

  // Reset during render rather than in an effect. React documents this for
  // state that derives from a changing value: the adjustment is applied before
  // anything paints, where an effect would first commit a frame still claiming
  // the previous navigation had run long.
  if (previous !== pending) {
    setPrevious(pending)
    setElapsed(false)
  }

  React.useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setElapsed(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [pending, delayMs])

  return pending && elapsed
}
