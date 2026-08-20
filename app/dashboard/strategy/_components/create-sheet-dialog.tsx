"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEFAULT_SECTIONS } from "@/lib/strategy"
import { createStrategySheet } from "../actions"

export type SelectableClient = { id: string; name: string; company: string | null }

/**
 * Creates a client's strategy sheet, pre-filled with the standard skeleton.
 *
 * Clients that already have a sheet are filtered out by the caller, so the
 * dropdown only ever offers a valid choice.
 */
export function CreateSheetDialog({ clients }: { clients: SelectableClient[] }) {
  const [open, setOpen] = React.useState(false)
  const [clientId, setClientId] = React.useState("")
  const [pending, startTransition] = React.useTransition()

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createStrategySheet(formData)
      if (result.ok) {
        toast.success("Strategy sheet created. Fill it in, then publish.")
        setOpen(false)
        setClientId("")
      } else {
        toast.error(result.error)
      }
    })
  }

  const disabled = clients.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus /> New strategy sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <input type="hidden" name="clientId" value={clientId} />
          <DialogHeader>
            <DialogTitle>New strategy sheet</DialogTitle>
            <DialogDescription>
              Starts from the standard {DEFAULT_SECTIONS.length}-section skeleton — overview,
              audience, content pillars and competitors. Every field, column and row is editable
              afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="strategy-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="strategy-client">
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
              <p className="text-muted-foreground text-xs">
                The sheet stays a draft until you publish it, so the client sees nothing yet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !clientId}>
              {pending ? "Creating…" : "Create sheet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
