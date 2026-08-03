import {
  ClientSubPageHeaderSkeleton,
  DocumentSkeleton,
  PageSkeleton,
} from "@/components/skeletons"

/** A client's strategy sheet, team side. */
export default function ClientStrategyLoading() {
  return (
    <PageSkeleton width="max-w-4xl" className="space-y-4">
      <ClientSubPageHeaderSkeleton />
      <DocumentSkeleton sections={5} />
    </PageSkeleton>
  )
}
