import { NextResponse, type NextRequest } from "next/server"
import { decodeSession, SESSION_COOKIE } from "@/lib/session"

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const user = await decodeSession(request.cookies.get(SESSION_COOKIE)?.value)

  if (!user) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
