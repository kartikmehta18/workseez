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
import { GenerateKeyButton, ViewKeyButton } from "../../../_components/generate-key-button"
import type { TeamMember } from "../actions"
import { RoleSelect } from "./role-select"
import { StatusToggle } from "./status-toggle"

type RoleFilter = Role | "ALL"

/**
 * "20 Aug 2026" rather than the locale default. `toLocaleDateString()` renders
 * "8/20/2026", which is both ambiguous across locales and just wide enough to
 * wrap inside the Access column.
 */
const shortDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

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
  canResetKey,
}: {
  users: TeamMember[]
  actorId: string
  canSetRole: boolean
  canDisable: boolean
  canResetKey: boolean
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
                  <TableHead className="whitespace-nowrap">Access</TableHead>
                  <TableHead className="whitespace-nowrap">Scope</TableHead>
                  <TableHead className="whitespace-nowrap">Role</TableHead>
                  {/* w-0 plus nowrap contents: the column shrinks to exactly the
                      buttons and every other column keeps the slack. */}
                  <TableHead className="w-0 text-right whitespace-nowrap">Access key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const isOwner = isSuperAdminEmail(user.email)
                  const isSelf = user.id === actorId
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="align-middle">
                        {/* Capped, so a long address like
                            2022pietcakartik029@poornima.org ellipsises instead
                            of setting the width of the whole table — `truncate`
                            alone does nothing in an auto-layout table, which
                            sizes each column to its widest content. */}
                        <div className="flex max-w-[260px] items-center gap-3">
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
                      <TableCell className="align-middle">
                        <InviteStatusBadge status={user.status} />
                        {/* nowrap and short: "Key issued 8/20/2026" wrapped to a
                            second line and pushed the badge off the row's centre
                            line, and the longer wording widened the table. */}
                        <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">
                          {user.accessKeySetAt ? `Key · ${shortDate(user.accessKeySetAt)}` : "No key"}
                        </div>
                      </TableCell>
                      {/* Free to wrap. Pinned to one line it was the column that
                          pushed the table past the page and produced the
                          horizontal scrollbar. */}
                      <TableCell className="text-muted-foreground align-middle text-sm">
                        {scopeFor(user)}
                      </TableCell>
                      <TableCell className="align-middle">
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
                      <TableCell className="align-middle">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* Icons here, words in the mobile cards below: the
                              labelled pair cost roughly 180px this row does not
                              have. Both carry a tooltip and an accessible name. */}
                          {canResetKey && user.accessKeySetAt ? (
                            <ViewKeyButton
                              target={{ kind: "user", id: user.id }}
                              description={user.email}
                              iconOnly
                            />
                          ) : null}
                          {canResetKey && user.status !== "DISABLED" ? (
                            <GenerateKeyButton
                              target={{ kind: "user", id: user.id }}
                              label={user.accessKeySetAt ? "Send a new key" : "Give an access key"}
                              description={user.email}
                              iconOnly
                            />
                          ) : null}
                          {canDisable && !isOwner && !isSelf ? (
                            <StatusToggle userId={user.id} status={user.status} />
                          ) : null}
                        </div>
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
                      <p className="text-muted-foreground mt-1 text-xs">
                        {user.accessKeySetAt
                          ? `Key issued ${shortDate(user.accessKeySetAt)}`
                          : "No access key"}
                      </p>

                      {(canSetRole && !isOwner) ||
                      (canDisable && !isOwner && !isSelf) ||
                      (canResetKey && user.status !== "DISABLED") ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canResetKey && user.accessKeySetAt ? (
                            <ViewKeyButton
                              target={{ kind: "user", id: user.id }}
                              description={user.email}
                            />
                          ) : null}
                          {canResetKey && user.status !== "DISABLED" ? (
                            <GenerateKeyButton
                              target={{ kind: "user", id: user.id }}
                              label={user.accessKeySetAt ? "New key" : "Give key"}
                              description={user.email}
                            />
                          ) : null}
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
