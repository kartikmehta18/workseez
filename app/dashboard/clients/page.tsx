import Link from "next/link"
import { ChevronRight, Users } from "lucide-react"
import { requireActor } from "@/lib/auth"
import { listVisibleClients } from "@/lib/clients"
import { can } from "@/lib/rbac"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AddClientDialog } from "./_components/add-client-dialog"
import { DriveIconLink, SocialLinkList } from "./_components/client-links"
import { ClientStatusBadge, InviteStatusBadge } from "../_components/status-badges"

export const metadata = { title: "Clients — Workseez" }

export default async function ClientsPage() {
  const actor = await requireActor()
  const clients = await listVisibleClients(actor)
  const canCreate = can(actor, "client:create")

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm">
            {can(actor, "client:viewAll")
              ? "Every client in the workspace."
              : "The clients you are assigned to."}
          </p>
        </div>
        {canCreate ? <AddClientDialog /> : null}
      </div>

      {clients.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <Users className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 font-medium">No clients yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
            {canCreate
              ? "Add your first client with the email they will sign in to Google with."
              : "You have not been assigned to any clients yet."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: full table. Below `lg` there are too many columns to fit
              without horizontal scrolling, so the card list below takes over. */}
          <div className="mt-6 hidden rounded-lg border lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Login email</TableHead>
                  <TableHead>Portal access</TableHead>
                  <TableHead>Managers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-0 text-center">Drive</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 shrink-0">
                          {client.owner?.avatarUrl ? (
                            <AvatarImage src={client.owner.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback>{client.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{client.name}</div>
                          {client.company ? (
                            <div className="text-muted-foreground truncate text-xs">
                              {client.company}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {client.owner?.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <InviteStatusBadge status={client.owner?.status ?? "INVITED"} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {client.managers.length === 0
                        ? "Unassigned"
                        : client.managers.map((m) => m.user.name ?? m.user.email).join(", ")}
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <DriveIconLink url={client.driveUrl} clientName={client.name} />
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/clients/${client.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile / tablet: one card per client. */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
            {clients.map((client) => (
              <li key={client.id} className="rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10 shrink-0">
                    {client.owner?.avatarUrl ? (
                      <AvatarImage src={client.owner.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>{client.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="flex items-center gap-1 font-medium hover:underline"
                    >
                      <span className="truncate">{client.name}</span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </Link>
                    {client.company ? (
                      <p className="text-muted-foreground truncate text-xs">{client.company}</p>
                    ) : null}
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {client.owner?.email ?? "—"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ClientStatusBadge status={client.status} />
                      <InviteStatusBadge status={client.owner?.status ?? "INVITED"} />
                    </div>

                    <p className="text-muted-foreground mt-3 text-xs">
                      {client.managers.length === 0
                        ? "Unassigned"
                        : client.managers.map((m) => m.user.name ?? m.user.email).join(", ")}
                    </p>

                    {client.links.length > 0 || client.driveUrl ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <DriveIconLink url={client.driveUrl} clientName={client.name} />
                        {client.links.length > 0 ? <SocialLinkList links={client.links} /> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
