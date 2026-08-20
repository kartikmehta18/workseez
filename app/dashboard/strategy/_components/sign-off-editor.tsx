"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSignOff } from "../actions"

/**
 * The strategist / team lead sign-off block.
 *
 * Free text rather than a picker of portal users: the strategist of record is
 * often written down before that person has an account, and this is a document
 * field — it records who signed, not who clicked.
 */
export function SignOffEditor({
  sheetId,
  strategistName,
  strategistDate,
  teamLeadName,
  teamLeadDate,
}: {
  sheetId: string
  strategistName: string | null
  /** Pre-formatted as yyyy-MM-dd by the server — a date input takes nothing else. */
  strategistDate: string | null
  teamLeadName: string | null
  teamLeadDate: string | null
}) {
  const [pending, startTransition] = React.useTransition()

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveSignOff(formData)
      if (result.ok) {
        toast.success("Sign-off saved.")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form action={onSubmit} className="rounded-lg border p-5">
      <input type="hidden" name="sheetId" value={sheetId} />
      <h2 className="font-medium">Sign-off</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Who signed this strategy off internally. Shown to the client on the sheet.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SignOffRow
          idPrefix="strategist"
          role="Strategist"
          nameField="strategistName"
          dateField="strategistDate"
          defaultName={strategistName ?? ""}
          defaultDate={strategistDate ?? ""}
          disabled={pending}
        />
        <SignOffRow
          idPrefix="team-lead"
          role="Team Lead"
          nameField="teamLeadName"
          dateField="teamLeadDate"
          defaultName={teamLeadName ?? ""}
          defaultDate={teamLeadDate ?? ""}
          disabled={pending}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save sign-off"}
        </Button>
      </div>
    </form>
  )
}

function SignOffRow({
  idPrefix,
  role,
  nameField,
  dateField,
  defaultName,
  defaultDate,
  disabled,
}: {
  idPrefix: string
  role: string
  nameField: string
  dateField: string
  defaultName: string
  defaultDate: string
  disabled: boolean
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${idPrefix}-name`}>{role}</Label>
      <Input
        id={`${idPrefix}-name`}
        name={nameField}
        defaultValue={defaultName}
        disabled={disabled}
        placeholder="Name"
      />
      <Input
        type="date"
        name={dateField}
        defaultValue={defaultDate}
        disabled={disabled}
        aria-label={`${role} sign-off date`}
      />
    </div>
  )
}
