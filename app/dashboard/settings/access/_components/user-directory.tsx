"use client"

import * as React from "react"
import { Search, UsersRound, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isSuperAdminEmail, ROLE_LABELS, ROLES, type Role } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import { InviteStatusBadge, RoleBadge } from "../../../_components/status-badges"
import type { TeamMember } from "../actions"
import { RoleSelect } from "./role-select"
import { StatusToggle } from "./status-toggle"

type RoleFilter = Role | "ALL"

/**
 * Filtering happens on the client over the already-loaded list. The whole team
 * is fetched in one query anyway, so round-tripping to the server for a
 * substring match would only add latency.
 */
export function UserDirectory({
  users,
  actorId,
  canSetRole,
  canDisable,
}: {
  users: TeamMember[]
  actorId: string
  canSetRole: boolean
  canDisable: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [role, setRole] = React.useState<RoleFilter>("ALL")

  const counts = React.useMemo(() => {
    const base: Record<RoleFilter, number> = {
      ALL: users.length,
      SUPER_ADMIN: 0,
      ADMIN: 0,
      MANAGER: 0,
      CLIENT: 0,
    }
    for (const user of users) base[user.role]++
    return base
  }, [users])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((user) => {
      if (role !== "ALL" && user.role !== role) return false
      if (!needle) return true
      return (
        (user.name ?? "").toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        (user.ownedClientName ?? "").toLowerCase().includes(needle)
      )
    })
  }, [users, query, role])

  const scopeFor = (user: TeamMember) =>
    user.ownedClientName
      ? `Client: ${user.ownedClientName}`
      : user.role === "MANAGER"
        ? `${user.managedCount} assigned client${user.managedCount === 1 ? "" : "s"}`
        : "All clients"

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email or client"
            aria-label="Search people"
            className="pr-9 pl-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-sm p-1"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* Role filter as a segmented control — there are only five options, so
            a dropdown would hide the counts that make the split obvious. */}
        <div
          role="group"
          aria-label="Filter by role"
          className="bg-muted flex w-full gap-1 overflow-x-auto rounded-md p-1 lg:w-auto"
        >
          {(["ALL", ...ROLES] as RoleFilter[]).map((option) => {
            const active = role === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                aria-pressed={active}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "ALL" ? "Everyone" : ROLE_LABELS[option]}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    active ? "text-muted-foreground" : "text-muted-foreground/70",
                  )}
                >
                  {counts[option]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
        Showing {filtered.length} of {users.length}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed p-12 text-center">
          <UsersRound className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No one matches</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Try a different name, email or role.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery("")
              setRole("ALL")
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-3 hidden rounded-lg border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const isOwner = isSuperAdminEmail(user.email)
                  const isSelf = user.id === actorId
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                            <AvatarFallback>
                              {(user.name ?? user.email).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{user.name ?? "—"}</span>
                              {isSelf ? (
                                <span className="text-muted-foreground text-xs">(you)</span>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground truncate text-xs">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <InviteStatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {scopeFor(user)}
                      </TableCell>
                      <TableCell>
                        {canSetRole && !isOwner ? (
                          <RoleSelect
                            key={user.role}
                            userId={user.id}
                            role={user.role}
                            disabled={Boolean(user.ownedClientName)}
                            disabledReason="This account owns a client profile."
                          />
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </TableCell>
                      <TableCell>
                        {canDisable && !isOwner && !isSelf ? (
                          <StatusToggle userId={user.id} status={user.status} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / tablet cards */}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((user) => {
              const isOwner = isSuperAdminEmail(user.email)
              const isSelf = user.id === actorId
              return (
                <li key={user.id} className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10 shrink-0">
                      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                      <AvatarFallback>
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{user.name ?? "—"}</span>
                        {isSelf ? (
                          <span className="text-muted-foreground text-xs">(you)</span>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">{user.email}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <RoleBadge role={user.role} />
                        <InviteStatusBadge status={user.status} />
                      </div>

                      <p className="text-muted-foreground mt-2 text-xs">{scopeFor(user)}</p>

                      {(canSetRole && !isOwner) || (canDisable && !isOwner && !isSelf) ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canSetRole && !isOwner ? (
                            <RoleSelect
                              key={user.role}
                              userId={user.id}
                              role={user.role}
                              disabled={Boolean(user.ownedClientName)}
                              disabledReason="This account owns a client profile."
                            />
                          ) : null}
                          {canDisable && !isOwner && !isSelf ? (
                            <StatusToggle userId={user.id} status={user.status} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
