import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

/** Root 404. Standalone rather than sitting under the marketing header, since
 *  an unknown URL may be hit by a signed-in user or a stranger alike. */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-md text-center">
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="text-foreground mt-3 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
