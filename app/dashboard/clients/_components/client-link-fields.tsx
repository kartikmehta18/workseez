"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_CLIENT_LINKS } from "@/lib/links"

export type LinkRow = { label: string; url: string }

/**
 * Repeatable label/URL pairs for a client's social accounts.
 *
 * Rows are plain uncontrolled inputs named `linkLabel` / `linkUrl`; React only
 * owns how many rows exist. `FormData.getAll` on the server then reads them as
 * parallel arrays, so no serialisation format has to be agreed on.
 *
 * Rows carry a stable key because keying by index makes React reuse the wrong
 * DOM node when a middle row is removed, leaving stale text in the inputs.
 */
export function ClientLinkFields({ initial = [] }: { initial?: LinkRow[] }) {
  const [rows, setRows] = React.useState(() =>
    (initial.length > 0 ? initial : [{ label: "", url: "" }]).map((row, index) => ({
      ...row,
      key: index,
    })),
  )
  // Seeded past the initial rows' keys so newly added rows never collide.
  // Only ever read and written from event handlers, never during render.
  const nextKey = React.useRef(rows.length)

  const addRow = () =>
    setRows((current) =>
      current.length >= MAX_CLIENT_LINKS
        ? current
        : [...current, { label: "", url: "", key: nextKey.current++ }],
    )

  const removeRow = (key: number) =>
    setRows((current) =>
      // Never drop to zero rows — an empty editor gives the user nothing to
      // type into and no obvious way back.
      current.length === 1 ? [{ label: "", url: "", key: nextKey.current++ }] : current.filter((r) => r.key !== key),
    )

  return (
    <div className="grid gap-2">
      <Label>Social links</Label>
      <p className="text-muted-foreground -mt-1 text-xs">
        Instagram, YouTube, LinkedIn — add as many as the client has.
      </p>

      <div className="grid gap-2">
        {rows.map((row, index) => (
          <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              name="linkLabel"
              defaultValue={row.label}
              placeholder="Platform"
              aria-label={`Link ${index + 1} label`}
              className="sm:w-36 sm:shrink-0"
            />
            <Input
              name="linkUrl"
              defaultValue={row.url}
              placeholder="https://instagram.com/username"
              inputMode="url"
              aria-label={`Link ${index + 1} URL`}
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(row.key)}
              aria-label={`Remove link ${index + 1}`}
              className="text-muted-foreground hover:text-destructive self-end sm:self-auto"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRow}
        disabled={rows.length >= MAX_CLIENT_LINKS}
        className="justify-self-start"
      >
        <Plus /> Add another link
      </Button>
    </div>
  )
}
