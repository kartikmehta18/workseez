"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarClock, Loader2, Settings2, Trash2 } from "lucide-react"

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
import {
  cycleEndDate,
  cycleLengthBetween,
  DEFAULT_CYCLE_LENGTH,
  MAX_CYCLE_LENGTH,
} from "@/lib/content"
import { deleteCalendar, saveCalendarSettings } from "../actions"

export type CalendarSettings = {
  id: string
  title: string
  /** yyyy-mm-dd, or "" when no anchor has been set yet. */
  cycleStart: string
  cycleStartLabel: string | null
  cycleLength: number
  rawFolderUrl: string | null
  editsFolderUrl: string | null
}

/**
 * The cycle bar that sits above the calendar — "Cycle 1 starts: 16 Apr · Edit".
 *
 * Every cycle is derived from that one date, so the note next to it is not
 * decoration: moving it shifts all 30-day cycles at once, and a manager who
 * expects it to move only the first one would quietly re-date the whole year.
 */
export function CycleBar({
  settings,
  canManage,
  canDelete,
}: {
  settings: CalendarSettings
  canManage: boolean
  canDelete: boolean
}) {
  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3">
      <CalendarClock className="text-muted-foreground size-4 shrink-0" />
      <p className="text-sm">
        <span className="text-muted-foreground">Cycle 1 starts:</span>{" "}
        <span className="font-semibold">{settings.cycleStartLabel ?? "not set"}</span>
      </p>
      {canManage ? (
        <SettingsDialog settings={settings} canDelete={canDelete} />
      ) : null}
      {/* Full width on a phone: wrapped onto its own line, ml-auto would push
          this note hard right and leave it reading as a stray fragment. */}
      <p className="text-muted-foreground w-full text-xs sm:ml-auto sm:w-auto">
        All {settings.cycleLength}-day cycles shift with this date.
      </p>
    </div>
  )
}

/**
 * Cycle 1's first and last day. The calendar stores a length, not an end date,
 * so the end is worked out from it here and turned back into a length on save.
 *
 * `length` is held apart from the end date so moving the start carries a chosen
 * length along with it, and so a half-typed year in the end date, which reads
 * as a real date in year 0002, never replaces it. The min and max on the end
 * date are what stop the form submitting one that is out of range.
 */
export function CycleDates({
  initialStart,
  initialLength,
}: {
  initialStart: string
  initialLength: number
}) {
  const [start, setStart] = React.useState(initialStart)
  const [end, setEnd] = React.useState(() => cycleEndDate(initialStart, initialLength))
  const [length, setLength] = React.useState(initialLength)

  const changeStart = (next: string) => {
    setStart(next)
    setEnd(cycleEndDate(next, length))
  }

  const changeEnd = (next: string) => {
    setEnd(next)
    if (!next) setLength(DEFAULT_CYCLE_LENGTH)
    else setLength((current) => cycleLengthBetween(start, next) ?? current)
  }

  return (
    <>
      {/* The end date below has no name: this is what the form submits. */}
      <input type="hidden" name="cycleLength" value={length} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="calendar-cycle-start">Cycle 1 starts</Label>
          <Input
            id="calendar-cycle-start"
            name="cycleStart"
            type="date"
            value={start}
            onChange={(event) => changeStart(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="calendar-cycle-end">Cycle 1 ends</Label>
          <Input
            id="calendar-cycle-end"
            type="date"
            value={end}
            min={start || undefined}
            max={cycleEndDate(start, MAX_CYCLE_LENGTH) || undefined}
            disabled={!start}
            onChange={(event) => changeEnd(event.target.value)}
          />
        </div>
      </div>

      <p className="text-muted-foreground -mt-1 text-xs">
        {start ? `Every cycle runs ${length} ${length === 1 ? "day" : "days"}. ` : null}
        Cycles run back to back from the start date, so changing it moves every cycle. Clear the
        end date to go back to {DEFAULT_CYCLE_LENGTH} days, or leave the start empty to drop the
        cycle grouping and work from one flat list.
      </p>
    </>
  )
}

function SettingsDialog({
  settings,
  canDelete,
}: {
  settings: CalendarSettings
  canDelete: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveCalendarSettings(formData)
      if (result.ok) {
        toast.success("Calendar updated.")
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  const onDelete = () => {
    if (
      !window.confirm(
        "Delete this content calendar? Every post, script, file list and piece of feedback on it goes with it.",
      )
    ) {
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set("calendarId", settings.id)
      const result = await deleteCalendar(formData)
      if (result.ok) {
        toast.success("Content calendar deleted.")
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary h-7 px-2">
          <Settings2 className="size-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <input type="hidden" name="calendarId" value={settings.id} />
          <DialogHeader>
            <DialogTitle>Calendar settings</DialogTitle>
            <DialogDescription>
              The cycle anchor and the two Drive folders every post inherits.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="calendar-title">Title</Label>
              <Input
                id="calendar-title"
                name="title"
                defaultValue={settings.title}
                maxLength={120}
              />
            </div>

            <CycleDates initialStart={settings.cycleStart} initialLength={settings.cycleLength} />

            <div className="grid gap-2">
              <Label htmlFor="calendar-raw">Raw footage folder</Label>
              <Input
                id="calendar-raw"
                name="rawFolderUrl"
                type="url"
                defaultValue={settings.rawFolderUrl ?? ""}
                placeholder="https://drive.google.com/drive/folders/…"
              />
              <p className="text-muted-foreground text-xs">
                Client uploads land in a per-post folder created inside this one.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calendar-edits">Edits folder</Label>
              <Input
                id="calendar-edits"
                name="editsFolderUrl"
                type="url"
                defaultValue={settings.editsFolderUrl ?? ""}
                placeholder="https://drive.google.com/drive/folders/…"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={onDelete}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 /> Delete calendar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
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
