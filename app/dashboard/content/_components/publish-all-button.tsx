"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { publishAllPosts } from "../actions"

/**
 * Publishes every unpublished post on a calendar at once — the "the cycle is
 * ready, send it" button.
 *
 * Confirmed rather than instant because it emails the client once per post: a
 * misfire on a ten-post cycle is ten emails that cannot be recalled.
 */
export function PublishAllButton({
  calendarId,
  pendingCount,
}: {
  calendarId: string
  pendingCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  if (pendingCount === 0) return null

  const onClick = () => {
    if (
      !window.confirm(
        `Publish ${pendingCount} ${pendingCount === 1 ? "post" : "posts"} to the client? They get an email for each one.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const formData = new FormData()
      formData.set("calendarId", calendarId)
      const result = await publishAllPosts(formData)
      if (result.ok) {
        toast.success("Published. The client has been emailed.")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {pending ? <Loader2 className="animate-spin" /> : <Send />}
      Publish all {pendingCount}
    </Button>
  )
}
