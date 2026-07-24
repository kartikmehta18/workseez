"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ROLE_LABELS, isRole } from "@/lib/rbac"
import { setClientManager } from "../../actions"

type TeamMember = { id: string; name: string | null; email: string; role: string }

export function ManagerAssignment({
  clientId,
  assignedIds,
  teamMembers,
}: {
  clientId: string
  assignedIds: string[]
  teamMembers: TeamMember[]
}) {
  const [pending, startTransition] = React.useTransition()
  const router = useRouter()
  const assigned = new Set(assignedIds)

  function toggle(userId: string, assign: boolean) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("clientId", clientId)
      formData.set("userId", userId)
      formData.set("assign", String(assign))
      const result = await setClientManager(formData)
      if (result.ok) {
        toast.success(assign ? "Manager assigned." : "Manager removed.")
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  if (teamMembers.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No admins or managers yet. Invite them from User Access.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {teamMembers.map((member) => {
        const isAssigned = assigned.has(member.id)
        return (
          <li key={member.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{member.name ?? member.email}</p>
              <p className="text-muted-foreground text-xs">
                {isRole(member.role) ? ROLE_LABELS[member.role] : member.role}
              </p>
            </div>
            <Button
              variant={isAssigned ? "secondary" : "outline"}
              size="sm"
              disabled={pending}
              onClick={() => toggle(member.id, !isAssigned)}
            >
              {isAssigned ? "Remove" : "Assign"}
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
