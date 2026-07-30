import Link from "next/link"

import { ErrorScreen } from "@/components/error-screen"
import { buttonVariants } from "@/components/ui/button"

/** Root 404. Standalone rather than sitting under the marketing header, since
 *  an unknown URL may be hit by a signed-in user or a stranger alike. */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorScreen
        code="404"
        title="Page not found"
        description={
          <>
            <p>The page you&apos;re looking for has wandered off, but don&apos;t worry!</p>
            <p className="mt-3">Let&apos;s get you back on track.</p>
          </>
        }
        actions={
          <>
            <Link href="/" className={buttonVariants()}>
              Take me home
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Go to dashboard
            </Link>
          </>
        }
      />
    </main>
  )
}
