"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarCog, Loader2, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cycleLengthBetween, MAX_CYCLE_LENGTH, type CycleOption } from "@/lib/content"
import { resetCycleDates, saveCycleDates } from "../actions"

/**
 * Re-dates one cycle. Sits next to the cycle dropdown, so it always edits the
 * cycle the viewer is looking at.
 *
 * The fields reset each time it opens, so they always start from the selected
 * cycle's current dates.
 */
export function EditCycleDialog({
  calendarId,
  cycle,
}: {
  calendarId: string
  cycle: CycleOption
}) {
  const [open, setOpen] = React.useState(false)
  const [start, setStart] = React.useState(cycle.startDate)
  const [end, setEnd] = React.useState(cycle.endDate)
  const [pending, startTransition] = React.useTransition()

  const length = cycleLengthBetween(start, end)

  const onOpenChange = (next: boolean) => {
    if (next) {
      setStart(cycle.startDate)
      setEnd(cycle.endDate)
    }
    setOpen(next)
  }

  const run = (action: typeof saveCycleDates, formData: FormData, message: string) => {
    startTransition(async () => {
      const result = await action(formData)
      if (result.ok) {
        toast.success(message)
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  const onSubmit = (formData: FormData) => run(saveCycleDates, formData, `Cycle ${cycle.number} updated.`)

  const onReset = () => {
    const formData = new FormData()
    formData.set("calendarId", calendarId)
    formData.set("number", String(cycle.number))
    run(resetCycleDates, formData, `Cycle ${cycle.number} follows on from the one before again.`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10">
          <CalendarCog /> Edit cycle {cycle.number} dates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={onSubmit}>
          <input type="hidden" name="calendarId" value={calendarId} />
          <input type="hidden" name="number" value={cycle.number} />
          <DialogHeader>
            <DialogTitle>Cycle {cycle.number} dates</DialogTitle>
            <DialogDescription>
              Currently {cycle.label}. Cycles after this one follow on from its end date unless
              you&apos;ve set their dates too.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cycle-start">Starts</Label>
              <Input
                id="cycle-start"
                name="start"
                type="date"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cycle-end">Ends</Label>
              <Input
                id="cycle-end"
                name="end"
                type="date"
                required
                value={end}
                min={start || undefined}
                onChange={(event) => setEnd(event.target.value)}
              />
            </div>
            <p className="text-muted-foreground text-xs sm:col-span-2">
              {length
                ? `${length} ${length === 1 ? "day" : "days"}, counting both ends.`
                : `Pick an end on or after the start, at most ${MAX_CYCLE_LENGTH} days later.`}
              {cycle.number > 1
                ? " Starting before the previous cycle ends shortens that one to fit."
                : " Moving cycle 1's start moves the calendar's anchor date too."}
            </p>
          </div>

          <DialogFooter className="sm:justify-between">
            {cycle.isCustom ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={onReset}
                className="text-muted-foreground"
              >
                <RotateCcw /> Reset to default
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !length}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
