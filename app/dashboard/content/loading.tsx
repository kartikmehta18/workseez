import { PageHeaderSkeleton, PageSkeleton, PostListSkeleton } from "@/components/skeletons"

/**
 * The content calendar route serves two pages: the client's own calendar and
 * the team's roster of every client's. Shaped to the client's here — they are
 * the ones reading it on a phone, where a blank screen is felt most.
 */
export default function ContentLoading() {
  return (
    <PageSkeleton width="max-w-4xl" className="space-y-4">
      <PageHeaderSkeleton action={false} />
      <PostListSkeleton />
    </PageSkeleton>
  )
}
