import { Header } from "@/components/ui/header-2"
import { getCurrentActor } from "@/lib/auth"
import { displayNameFor } from "@/lib/rbac"

export async function Navbar() {
  const actor = await getCurrentActor()
  return (
    <Header
      user={
        actor
          ? {
              name: displayNameFor(actor),
              email: actor.email,
              picture: actor.avatarUrl,
            }
          : null
      }
    />
  )
}
