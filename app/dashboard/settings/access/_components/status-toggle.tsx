"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { setUserStatus } from "../actions"

export function StatusToggle({
  userId,
  status,
  disabled,
}: {
  userId: string
  status: string
  disabled?: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  const disabling = status !== "DISABLED"

  function onClick() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("userId", userId)
      // Re-enabling returns them to INVITED; they become ACTIVE again on sign-in.
      formData.set("status", disabling ? "DISABLED" : "INVITED")
      const result = await setUserStatus(formData)
      if (result.ok) {
        toast.success(disabling ? "Account disabled." : "Account re-enabled.")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button
      variant={disabling ? "outline" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled || pending}
    >
      {disabling ? "Disable" : "Enable"}
    </Button>
  )
}
