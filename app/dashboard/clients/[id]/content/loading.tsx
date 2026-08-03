import {
  ClientSubPageHeaderSkeleton,
  PageSkeleton,
  PostListSkeleton,
} from "@/components/skeletons"

/** A client's content calendar, team side. */
export default function ClientContentLoading() {
  return (
    <PageSkeleton width="max-w-4xl" className="space-y-4">
      <ClientSubPageHeaderSkeleton />
      <PostListSkeleton />
    </PageSkeleton>
  )
}
