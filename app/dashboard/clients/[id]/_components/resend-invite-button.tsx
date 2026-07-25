"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { resendClientInvite } from "../../actions"

/** Resends the portal invite to a client who is still pending (INVITED). */
export function ResendInviteButton({ clientId }: { clientId: string }) {
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()

  function onClick() {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("id", clientId)
      const result = await resendClientInvite(formData)
      if (result.ok) {
        toast.success("Invite email sent again.")
        router.refresh()
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
