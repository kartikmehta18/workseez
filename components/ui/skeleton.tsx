import { cn } from "@/lib/utils"

/**
 * A placeholder block.
 *
 * The highlight sweeps left to right rather than the whole block pulsing:
 * pulsing dims everything at once, which reads as a page that is broken or
 * flickering, while a sweep reads as work in progress. The gradient is sized to
 * 200% and animated by `background-position`, so nothing moves in the layout
 * and the effect costs one composited property.
 *
 * Colours come from `--skeleton` / `--skeleton-highlight`, declared per theme so
 * the sweep stays lighter than the base on dark screens too. Under
 * `prefers-reduced-motion` the animation is dropped in globals.css and the flat
 * block remains.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-skeleton rounded-md",
        "bg-[linear-gradient(90deg,var(--skeleton)_0%,var(--skeleton)_35%,var(--skeleton-highlight)_50%,var(--skeleton)_65%,var(--skeleton)_100%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
