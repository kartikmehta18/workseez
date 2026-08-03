import Image from "next/image"
import Link from "next/link"
import { requireActor } from "@/lib/auth"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { DashboardSidebar } from "./_components/dashboard-sidebar"
import { PageTransition } from "./_components/page-transition"
import { UserMenu } from "./_components/user-menu"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor()

  return (
    <SidebarProvider>
      <DashboardSidebar actor={actor} />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm sm:px-4">
          {/* <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.jpeg"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md border object-cover"
            />
            <span className="truncate text-sm font-semibold tracking-tight">Workseez</span>
          </Link> */}

          {/* <Separator orientation="vertical" className="mx-1 h-4" /> */}
          <SidebarTrigger />

          <div className="ml-auto flex items-center gap-2">
            <UserMenu actor={actor} />
          </div>
        </header>
        {/* Tighter gutters on phones — 24px each side eats a lot of a 360px viewport. */}
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          {/* Wraps only the page, so a slow route swaps to a skeleton here
              while the sidebar and header above stay live and clickable. */}
          <PageTransition>{children}</PageTransition>
        </div>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  )
}
