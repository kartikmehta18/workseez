import { Skeleton } from "@/components/ui/skeleton"
import {
  CardGridSkeleton,
  CardSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  TableSkeleton,
} from "@/components/skeletons"

/** User Access: search and role filter, the directory, then the role reference. */
export default function UserAccessLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-9 w-full rounded-md lg:max-w-xs" />
        <Skeleton className="h-10 w-full rounded-md lg:w-80" />
      </div>

      <TableSkeleton
        rows={6}
        columns={5}
        className="mt-3 hidden rounded-lg border lg:block"
      />
      <CardGridSkeleton
        count={4}
        avatar
        className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden"
      />
      <CardSkeleton lines={4} className="mt-8 rounded-lg" />
    </PageSkeleton>
  )
}
