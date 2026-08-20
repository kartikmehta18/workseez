"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEFAULT_CYCLE_LENGTH } from "@/lib/content"
import { createCalendar } from "../actions"

export type SelectableClient = { id: string; name: string; company: string | null }

/**
 * Creates a client's content calendar.
 *
 * Clients that already have one are filtered out by the caller, so the dropdown
 * only ever offers a valid choice — the same contract CreateSheetDialog has.
 */
export function CreateCalendarDialog({ clients }: { clients: SelectableClient[] }) {
  const [open, setOpen] = React.useState(false)
  const [clientId, setClientId] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createCalendar(formData)
      if (result.ok) {
        toast.success("Content calendar created. Add the first post to get going.")
        setOpen(false)
        setClientId("")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={clients.length === 0}>
          <Plus /> New content calendar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <input type="hidden" name="clientId" value={clientId} />
          <DialogHeader>
            <DialogTitle>New content calendar</DialogTitle>
            <DialogDescription>
              One calendar per client, filled in post by post. Nothing on it is visible until you
              publish each post.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="calendar-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="calendar-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                      {client.company ? ` — ${client.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calendar-start">Cycle 1 starts</Label>
              <Input id="calendar-start" name="cycleStart" type="date" />
              <p className="text-muted-foreground text-xs">
                Optional. Cycles are {DEFAULT_CYCLE_LENGTH} days long and run back to back from this
                date — you can change it, and the length, at any time.
              </p>
            </div>

            <p className="text-muted-foreground text-xs">
              The client&apos;s existing Drive link is used for uploads to start with. Point it at a
              dedicated raw-footage folder in the calendar settings when you have one.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !clientId}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Creating…" : "Create calendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
