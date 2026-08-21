"use client"

import * as React from "react"
import { UserPlus } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/rbac"
import { inviteTeamMember } from "../actions"
import { AccessKeyField } from "../../../_components/access-key-field"

export function InviteMemberDialog({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  // Tracked so the trigger can show the role's label on its own line — see the
  // note on SelectValue below.
  const [role, setRole] = React.useState<Role>("MANAGER")

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteTeamMember(formData)
      if (result.ok) {
        toast.success(
          result.emailed
            ? "Invite sent, with their access key."
            : "Invited, but the email couldn't be sent — send them the key below yourself.",
          {
            description: result.accessKey
              ? `Access key ${result.accessKey} — the only time it is shown.`
              : undefined,
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
          <UserPlus /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              Use the Google account they will sign in with. The invite also carries a 6-digit
              access key, which signs them in without Google.
            </DialogDescription>
          </DialogHeader>

          {/* Paired columns so the four fields sit in two rows — the panel then
              fits on a laptop screen without scrolling. */}
          <div className="grid gap-4 py-5 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" name="name" placeholder="Kartik Mehta" />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="invite-email">Google email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="teammate@example.com"
                required
              />
            </div>
            <AccessKeyField id="invite-key" hint="Emailed with the invite." />
            <div className="grid content-start gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                name="role"
                value={role}
                onValueChange={(next) => setRole(next as Role)}
              >
                <SelectTrigger id="invite-role">
                  {/* The label only. SelectValue left empty mirrors the whole
                      chosen item, and the description under it overflows a
                      one-line trigger. */}
                  <SelectValue>{ROLE_LABELS[role]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">
                    <span className="flex flex-col items-start">
                      <span>{ROLE_LABELS.MANAGER}</span>
                      <span className="text-muted-foreground text-xs">
                        {ROLE_DESCRIPTIONS.MANAGER}
                      </span>
                    </span>
                  </SelectItem>
                  {canGrantAdmin ? (
                    <SelectItem value="ADMIN">
                      <span className="flex flex-col items-start">
                        <span>{ROLE_LABELS.ADMIN}</span>
                        <span className="text-muted-foreground text-xs">
                          {ROLE_DESCRIPTIONS.ADMIN}
                        </span>
                      </span>
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Inviting…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
