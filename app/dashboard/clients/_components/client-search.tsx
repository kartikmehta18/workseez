"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

export function ClientSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(initialQuery)
  const [, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  function push(next: string) {
    const q = next.trim()
    // A transition keeps the current list on screen instead of flashing the
    // route's loading skeleton on every keystroke.
    startTransition(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false })
    })
  }

  function onChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => push(next), 250)
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current)
    setValue("")
    push("")
  }

  return (
    <div className="relative w-full sm:w-64">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search clients…"
        aria-label="Search clients"
        className="px-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}
