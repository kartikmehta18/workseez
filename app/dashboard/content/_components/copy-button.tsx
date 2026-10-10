"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Copies a block of text to the clipboard — the LinkedIn description, which is
 * written here and pasted into LinkedIn by hand.
 */
export function CopyButton({
  text,
  html,
  label,
  className,
}: {
  text: string
  /** Formatted version, copied alongside the text so a paste into a doc keeps its formatting. */
  html?: string
  /** What is being copied, e.g. "Description" — used for the toast and aria label. */
  label: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        // Both flavours at once: a doc takes the formatted one, LinkedIn's
        // composer takes the plain one.
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ])
      } else {
        await navigator.clipboard.writeText(text)
      }
      toast.success(`${label} copied.`)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.")
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground size-7 shrink-0", className)}
      disabled={!text.trim()}
      onClick={copy}
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
    </Button>
  )
}
