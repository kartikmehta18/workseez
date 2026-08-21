"use client"

import * as React from "react"
import { Check, Copy, Eye, KeyRound, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { regenerateClientAccessKey, showClientAccessKey } from "../clients/actions"
import {
  regenerateAccessKey,
  regenerateMyAccessKey,
  requestAccessKey,
  showAccessKey,
  showMyAccessKey,
} from "../settings/access/actions"

type Target =
  /** A row in the user directory. */
  | { kind: "user"; id: string }
  /** A client profile — the account that owns it. */
  | { kind: "client"; id: string }
  /** The signed-in person's own key. */
  | { kind: "self" }

type Shown =
  /** Just generated: worth saying whether the email went out. */
  | { mode: "issued"; key: string; emailed: boolean }
  /** Read back from the stored copy. */
  | { mode: "revealed"; key: string }

type ButtonProps = {
  target: Target
  label?: string
  /** Who the key belongs to, shown in the dialog — a name or an email address. */
  description?: string
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: React.ComponentProps<typeof Button>["size"]
  /**
   * Drops the text and keeps the icon, with the label moving to the tooltip and
   * the accessible name. The directory table needs it: five columns plus three
   * labelled buttons ran wider than the page and gave the table a horizontal
   * scrollbar. Everywhere with room to spare keeps the words.
   */
  iconOnly?: boolean
  className?: string
}

/** Shared trigger so the icon-only handling is written once, not twice. */
function ActionButton({
  icon,
  label,
  iconOnly,
  pendingLabel,
  pending,
  variant,
  size,
  className,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  iconOnly?: boolean
  pendingLabel: string
  pending: boolean
  variant: React.ComponentProps<typeof Button>["variant"]
  size: React.ComponentProps<typeof Button>["size"]
  className?: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      onClick={onClick}
      disabled={pending}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      className={cn(iconOnly && "size-9", className)}
    >
      {icon}
      {iconOnly ? null : pending ? pendingLabel : label}
    </Button>
  )
}

/**
 * Shows the key an account already has.
 *
 * This is why the key is kept encrypted rather than only hashed: before, an
 * admin asked "what key does this client have?" and the only way to answer was
 * to issue a new one, breaking the key the client was already using.
 */
export function ViewKeyButton({
  target,
  label = "View key",
  description,
  variant = "outline",
  size = "sm",
  iconOnly,
  className,
}: ButtonProps) {
  const [shown, setShown] = React.useState<Shown | null>(null)
  const [pending, startTransition] = React.useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await reveal(target)
      if (!result.ok) return void toast.error(result.error)
      if (!result.accessKey) return void toast.error("There's no key on this account yet.")
      setShown({ mode: "revealed", key: result.accessKey })
    })
  }

  return (
    <>
      <ActionButton
        icon={<Eye />}
        label={label}
        pendingLabel="Opening…"
        pending={pending}
        iconOnly={iconOnly}
        variant={variant}
        size={size}
        className={className}
        onClick={onClick}
      />
      <KeyDialog shown={shown} onClose={() => setShown(null)} description={description} />
    </>
  )
}

/**
 * Issues a new key and shows it. The previous key stops working the moment this
 * returns, so it is also the "that key leaked" button.
 */
export function GenerateKeyButton({
  target,
  label = "Send new key",
  description,
  variant = "outline",
  size = "sm",
  iconOnly,
  className,
}: ButtonProps) {
  const [shown, setShown] = React.useState<Shown | null>(null)
  const [pending, startTransition] = React.useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await regenerate(target)
      if (!result.ok) return void toast.error(result.error)
      if (!result.accessKey) {
        // Shouldn't happen — every ok path returns the key — but a plain
        // "couldn't read it back" beats pretending it worked.
        return void toast.error("The key was generated but couldn't be read back. Try again.")
      }
      setShown({ mode: "issued", key: result.accessKey, emailed: Boolean(result.emailed) })
    })
  }

  return (
    <>
      <ActionButton
        icon={<KeyRound />}
        label={label}
        pendingLabel="Generating…"
        pending={pending}
        iconOnly={iconOnly}
        variant={variant}
        size={size}
        className={className}
        onClick={onClick}
      />
      <KeyDialog shown={shown} onClose={() => setShown(null)} description={description} />
    </>
  )
}

/**
 * What a client or manager gets in place of a generate button: it asks the
 * admins for a key and changes nothing on the account. Issuing a key *is* the
 * grant of access, so it stays with the roles that hold user:resetKey.
 */
export function RequestKeyButton({
  label = "Request a new key",
  variant = "outline",
  size = "sm",
  className,
}: Omit<ButtonProps, "target" | "description" | "iconOnly">) {
  const [pending, startTransition] = React.useTransition()
  const [sent, setSent] = React.useState(false)

  function onClick() {
    startTransition(async () => {
      const result = await requestAccessKey()
      if (!result.ok) return void toast.error(result.error)
      setSent(true)
      toast.success("Request sent. An admin will email you a new key.")
    })
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={pending || sent}
      className={className}
    >
      {sent ? <Check /> : <Send />}
      {sent ? "Request sent" : pending ? "Sending…" : label}
    </Button>
  )
}

/** The panel both buttons open: big digits, one copy button, one caveat. */
function KeyDialog({
  shown,
  onClose,
  description,
}: {
  shown: Shown | null
  onClose: () => void
  description?: string
}) {
  const [copied, setCopied] = React.useState(false)

  async function copy(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
    } catch {
      toast.error("Couldn't copy — select the digits and copy them by hand.")
    }
  }

  return (
    <Dialog
      open={shown !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setCopied(false)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{shown?.mode === "issued" ? "New access key" : "Access key"}</DialogTitle>
          <DialogDescription>
            {description ? `For ${description}. ` : null}
            {shown?.mode === "issued"
              ? shown.emailed
                ? "It's on its way by email as well."
                : "The email couldn't be sent, so pass this on yourself."
              : "This is the key on the account right now."}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted rounded-md py-6 text-center">
          <span className="font-mono text-3xl font-semibold tracking-[0.4em] indent-[0.4em]">
            {shown?.key}
          </span>
        </div>

        <p className="text-muted-foreground text-xs">
          {shown?.mode === "issued"
            ? "Any earlier key has stopped working. You can look this one up again whenever you need it."
            : "These digits are all it takes to sign in as this account — share them the way you would a password."}
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => shown && copy(shown.key)}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy key"}
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* Each target has its own action, and every one re-checks the permission on the
   server — these two maps are routing, not authorisation. */

function regenerate(target: Target) {
  if (target.kind === "self") return regenerateMyAccessKey()

  const formData = new FormData()
  formData.set("id", target.id)
  formData.set("userId", target.id)
  return target.kind === "client"
    ? regenerateClientAccessKey(formData)
    : regenerateAccessKey(formData)
}

function reveal(target: Target) {
  if (target.kind === "self") return showMyAccessKey()

  const formData = new FormData()
  formData.set("id", target.id)
  formData.set("userId", target.id)
  return target.kind === "client" ? showClientAccessKey(formData) : showAccessKey(formData)
}
