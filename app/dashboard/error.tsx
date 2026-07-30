"use client" // Error boundaries must be Client Components.

import { useEffect } from "react"
import Link from "next/link"

import { ErrorScreen } from "@/components/error-screen"
import { Button, buttonVariants } from "@/components/ui/button"

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
    <ErrorScreen
      className="min-h-[75vh]"
      code="500"
      title="Something went wrong"
      description={
        <>
          <p>We couldn&apos;t load this page, but don&apos;t worry!</p>
          <p className="mt-3">
            This is usually temporary — try again in a moment.
          </p>
        </>
      }
      actions={
        <>
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Back to dashboard
          </Link>
        </>
      }
      footnote={error.digest ? `Reference: ${error.digest}` : null}
    />
  )
}
