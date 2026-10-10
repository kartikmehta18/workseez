/**
 * Formatted text for a LinkedIn description.
 *
 * A description pasted from Google Docs keeps its bold, lists and headings, so
 * the body of that line is stored as HTML rather than plain text. Everything
 * here is a pure string function with no DOM, because the same code has to run
 * in three places: in the browser when something is pasted, on the server when
 * the post is saved, and again wherever the body is rendered.
 *
 * Safety does not depend on which of those ran. `sanitizeRichHtml` never passes
 * input through: it rebuilds the markup from a fixed list of bare tags and
 * escaped text, so nothing a person pastes — a script, an event handler, a
 * `javascript:` link — can survive it. Rendering sanitizes again, so a row
 * written by any other path is just as safe to show.
 */

/** Prefix on a stored body that marks it as formatted HTML rather than plain text. */
const RICH_MARK = "<!--rich-->"

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
])

/** What browsers and other editors write, mapped onto the tags kept above. */
const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  div: "p",
  strike: "s",
  del: "s",
}

/** Tags whose close also ends a line when the text is flattened. */
const BLOCK_TAGS = new Set(["p", "li", "h1", "h2", "h3", "h4", "blockquote", "ul", "ol"])

type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; href?: string }
  | { type: "close"; tag: string }

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? match
    const point =
      code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return Number.isFinite(point) && point > 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : ""
  })
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Only links a reader could safely be sent to. */
function safeHref(attributes: string): string | undefined {
  const match = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes)
  if (!match) return undefined
  const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim()
  return /^(https?:\/\/|mailto:)/i.test(href) ? href : undefined
}

/**
 * Splits markup into text and the tags this module keeps. Every other tag is
 * dropped — its text stays, the tag itself does not — and so is every
 * attribute except a vetted `href`.
 */
function tokenize(html: string): Token[] {
  const source = html
    // The contents of these are never text a person meant to paste.
    .replace(/<(script|style|head|title)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")

  const tokens: Token[] = []
  const pattern = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let last = 0

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ type: "text", value: decodeEntities(source.slice(last, index)) })
    last = index + match[0].length

    const name = match[2].toLowerCase()
    const tag = TAG_ALIASES[name] ?? name
    if (!ALLOWED_TAGS.has(tag)) continue

    if (match[1]) {
      tokens.push({ type: "close", tag })
    } else if (tag === "a") {
      const href = safeHref(match[3])
      // A link with nowhere safe to go is just its text.
      if (href) tokens.push({ type: "open", tag, href })
    } else {
      tokens.push({ type: "open", tag })
    }
  }

  if (last < source.length) tokens.push({ type: "text", value: decodeEntities(source.slice(last)) })
  return tokens
}

/**
 * Rebuilds markup from the allowed tags only, balanced, with all text escaped.
 * The result is safe to hand to `dangerouslySetInnerHTML`.
 */
export function sanitizeRichHtml(html: string): string {
  const open: string[] = []
  let out = ""

  for (const token of tokenize(html)) {
    if (token.type === "text") {
      out += escapeHtml(token.value)
    } else if (token.type === "open") {
      if (token.tag === "br") {
        out += "<br>"
        continue
      }
      out +=
        token.tag === "a"
          ? `<a href="${escapeHtml(token.href ?? "")}" target="_blank" rel="noopener noreferrer">`
          : `<${token.tag}>`
      open.push(token.tag)
    } else if (open.includes(token.tag)) {
      // Close everything opened since, so a stray close cannot unbalance the rest.
      while (open.length > 0) {
        const tag = open.pop()!
        out += `</${tag}>`
        if (tag === token.tag) break
      }
    }
  }

  while (open.length > 0) out += `</${open.pop()}>`
  return out
}

/** Flattens markup to text: one line per block, list items keeping their marker. */
function htmlToPlain(html: string): string {
  const lists: { ordered: boolean; count: number }[] = []
  let out = ""
  const newline = () => {
    if (out && !out.endsWith("\n")) out += "\n"
  }

  for (const token of tokenize(html)) {
    if (token.type === "text") {
      out += token.value.replace(/\s*\n\s*/g, " ")
    } else if (token.type === "open") {
      if (token.tag === "br") out += "\n"
      else if (token.tag === "ul" || token.tag === "ol") {
        newline()
        lists.push({ ordered: token.tag === "ol", count: 0 })
      } else if (token.tag === "li") {
        newline()
        const list = lists[lists.length - 1]
        if (list) list.count += 1
        out += list?.ordered ? `${list.count}. ` : "• "
      } else if (BLOCK_TAGS.has(token.tag)) {
        newline()
      }
    } else {
      if (token.tag === "ul" || token.tag === "ol") lists.pop()
      if (BLOCK_TAGS.has(token.tag)) newline()
    }
  }

  return out.replace(/\n{3,}/g, "\n\n").trim()
}

function plainToHtml(text: string) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>")
}

/** Whether a stored body is formatted HTML. */
export function isRichBody(body: string) {
  return body.startsWith(RICH_MARK)
}

/** Wraps editor markup as a stored body, sanitized. */
export function toRichBody(html: string) {
  return RICH_MARK + sanitizeRichHtml(html)
}

/**
 * A stored body as safe HTML, whichever way it was saved — a plain one keeps
 * its line breaks.
 */
export function bodyToHtml(body: string) {
  return isRichBody(body) ? sanitizeRichHtml(body.slice(RICH_MARK.length)) : plainToHtml(body)
}

/** A stored body as plain text — for counting words, searching and pasting into LinkedIn. */
export function bodyToPlain(body: string) {
  return isRichBody(body) ? htmlToPlain(body.slice(RICH_MARK.length)) : body
}

/**
 * What the server stores for a submitted body: formatted bodies re-sanitized,
 * plain ones untouched. A formatted body with no text in it is no body at all.
 */
export function cleanSubmittedBody(body: string) {
  if (!isRichBody(body)) return body
  const clean = toRichBody(body.slice(RICH_MARK.length))
  return bodyToPlain(clean) ? clean : ""
}

/**
 * Styles for rendered formatted text. The CSS reset strips list markers and
 * heading sizes, so they are put back here, scoped to the block.
 */
export const RICH_TEXT_CLASS = [
  "wrap-break-word",
  "[&_p]:min-h-[1.25em]",
  "[&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li>p]:inline",
  "[&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:text-base [&_h2]:font-semibold",
  "[&_h3]:font-semibold [&_h4]:font-semibold",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3",
  "[&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
].join(" ")
