"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  bodyToHtml,
  escapeHtml,
  RICH_TEXT_CLASS,
  sanitizeRichHtml,
  toRichBody,
} from "@/lib/rich-text"

/**
 * Google Docs does not mark bold with <b>: it wraps the whole paste in a
 * `<b style="font-weight:normal">` and puts the real formatting in inline
 * styles on spans. This reads those styles back into plain tags, which is the
 * only form the sanitizer keeps.
 */
function normalizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "")
    if (!(node instanceof HTMLElement)) return ""

    const tag = node.tagName.toLowerCase()
    if (["script", "style", "meta", "title", "head"].includes(tag)) return ""

    let inner = Array.from(node.childNodes).map(walk).join("")
    const { fontWeight, fontStyle, textDecoration, textDecorationLine } = node.style
    const decoration = `${textDecoration} ${textDecorationLine}`

    const weight = Number(fontWeight)
    const styledBold = fontWeight === "bold" || fontWeight === "bolder" || weight >= 600
    const styledNormal = fontWeight === "normal" || (weight > 0 && weight < 600)

    if (styledBold) inner = `<strong>${inner}</strong>`
    if (fontStyle === "italic") inner = `<em>${inner}</em>`
    if (decoration.includes("underline") && tag !== "a") inner = `<u>${inner}</u>`
    if (decoration.includes("line-through")) inner = `<s>${inner}</s>`

    // A span is only ever a carrier for styles, and a <b> styled back to
    // normal weight is Docs' wrapper rather than bold.
    if (tag === "span" || tag === "font") return inner
    if ((tag === "b" || tag === "strong") && (styledNormal || styledBold)) return inner

    if (tag === "br") return "<br>"
    if (tag === "a") return `<a href="${escapeHtml(node.getAttribute("href") ?? "")}">${inner}</a>`
    return `<${tag}>${inner}</${tag}>`
  }

  return sanitizeRichHtml(walk(doc.body))
}

/**
 * The LinkedIn description field: a text box that keeps formatting.
 *
 * Uncontrolled on purpose. The browser owns the caret, and writing the markup
 * back on every keystroke would throw it to the start of the box — so the
 * starting content is set once and every change is reported outwards as a
 * sanitized body for the form to post.
 */
export function RichTextEditor({
  id,
  initialBody,
  onChange,
  placeholder,
  invalid,
  labelledBy,
}: {
  id: string
  /** The stored body to start from — formatted or plain. */
  initialBody: string
  /** Called with the body to store: sanitized markup, or "" when there is no text. */
  onChange: (body: string) => void
  placeholder?: string
  invalid?: boolean
  labelledBy?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // Fixed at mount: React only rewrites the box when this string changes.
  const [initialHtml] = React.useState(() => bodyToHtml(initialBody))
  const [empty, setEmpty] = React.useState(() => initialBody.trim().length === 0)

  const emit = () => {
    const element = ref.current
    if (!element) return
    const hasText = element.innerText.trim().length > 0
    setEmpty(!hasText)
    onChange(hasText ? toRichBody(element.innerHTML) : "")
  }

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const html = event.clipboardData.getData("text/html")
    const text = event.clipboardData.getData("text/plain")
    const clean = html ? normalizePastedHtml(html) : escapeHtml(text).replace(/\r?\n/g, "<br>")
    // Deprecated, but still the only insert that lands at the caret and stays
    // on the browser's undo stack.
    document.execCommand("insertHTML", false, clean)
    emit()
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className={cn(
          "border-input bg-background ring-offset-background focus-visible:ring-ring max-h-96 min-h-32 w-full overflow-y-auto rounded-md border px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:text-sm",
          RICH_TEXT_CLASS,
          invalid && "border-destructive",
        )}
      />
      {empty && placeholder ? (
        <span className="text-muted-foreground pointer-events-none absolute top-2 left-3 text-base md:text-sm">
          {placeholder}
        </span>
      ) : null}
    </div>
  )
}
