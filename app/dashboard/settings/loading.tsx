import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton, PageSkeleton } from "@/components/skeletons"

/** Settings: heading, the account block, then the links below it. */
export default function SettingsLoading() {
  return (
    <PageSkeleton width="max-w-3xl">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />

      <div className="mt-8 space-y-4">
        <CardSkeleton lines={4} className="rounded-lg" />
        <CardSkeleton lines={2} className="rounded-lg" />
      </div>
    </PageSkeleton>
  )
}
