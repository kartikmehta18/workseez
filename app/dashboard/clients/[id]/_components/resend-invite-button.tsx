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
        // A resend carries a *new* key — the old one exists only as a hash, so
        // there is nothing to repeat — and the admin sees it here in case they
        // want to read it out rather than wait on the mail.
        toast.success("Invite email sent again, with a new access key.", {
          description: result.accessKey
            ? `Access key ${result.accessKey} — the only time it is shown.`
            : undefined,
          duration: 8000,
        })
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
