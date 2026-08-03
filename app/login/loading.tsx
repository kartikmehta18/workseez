import { Skeleton } from "@/components/ui/skeleton"

/**
 * The sign-in card. This page awaits the session before it can decide whether
 * to redirect an already-signed-in visitor, so the card is what the skeleton
 * holds the space for.
 */
export default function LoginLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <span className="sr-only">Loading</span>
      <div className="w-full max-w-sm">
        <div className="border-border bg-card rounded-lg border p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <Skeleton className="size-11 rounded-md" />
            <Skeleton className="mt-5 h-6 w-48" />
            <Skeleton className="mt-3 h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="mt-6 h-11 w-full rounded-md" />
          <Skeleton className="mx-auto mt-6 h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="mx-auto mt-6 h-4 w-32" />
      </div>
    </main>
  )
}
