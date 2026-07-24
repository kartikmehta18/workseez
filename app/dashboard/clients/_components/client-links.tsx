import { ExternalLink } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { GoogleDriveIcon } from "@/components/ui/google-drive-icon"
import { cn } from "@/lib/utils"

/**
 * `rel="noreferrer"` alongside `noopener` because these URLs are entered by
 * admins and point off-platform — the destination has no business knowing which
 * client page it was opened from.
 */
const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const

/** Compact Drive button for table rows. Renders nothing when unset. */
export function DriveIconLink({ url, clientName }: { url: string | null; clientName: string }) {
  if (!url) return null
  return (
    <a
      href={url}
      {...EXTERNAL}
      aria-label={`Open ${clientName}'s Google Drive folder`}
      title="Open Google Drive folder"
      className={buttonVariants({ variant: "ghost", size: "icon", className: "size-8" })}
    >
      <GoogleDriveIcon />
    </a>
  )
}

/** Full-width Drive button for the client overview page. */
export function DriveButton({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <a href={url} {...EXTERNAL} className={buttonVariants({ variant: "outline" })}>
      <GoogleDriveIcon /> Google Drive
      <ExternalLink className="text-muted-foreground" />
    </a>
  )
}

export type DisplayLink = { id: string; label: string; url: string }

export function SocialLinkList({ links }: { links: DisplayLink[] }) {
  if (links.length === 0) {
    return <p className="text-muted-foreground text-sm">No social links added yet.</p>
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.id} className="min-w-0">
          <a
            href={link.url}
            {...EXTERNAL}
            title={link.url}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "max-w-full justify-start",
            )}
          >
            <span className="truncate">{link.label}</span>
            <ExternalLink className="text-muted-foreground shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  )
}
