"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { DEFAULT_SECTIONS } from "@/lib/onboarding"
import { createOnboardingForm } from "../actions"

export type SelectableClient = { id: string; name: string; company: string | null }

const DEFAULT_QUESTION_COUNT = DEFAULT_SECTIONS.reduce(
  (sum, section) => sum + section.questions.length,
  0,
)

/**
 * Creates a client's questionnaire, pre-filled with the standard question set.
 *
 * Clients that already have a form are filtered out by the caller, so the
 * dropdown only ever offers a valid choice.
 */
export function CreateFormDialog({ clients }: { clients: SelectableClient[] }) {
  const [open, setOpen] = React.useState(false)
  const [clientId, setClientId] = React.useState("")
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await createOnboardingForm(formData)
      if (result.ok) {
        toast.success("Onboarding form created. Review the questions, then publish.")
        setOpen(false)
        setClientId("")
        router.refresh()
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
          <Plus /> New onboarding form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <input type="hidden" name="clientId" value={clientId} />
          <DialogHeader>
            <DialogTitle>New onboarding form</DialogTitle>
            <DialogDescription>
              Starts from the standard {DEFAULT_QUESTION_COUNT}-question set across{" "}
              {DEFAULT_SECTIONS.length} sections. You can add, edit or remove anything before
              publishing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-5">
            <div className="grid gap-2">
              <Label htmlFor="onboarding-client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="onboarding-client">
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
                The form stays a draft until you publish it, so the client sees nothing yet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !clientId}>
              {pending ? "Creating…" : "Create form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
