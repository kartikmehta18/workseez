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
            : "Client created, but the invite email couldn't be sent — share the portal link yourself.",
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
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>
              The email must be the Google account they will sign in with — that is what links
              them to this profile. We'll email them an invite with a link to sign in.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="name">Client name</Label>
              <Input id="name" name="name" placeholder="Sagar" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" placeholder="Workseez" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Google email</Label>
              <Input id="email" name="email" type="email" placeholder="Sagar@example.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driveUrl">Google Drive folder</Label>
              <Input
                id="driveUrl"
                name="driveUrl"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/drive/folders/…"
              />
            </div>

            <ClientLinkFields />

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} placeholder="Optional context" />
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
