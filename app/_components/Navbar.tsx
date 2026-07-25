import { Header } from "@/components/ui/header-2"
import { getCurrentActor } from "@/lib/auth"

export async function Navbar() {
  const actor = await getCurrentActor()
  return (
    <Header
      user={
        actor
          ? {
              name: actor.name ?? actor.email,
              email: actor.email,
              picture: actor.avatarUrl,
            }
          : null
      }
    />
  )
}
