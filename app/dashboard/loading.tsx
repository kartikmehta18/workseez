import { Skeleton } from "@/components/ui/skeleton"
import { CardGridSkeleton, PageSkeleton, StatsSkeleton } from "@/components/skeletons"

/**
 * The dashboard home. Shaped to the team view — hero banner, stat tiles, then
 * the client cards — since that is the version with the heavy queries behind it.
 * A client signing in sees a narrower page, so the container widens slightly on
 * swap; the blocks themselves land where the skeleton put them.
 */
export default function DashboardLoading() {
  return (
    <PageSkeleton>
      <div className="from-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-linear-to-r to-transparent p-5 sm:p-6">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <StatsSkeleton />
      <CardGridSkeleton count={6} avatar />
    </PageSkeleton>
  )
}
