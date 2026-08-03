import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton, PageSkeleton } from "@/components/skeletons"

/** One client's detail page: back link, identity header, then the section grid. */
export default function ClientDetailLoading() {
  return (
    <PageSkeleton width="max-w-5xl">
      <Skeleton className="-ml-2 h-8 w-28 rounded-md" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Skeleton className="size-12 shrink-0 rounded-full sm:size-14" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={5} className="rounded-lg lg:col-span-2" />
        <CardSkeleton lines={3} className="rounded-lg" />
        <CardSkeleton lines={3} className="rounded-lg lg:col-span-2" />
        <CardSkeleton lines={4} className="rounded-lg" />
      </div>
    </PageSkeleton>
  )
}
