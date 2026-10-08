import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/session"
import { absoluteUrl } from "@/lib/urls"

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(absoluteUrl("/", request), { status: 303 })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
