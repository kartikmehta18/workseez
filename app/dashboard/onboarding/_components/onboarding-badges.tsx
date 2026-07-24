import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Where a questionnaire is in its lifecycle. Deliberately not a dot badge —
 * it sits next to ClientStatusBadge on the client list and the two must not
 * read as the same kind of thing.
 */
export function FormStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-medium">
        Not created
      </Badge>
    )
  }
  if (status === "SUBMITTED") {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
      >
        Submitted
      </Badge>
    )
  }
  if (status === "PUBLISHED") {
    return (
      <Badge variant="secondary" className="border-sky-200 bg-sky-50 font-medium text-sky-700">
        Awaiting client
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="border-amber-200 bg-amber-50 font-medium text-amber-700">
      Draft
    </Badge>
  )
}

/** Thin answered/total bar. `percent` is already rounded by formProgress. */
export function ProgressBar({
  percent,
  answered,
  total,
  className,
}: {
  percent: number
  answered: number
  total: number
  className?: string
}) {
  const complete = total > 0 && answered === total

  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
        <span>
          {answered} of {total} answered
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            complete ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
