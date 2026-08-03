import { CardGridSkeleton, PageHeaderSkeleton, PageSkeleton, TableSkeleton } from "@/components/skeletons"

/**
 * The clients roster. Both breakpoints are rendered for the same reason the
 * real page renders both: the table above `lg`, the card list below it.
 */
export default function ClientsLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} />
      <CardGridSkeleton
        count={4}
        avatar
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden"
      />
    </PageSkeleton>
  )
}
