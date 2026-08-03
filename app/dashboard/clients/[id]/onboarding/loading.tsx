import {
  ClientSubPageHeaderSkeleton,
  DocumentSkeleton,
  PageSkeleton,
} from "@/components/skeletons"

/** A client's onboarding form, team side. */
export default function ClientOnboardingLoading() {
  return (
    <PageSkeleton width="max-w-4xl" className="space-y-4">
      <ClientSubPageHeaderSkeleton />
      <DocumentSkeleton />
    </PageSkeleton>
  )
}
