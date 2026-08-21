import Link from "next/link"
import { redirect } from "next/navigation"
import { getCurrentActor } from "@/lib/auth"
import { safeNextPath } from "@/lib/session"
import { GoogleIcon } from "@/components/ui/google-icon"
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AccessKeyForm } from "./_components/access-key-form"
export const metadata = {
  title: "Sign in — Workseez",
}

const ERRORS: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in. Give it another try.",
  state_mismatch: "That sign-in link expired. Please start again.",
  invalid_request: "That sign-in link expired. Please start again.",
  sign_in_failed: "We couldn't complete sign-in with Google. Please try again.",
  unverified: "Your Google account doesn't have a verified email address.",
  // Access is invite-only: an admin must create the account before first login.
  not_invited:
    "That Google account isn't on this workspace yet. Ask your account manager to add you.",
  account_disabled: "This account has been disabled. Contact your account manager.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { error, next } = await searchParams
  const actor = await getCurrentActor()
  const target = safeNextPath(next)
  if (actor?.status === "ACTIVE") redirect(target)

  const signInHref = `/api/auth/signin/google?next=${encodeURIComponent(target)}`

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
           <Image
          src='/logo.jpeg'
          alt=""
          width={60}
          height={60}
          className={cn('border-border rounded-sm border object-cover size-8')}
        />
            </span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
              Welcome to Workseez
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to reach your projects, files and client updates.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {ERRORS[error] ?? ERRORS.sign_in_failed}
            </p>
          ) : null}

          {/* Two ways in, both landing on the same session cookie: the key for
              people with no Google account on this address, Google for the
              rest. Neither is a fallback for the other. */}
          <AccessKeyForm next={target} />

          <div className="my-6 flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">or</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <a
            href={signInHref}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </a>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            By continuing you agree to our{" "}
            <Link href="#" className="text-foreground underline underline-offset-4">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-foreground underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
