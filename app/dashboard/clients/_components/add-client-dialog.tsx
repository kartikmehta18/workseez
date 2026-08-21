"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "../actions"
import { AccessKeyField } from "../../_components/access-key-field"
import { ClientLinkFields } from "./client-link-fields"

export function AddClientDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createClient(formData)
      if (result.ok) {
        toast.success(
          result.emailed
            ? "Client created. An invite email is on its way."
            : "Client created, but the invite email couldn't be sent — share the key below yourself.",
          {
            description: result.accessKey
              ? `Access key ${result.accessKey} — the only time it is shown.`
              : undefined,
            // Long enough to write down when the mail didn't go: this is then
            // the only copy of the key that exists anywhere.
            duration: result.emailed ? 8000 : 60000,
          },
        )
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New Client
        </Button>
      </DialogTrigger>
      {/* Wide and two-column on purpose: stacked in one column this form ran
          past the viewport and the panel grew its own scrollbar. Paired fields
          halve the height instead. */}
      <DialogContent className="sm:max-w-3xl">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>
              The email is what links them to this profile — and the Google account they can
              sign in with. The invite carries a 6-digit access key too, for when they have
              no Google account on that address.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor="name">Client name</Label>
              <Input id="name" name="name" placeholder="Sagar" required />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" placeholder="Workseez" />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="email">Google email</Label>
              <Input id="email" name="email" type="email" placeholder="Sagar@example.com" required />
            </div>
            <AccessKeyField hint="Six digits, sent with the invite — it signs them in without Google." />
            <div className="grid content-start gap-2 sm:col-span-2">
              <Label htmlFor="driveUrl">Google Drive folder</Label>
              <Input
                id="driveUrl"
                name="driveUrl"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/drive/folders/…"
              />
            </div>

            <div className="sm:col-span-2">
              <ClientLinkFields />
            </div>

            <div className="grid content-start gap-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} placeholder="Optional context" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
