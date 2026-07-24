"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, LayoutDashboard, Settings, Target, Users, UserCog } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { type Actor } from "@/lib/rbac"

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard }

/**
 * Nav is derived from the role here rather than passed in as props: lucide
 * icons are functions and cannot cross the server/client boundary. This is
 * presentation only — each page still enforces its own permissions server-side.
 */
function navFor(role: Actor["role"]): { main: NavItem[]; admin: NavItem[] } {
  if (role === "CLIENT") {
    return {
      main: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        // Always shown, even before a form is published — the page explains
        // that it is still being prepared, which beats a nav item that appears
        // out of nowhere one day.
        { href: "/dashboard/onboarding", label: "Onboarding Form", icon: ClipboardList },
        { href: "/dashboard/strategy", label: "Strategy Sheet", icon: Target },
      ],
      admin: [],
    }
  }

  const main: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/clients", label: "Clients", icon: Users },
    { href: "/dashboard/onboarding", label: "Onboarding", icon: ClipboardList },
    { href: "/dashboard/strategy", label: "Strategy", icon: Target },
  ]

  // Only the Super Admin can reach role management.
  const admin: NavItem[] =
    role === "SUPER_ADMIN"
      ? [
          { href: "/dashboard/settings/access", label: "User Access", icon: UserCog },
          { href: "/dashboard/settings", label: "Settings", icon: Settings },
        ]
      : role === "ADMIN"
        ? [{ href: "/dashboard/settings", label: "Settings", icon: Settings }]
        : []

  return { main, admin }
}

export function DashboardSidebar({ actor }: { actor: Actor }) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const nav = navFor(actor.role)

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href)

  // On phones the sidebar is an overlay sheet — it has to close itself on
  // navigation, otherwise it stays parked over the page you just opened.
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const renderItems = (items: NavItem[]) =>
    items.map(({ href, label, icon: Icon }) => (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          asChild
          isActive={isActive(href)}
          tooltip={label}
          className="group/nav relative h-10 gap-3 rounded-lg font-medium data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-sm data-[active=true]:hover:bg-sidebar-primary data-[active=true]:hover:text-sidebar-primary-foreground"
        >
          <Link href={href} onClick={closeOnMobile}>
            <Icon className="transition-transform group-hover/nav:scale-110" />
            <span>{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ))

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-sidebar-border border-b p-3">
        <Link
          href="/dashboard"
          onClick={closeOnMobile}
          className="hover:bg-sidebar-accent flex items-center gap-2.5 rounded-lg p-1 transition-colors group-data-[collapsible=icon]:justify-center"
        >
          <Image
            src="/logo.jpeg"
            alt=""
            width={32}
            height={32}
            className="border-sidebar-border size-8 shrink-0 rounded-lg border object-cover"
          />
          <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sidebar-primary truncate text-sm leading-tight font-semibold">
              Workseez
            </span>
            <span className="text-muted-foreground truncate text-[11px] leading-tight">
              Client Portal
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{renderItems(nav.main)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {nav.admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{renderItems(nav.admin)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* No footer profile block — identity and sign-out live in the top bar's
          UserMenu, so repeating them here would just be a second control for
          the same thing. */}
    </Sidebar>
  )
}
