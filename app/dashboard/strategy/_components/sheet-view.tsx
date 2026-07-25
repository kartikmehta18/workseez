import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import { type SheetSection } from "@/lib/strategy"

/**
 * The read-only rendering of a strategy sheet — what the client opens, and what
 * the team previews before publishing.
 *
 * A server component: nothing here is interactive, so keeping it off the client
 * bundle means a long sheet costs no hydration. Every table scrolls inside its
 * own container rather than letting the page scroll sideways, which is what
 * keeps a wide Content Pillars grid usable on a phone.
 */
export function SheetView({
  title,
  description,
  sections,
  signOff,
}: {
  title: string
  description: string | null
  sections: SheetSection[]
  signOff?: {
    strategistName: string | null
    strategistDate: Date | null
    teamLeadName: string | null
    teamLeadDate: Date | null
  }
}) {
  const hasSignOff =
    signOff && (signOff.strategistName || signOff.teamLeadName)

  return (
    <article className="bg-card rounded-xl border shadow-sm">
      <header className="border-b px-5 py-5 sm:px-7">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </header>

      {sections.length === 0 ? (
        <div className="px-5 py-16 text-center sm:px-7">
          <FileText className="text-muted-foreground mx-auto size-8" />
          <p className="mt-3 text-sm font-medium">Nothing written yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            This sheet has no sections.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {sections.map((section) => (
            <SectionView key={section.id} section={section} />
          ))}
        </div>
      )}

      {hasSignOff ? (
        <footer className="border-t px-5 py-5 sm:px-7">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Sign-off
          </h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <SignOffEntry role="Strategist" name={signOff.strategistName} date={signOff.strategistDate} />
            <SignOffEntry role="Team Lead" name={signOff.teamLeadName} date={signOff.teamLeadDate} />
          </dl>
        </footer>
      ) : null}
    </article>
  )
}

function SignOffEntry({
  role,
  name,
  date,
}: {
  role: string
  name: string | null
  date: Date | null
}) {
  return (
    <div className="bg-muted/40 rounded-lg border px-4 py-3">
      <dt className="text-muted-foreground text-xs">{role}</dt>
      <dd className="mt-0.5 font-medium">{name || "—"}</dd>
      {date ? (
        <dd className="text-muted-foreground mt-0.5 text-xs">{date.toLocaleDateString()}</dd>
      ) : null}
    </div>
  )
}

function SectionView({ section }: { section: SheetSection }) {
  return (
    <section className="px-5 py-6 sm:px-7">
      <h3 className="text-base font-semibold tracking-tight">{section.title}</h3>
      {section.intro ? (
        <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm leading-relaxed">
          {section.intro}
        </p>
      ) : null}

      <div className="mt-4">
        {section.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Nothing here yet.</p>
        ) : section.kind === "FIELDS" ? (
          <FieldsTable section={section} />
        ) : section.kind === "TABLE" ? (
          <DataTable section={section} />
        ) : (
          <NotesList section={section} />
        )}
      </div>
    </section>
  )
}

/** Renders a blank cell as an em dash so an empty row still reads as a row. */
function Cell({ value, className }: { value: string; className?: string }) {
  const text = value.trim()
  return (
    <span className={cn("whitespace-pre-wrap", !text && "text-muted-foreground", className)}>
      {text || "—"}
    </span>
  )
}

function FieldsTable({ section }: { section: SheetSection }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <dl className="divide-y">
        {section.rows.map((row) => (
          <div key={row.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(140px,220px)_1fr] sm:gap-4">
            <dt className="text-muted-foreground text-sm font-medium">{row.label || "—"}</dt>
            <dd className="min-w-0 text-sm leading-relaxed">
              <Cell value={row.cells[0] ?? ""} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function DataTable({ section }: { section: SheetSection }) {
  if (section.columns.length === 0) {
    return <p className="text-muted-foreground text-sm italic">This table has no columns yet.</p>
  }

  return (
    // The scroll container is the table's own, so a wide grid never drags the
    // whole page sideways on a phone.
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="bg-muted/60 border-b">
            {section.columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="px-4 py-2.5 text-left align-bottom font-medium whitespace-nowrap"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {section.rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30 align-top transition-colors">
              {section.columns.map((column, index) => (
                <td key={column.id} className="max-w-xs px-4 py-3 leading-relaxed">
                  <Cell value={row.cells[index] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function NotesList({ section }: { section: SheetSection }) {
  return (
    <ul className="space-y-2">
      {section.rows.map((row) => (
        <li key={row.id} className="flex gap-2.5 text-sm leading-relaxed">
          <span aria-hidden className="bg-primary/40 mt-2 size-1.5 shrink-0 rounded-full" />
          <Cell value={row.cells[0] ?? ""} />
        </li>
      ))}
    </ul>
  )
}
