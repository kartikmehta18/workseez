import {
  contentBlockTitle,
  contentBodyLabel,
  isContentBodyLabel,
  isVideoKind,
  linkify,
  toContentKind,
  toContentPlatform,
} from "@/lib/content"
import { bodyToHtml, isRichBody, RICH_TEXT_CLASS } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

/**
 * The written block — one labelled line per row, the way the agency writes them:
 * "Shoot Direction: …", "Text hook: …", "Voice over: …", "Cta: …" on a reel, and
 * "Title: …", "Content: …" on a post or a carousel.
 *
 * Labels are inline with their body rather than stacked above it, because most
 * bodies are a sentence and stacking would double the height of a card the
 * client is meant to skim on a phone.
 *
 * URLs are linked through `linkify` rather than `dangerouslySetInnerHTML`:
 * script bodies are typed by a human into a form, so they are never trusted
 * markup, but they are full of reference reels the client is expected to tap.
 */

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const

function Body({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.value}
            {...EXTERNAL}
            className="text-primary font-medium break-all underline underline-offset-2 hover:opacity-80"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  )
}

export function ScriptView({
  lines,
  kind,
  platform,
  className,
}: {
  lines: { id: string; label: string; body: string }[]
  /** Decides what the block is called when it is still empty. */
  kind?: string
  /** On LinkedIn the copy row reads as the description. */
  platform?: string
  className?: string
}) {
  const filled = lines.filter((line) => line.body.trim().length > 0)
  const resolvedKind = toContentKind(kind)
  const resolvedPlatform = toContentPlatform(platform)

  if (filled.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
        The {contentBlockTitle(resolvedKind, resolvedPlatform).toLowerCase()}{" "}
        for this one hasn&apos;t been written yet.
      </p>
    )
  }

  const linkedInCopy = resolvedPlatform === "LINKEDIN" && !isVideoKind(resolvedKind)

  return (
    <div className={cn("bg-muted/40 rounded-lg border", className)}>
      <dl className="divide-border/60 divide-y">
        {filled.map((line) => {
          // A LinkedIn post saved before the rename still holds "Content" on
          // the row; it reads as the description either way.
          const isDescription = linkedInCopy && isContentBodyLabel(line.label)
          const label = isDescription ? contentBodyLabel(resolvedPlatform) : line.label

          return (
            <div key={line.id} className="px-4 py-3 text-sm leading-relaxed">
              <dt className="sr-only">{label}</dt>
              {isRichBody(line.body) ? (
                // Formatted text is a block of its own, so the label sits above
                // it. bodyToHtml sanitizes, whatever wrote the row.
                <dd>
                  <span className="text-foreground font-semibold">{label} :</span>
                  <div
                    className={cn("text-muted-foreground mt-1", RICH_TEXT_CLASS)}
                    dangerouslySetInnerHTML={{ __html: bodyToHtml(line.body) }}
                  />
                </dd>
              ) : (
                <dd className="whitespace-pre-wrap wrap-break-word">
                  <span className="text-foreground font-semibold">{label} : </span>
                  <span className="text-muted-foreground">
                    <Body text={line.body} />
                  </span>
                </dd>
              )}
            </div>
          )
        })}
      </dl>
    </div>
  )
}
