"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea"
import { CLIENT_STATUSES } from "@/lib/rbac"
import { updateClient } from "../../actions"
import { ClientLinkFields, type LinkRow } from "../../_components/client-link-fields"

type ClientFields = {
  id: string
  name: string
  company: string | null
  notes: string | null
  status: string
  driveUrl: string | null
  links: LinkRow[]
  ownerEmail: string
  ownerStatus: string
}

export function EditClientDialog({ client }: { client: ClientFields }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const [email, setEmail] = React.useState(client.ownerEmail)
  const emailChanged = email.trim().toLowerCase() !== client.ownerEmail.toLowerCase()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateClient(formData)
      if (result.ok) {
        toast.success(
          result.emailed === false
            ? "Client updated, but the invite email to the new address couldn't be sent."
            : result.emailed
              ? "Client updated. A new invite and access key went to the updated address."
              : "Client updated.",
          {
            // Changing the login email re-keys the account — the old key was
            // mailed to an address that is no longer the owner's.
            description: result.accessKey
              ? `New access key ${result.accessKey} — the only time it is shown.`
              : undefined,
            duration: result.accessKey && result.emailed === false ? 60000 : 8000,
          },
        )
        setOpen(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  // Reset the local email field whenever the dialog reopens, so a cancelled
  // edit doesn't leave a stale value behind.
  React.useEffect(() => {
    if (open) setEmail(client.ownerEmail)
  }, [open, client.ownerEmail])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Edit
        </Button>
      </DialogTrigger>
      {/* Wide and two-column, like the add dialog: one column of these fields
          overflowed the panel and turned it into a scrolling box. */}
      <DialogContent className="sm:max-w-3xl">
        <form action={onSubmit}>
          <input type="hidden" name="id" value={client.id} />
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor="edit-name">Client name</Label>
              <Input id="edit-name" name="name" defaultValue={client.name} required />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input id="edit-company" name="company" defaultValue={client.company ?? ""} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="edit-email">Login email</Label>
              <Input
                id="edit-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {emailChanged ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  Changing the login email rebinds portal access. The client will need to sign in
                  with Google using the new address
                  {client.ownerStatus === "ACTIVE" ? ", and their current access is reset" : ""}. A
                  fresh invite is emailed to it on save.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  The Google account this client signs in with.
                </p>
              )}
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select name="status" defaultValue={client.status}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status} className="capitalize">
                      {status.toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-2 sm:col-span-2">
              <Label htmlFor="edit-drive">Google Drive folder</Label>
              <Input
                id="edit-drive"
                name="driveUrl"
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/drive/folders/…"
                defaultValue={client.driveUrl ?? ""}
              />
              <p className="text-muted-foreground text-xs">
                Shown as a Drive button on the client list and overview.
              </p>
            </div>

            <div className="sm:col-span-2">
              <ClientLinkFields initial={client.links} />
            </div>

            <div className="grid content-start gap-2 sm:col-span-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" name="notes" rows={2} defaultValue={client.notes ?? ""} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
