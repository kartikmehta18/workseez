import { CardGridSkeleton, PageHeaderSkeleton, PageSkeleton } from "@/components/skeletons"

/** Strategy. Same two-audience split as onboarding — shaped to the roster. */
export default function StrategyLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} progress />
    </PageSkeleton>
  )
}
