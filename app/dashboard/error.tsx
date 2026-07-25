"use client" // Error boundaries must be Client Components.

import { useEffect } from "react"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Catches uncaught exceptions from any dashboard page — most likely the remote
 * database being unreachable. Without this, a Prisma throw renders a blank 500.
 *
 * `unstable_retry` (Next 16.2+) re-fetches and re-renders the segment, which is
 * what a transient DB error actually needs; `reset` alone would only clear the
 * boundary and re-throw.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-8 text-center">
        <span className="bg-destructive/10 text-destructive mx-auto flex size-11 items-center justify-center rounded-full">
          <TriangleAlert className="size-5" />
        </span>
        <h2 className="text-foreground mt-5 text-lg font-semibold tracking-tight">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          We couldn&apos;t load this page. This is usually temporary — try again in a
          moment.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground mt-3 font-mono text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button className="mt-6 w-full" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </div>
    </div>
  )
}
