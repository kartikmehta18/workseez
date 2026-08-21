"use client"

import * as React from "react"
import { useActionState } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { signInWithKey, type KeySignInState } from "../actions"

const KEY_LENGTH = 6

/**
 * Sign-in with the 6-digit key alone — no email field, so it works for someone
 * reading the key off a phone and typing it into a laptop.
 *
 * The value is held in state purely to strip non-digits as they type; the
 * server re-validates it, and the form still submits without JavaScript.
 */
export function AccessKeyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<KeySignInState, FormData>(signInWithKey, {})
  const [value, setValue] = React.useState("")

  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="access-key">Access key</Label>
        <input
          id="access-key"
          name="key"
          value={value}
          onChange={(event) =>
            setValue(event.target.value.replace(/\D/g, "").slice(0, KEY_LENGTH))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={KEY_LENGTH}
          placeholder="••••••"
          aria-describedby="access-key-hint"
          aria-invalid={state.error ? true : undefined}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground/60 focus-visible:ring-ring flex h-14 w-full rounded-md border text-center font-mono text-2xl tracking-[0.5em] indent-[0.5em] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          required
        />
        <p id="access-key-hint" className="text-muted-foreground text-xs">
          The {KEY_LENGTH}-digit key from your invite email.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="h-11 w-full" disabled={pending || value.length < KEY_LENGTH}>
        <KeyRound /> {pending ? "Signing in…" : "Sign in with key"}
      </Button>
    </form>
  )
}
