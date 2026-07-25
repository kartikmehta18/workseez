"use client"

import { ChevronDown, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ROLE_LABELS, type Actor } from "@/lib/rbac"

export function UserMenu({ actor }: { actor: Actor }) {
  const display = actor.name ?? actor.email
  const initial = display.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent focus-visible:ring-ring flex max-w-55 cursor-pointer items-center gap-2 rounded-full border py-1 pr-2 pl-1 transition-colors focus-visible:ring-2 focus-visible:outline-none">
        <Avatar className="size-7 shrink-0">
          {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initial}
          </AvatarFallback>
        </Avatar>
        {/* The name is decoration on phones — the avatar alone identifies you. */}
        <span className="hidden truncate text-sm font-medium sm:inline">{display}</span>
        <ChevronDown className="text-muted-foreground size-4 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          <Avatar className="size-9 shrink-0">
            {actor.avatarUrl ? <AvatarImage src={actor.avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{display}</p>
            <p className="text-muted-foreground truncate text-xs">{actor.email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <div className="text-muted-foreground px-2 py-1.5 text-xs">
          Signed in as <span className="text-foreground font-medium">{ROLE_LABELS[actor.role]}</span>
        </div>
        <DropdownMenuSeparator />

        {/* A real POST form so sign-out still works with JS disabled and can
            clear the httpOnly session cookie server-side. */}
        <form action="/api/auth/signout" method="post">
          <DropdownMenuItem
            asChild
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <button type="submit" className="w-full cursor-pointer">
              <LogOut className="size-4" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
