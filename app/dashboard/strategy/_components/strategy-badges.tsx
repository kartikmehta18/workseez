import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Where a strategy sheet is in its lifecycle. Colours deliberately match
 * FormStatusBadge's scale (amber = ours, sky = waiting on someone, emerald =
 * done) so a client list showing both badges reads consistently.
 */
export function SheetStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-medium">
        Not created
      </Badge>
    )
  }
  if (status === "APPROVED") {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
      >
        Approved
      </Badge>
    )
  }
  if (status === "PUBLISHED") {
    return (
      <Badge variant="secondary" className="border-sky-200 bg-sky-50 font-medium text-sky-700">
        Ready for review
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="border-amber-200 bg-amber-50 font-medium text-amber-700">
      Draft
    </Badge>
  )
}

/** Thin filled/total bar, matching the onboarding ProgressBar. */
export function SheetProgressBar({
  percent,
  filled,
  total,
  className,
}: {
  percent: number
  filled: number
  total: number
  className?: string
}) {
  const complete = total > 0 && filled === total

  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
        <span>
          {filled} of {total} rows filled
        </span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Strategy sheet progress"
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

/**
 * The Draft -> Ready for Review -> Approved strip from the printed sheet.
 * Rendered as a read-only trail, not a control: status is changed by the
 * publish buttons and the client's approve button, and offering a second way
 * to set it here would just be a way to set it by accident.
 */
export function SheetStatusTrail({ status }: { status: string }) {
  const steps = [
    { key: "DRAFT", label: "Draft" },
    { key: "PUBLISHED", label: "Ready for Review" },
    { key: "APPROVED", label: "Approved" },
  ]
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === status),
  )

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {steps.map((step, index) => {
        const done = index <= currentIndex
        return (
          <li key={step.key} className="flex items-center gap-2">
            {index > 0 ? <span className="text-muted-foreground/50">→</span> : null}
            <span
              className={cn(
                "flex items-center gap-1.5",
                done ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[4px] border text-[10px] leading-none",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-muted-foreground/30",
                )}
              >
                {done ? "✓" : ""}
              </span>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
