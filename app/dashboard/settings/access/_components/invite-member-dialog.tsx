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
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/rbac"
import { inviteTeamMember } from "../actions"

export function InviteMemberDialog({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteTeamMember(formData)
      if (result.ok) {
        toast.success(
          result.emailed
            ? "Invite sent. They get access on their first Google sign-in."
            : "Invited, but the email couldn't be sent — send them the portal link yourself.",
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
      <DialogContent className="sm:max-w-md">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              Use the Google account they will sign in with. We'll email them an invite with a
              link to sign in.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" name="name" placeholder="Kartik Mehta" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Google email</Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="teammate@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select name="role" defaultValue="MANAGER">
                <SelectTrigger id="invite-role">
                  <SelectValue />
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
