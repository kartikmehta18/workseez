import {
  SiFacebook,
  SiGithub,
  SiInstagram,
  SiX,
} from "@icons-pack/react-simple-icons"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*  Marketing footer — brand, nav links, socials and a large faint wordmark.   */
/* -------------------------------------------------------------------------- */

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clients", href: "/login" },

]

/** Simple Icons dropped its LinkedIn mark, so we ship it inline. */
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
    </svg>
  )
}

const socials = [
  { label: "X (Twitter)", href: "https://x.com", Icon: SiX },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedInIcon },
  { label: "Facebook", href: "https://facebook.com", Icon: SiFacebook },
  { label: "Instagram", href: "https://instagram.com", Icon: SiInstagram },
]

const Footer = ({ className }: { className?: string }) => {
  return (
    <footer
      className={cn(
        "relative overflow-hidden border-t border-border bg-background",
        className,
      )}
    >
      <div className="container relative z-10 max-w-5xl pt-14 pb-40 md:pb-48">
        {/* brand */}
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2 font-semibold text-primary"
        >
          <Image
            src="/logo.jpeg"
            alt="Workseez"
            width={32}
            height={32}
            className="size-8 rounded-sm border border-border object-cover"
          />
          <span className="text-lg">Workseez</span>
        </Link>

        {/* nav links */}
        <nav
          className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
          aria-label="Footer"
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* dashed divider */}
        <div className="mt-8 h-px w-full border-t border-dashed border-border [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]" />

        {/* copyright + socials */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Workseez. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-primary"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
                    <p className="text-sm text-muted-foreground">
Developed By <a href="https://www.linkedin.com/in/kartik-mehta-6729b0255/" target="_blank" className="hover:text-primary">Kartikmehta</a>
          </p>
        </div>
      </div>

      {/* large faint wordmark */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-4 select-none bg-gradient-to-b from-primary/[0.06] to-primary/0 bg-clip-text text-center font-extrabold leading-none tracking-tighter text-transparent md:-bottom-8"
        style={{ fontSize: "clamp(4rem, 22vw, 20rem)" }}
      >
        Workseez
      </span>
    </footer>
  )
}

export { Footer }
