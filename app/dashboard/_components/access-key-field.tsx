"use client"

import * as React from "react"
import { Dices } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ACCESS_KEY_LENGTH, generateAccessKey } from "@/lib/access-key-format"

/**
 * The access-key input on the invite forms, with a button that fills it in.
 *
 * Leaving it blank still works — the server draws a key either way. The button
 * is for the admin who wants to *see* the digits before sending, so they can
 * read them out over the phone while the invite is still being written.
 *
 * Drawn in the browser rather than by a round trip: the value is only a
 * suggestion in a form field, and the server re-checks its shape and
 * uniqueness before anything is stored.
 */
export function AccessKeyField({
  id = "accessKey",
  name = "accessKey",
  hint,
}: {
  id?: string
  name?: string
  hint?: string
}) {
  const [value, setValue] = React.useState("")

  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>Access key</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          name={name}
          value={value}
          onChange={(event) =>
            setValue(event.target.value.replace(/\D/g, "").slice(0, ACCESS_KEY_LENGTH))
          }
          inputMode="numeric"
          maxLength={ACCESS_KEY_LENGTH}
          pattern={`\\d{${ACCESS_KEY_LENGTH}}`}
          placeholder="Leave blank to generate one"
          className="font-mono"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setValue(generateAccessKey())}
          title="Fill in a random key"
          className="shrink-0"
        >
          <Dices /> Generate
        </Button>
      </div>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}
