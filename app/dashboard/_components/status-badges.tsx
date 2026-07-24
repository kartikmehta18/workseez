import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ROLE_LABELS, isRole } from "@/lib/rbac"

/**
 * Engagement state of the client account. Rendered as a dot + label rather than
 * a solid pill so it cannot be mistaken for the invite badge — the two sit side
 * by side in the client lists and both can read "Active".
 */
export function ClientStatusBadge({ status }: { status: string }) {
  const dot =
    status === "ACTIVE"
      ? "bg-emerald-500"
      : status === "PAUSED"
        ? "bg-amber-500"
        : "bg-muted-foreground"

  return (
    <Badge variant="outline" className="gap-1.5 bg-background font-medium capitalize">
      <span className={cn("size-1.5 rounded-full", dot)} />
      {status.toLowerCase()}
    </Badge>
  )
}

/** Whether an invited account has actually signed in with Google yet. */
export function InviteStatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
      >
        Signed in
      </Badge>
    )
  }
  if (status === "DISABLED") return <Badge variant="destructive">Disabled</Badge>
  return (
    <Badge variant="secondary" className="border-amber-200 bg-amber-50 font-medium text-amber-700">
      Invite pending
    </Badge>
  )
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={role === "SUPER_ADMIN" ? "default" : "secondary"}>
      {isRole(role) ? ROLE_LABELS[role] : role}
    </Badge>
  )
}
