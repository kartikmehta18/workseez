"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/rbac"
import { setUserRole } from "../actions"

/** The Super Admin's switch for turning someone into an Admin, Manager or Client. */
export function RoleSelect({
  userId,
  role,
  disabled,
  disabledReason,
}: {
  userId: string
  role: Role
  disabled?: boolean
  disabledReason?: string
}) {
  // `role` is the server value and seeds this optimistic state. The parent
  // passes key={role} so a change from the server remounts this component —
  // cheaper and less error-prone than syncing with an effect.
  const [value, setValue] = React.useState<Role>(role)
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  function onChange(next: string) {
    const previous = value
    setValue(next as Role)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("userId", userId)
      formData.set("role", next)
      const result = await setUserRole(formData)
      if (result.ok) {
        toast.success(`Role updated to ${ROLE_LABELS[next as Role]}.`)
        router.refresh()
      } else {
        setValue(previous) // roll the optimistic change back
        toast.error(result.error)
      }
    })
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || pending}>
      <SelectTrigger className="w-[240px]" title={disabled ? disabledReason : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r} disabled={r === "SUPER_ADMIN"}>
            <span className="flex flex-col items-start ">
              <span>{ROLE_LABELS[r]}</span>
              <span className="text-muted-foreground text-xs">{ROLE_DESCRIPTIONS[r]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
