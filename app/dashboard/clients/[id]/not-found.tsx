import Link from "next/link"
import { SearchX } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/** Catches the `notFound()` thrown when a client id doesn't resolve — or when
 *  a manager opens a client they aren't assigned to. */
export default function ClientNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-lg border p-8 text-center">
        <span className="bg-muted text-muted-foreground mx-auto flex size-11 items-center justify-center rounded-full">
          <SearchX className="size-5" />
        </span>
        <h2 className="text-foreground mt-5 text-lg font-semibold tracking-tight">
          Client not found
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          This client doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/dashboard/clients" className={buttonVariants({ className: "mt-6 w-full" })}>
          Back to clients
        </Link>
      </div>
    </div>
  )
}
