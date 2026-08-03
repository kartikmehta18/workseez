import { CardGridSkeleton, PageHeaderSkeleton, PageSkeleton } from "@/components/skeletons"

/**
 * Onboarding. The team sees a roster of client cards; a client sees their own
 * form. Shaped to the roster, which is the heavier query of the two.
 */
export default function OnboardingLoading() {
  return (
    <PageSkeleton>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} progress />
    </PageSkeleton>
  )
}
