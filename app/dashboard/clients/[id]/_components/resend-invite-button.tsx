"use client"

import * as React from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { resendClientInvite } from "../../actions"

/** Resends the portal invite to a client who is still pending (INVITED). */
export function ResendInviteButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = React.useTransition()

  function onClick() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("id", clientId)
      const result = await resendClientInvite(formData)
      if (result.ok) {
        toast.success("Invite email sent again.")
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <Send /> {pending ? "Sending…" : "Resend invite"}
    </Button>
  )
}
