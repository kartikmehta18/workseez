import { readFile } from "node:fs/promises"
import path from "node:path"
import { Resend } from "resend"
import { configuredOrigin } from "@/lib/urls"

/**
 * Mail goes out through Resend's HTTP API rather than SMTP: one HTTPS request
 * per message, no pooled sockets to keep alive, and no Gmail sending limits.
 *
 * It is optional: a developer running the portal locally without a key should
 * still be able to invite people. When RESEND_API_KEY is missing every send is
 * skipped (and logged) instead of throwing, so the invite itself never fails
 * because of mail configuration.
 *
 * Cached on globalThis for the same reason as the Prisma pool. `mailClientKey`
 * is the key the cached client was built from: the dev server re-reads .env
 * when it is edited but this cache outlives that, so without it a corrected key
 * kept failing with the old one until the server was restarted by hand.
 */
const globalForMail = globalThis as unknown as {
  mailClient?: Resend | null
  mailClientKey?: string
  mailLogo?: Buffer
  nextMailSlot?: number
}

function client(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY || ""
  if (globalForMail.mailClient !== undefined && globalForMail.mailClientKey === apiKey) {
    return globalForMail.mailClient
  }
  globalForMail.mailClient = apiKey ? new Resend(apiKey) : null
  globalForMail.mailClientKey = apiKey
  return globalForMail.mailClient
}

/**
 * The sender must be on a domain verified in Resend. Resend's shared
 * onboarding@resend.dev works without one, but only delivers to the address
 * that owns the Resend account — fine for a first test, not for real invites.
 */
function sender() {
  const from = process.env.MAIL_FROM?.trim() || "Workseez <onboarding@resend.dev>"
  // Resend rejects a bare "<a@b.com>", the likeliest slip when setting the
  // variable by hand: it needs a name in front or no brackets at all.
  return from.startsWith("<") ? `Workseez ${from}` : from
}

/**
 * The logo is attached rather than linked. A remote <img> would need a public
 * APP_URL to resolve, which is exactly what does not exist in development — and
 * many clients block remote images by default while showing inline ones.
 */
export const LOGO_CID = "workseez-logo"

async function logoAttachment() {
  if (!globalForMail.mailLogo) {
    globalForMail.mailLogo = await readFile(path.join(process.cwd(), "public", "logo.jpeg"))
  }
  return {
    filename: "workseez.jpeg",
    content: globalForMail.mailLogo,
    // Setting contentId is what makes Resend send it inline, so the template's
    // <img src="cid:workseez-logo"> resolves instead of showing as a download.
    contentId: LOGO_CID,
    contentType: "image/jpeg",
  }
}

/**
 * Resend allows a team 2 requests a second, and the notification loops send
 * one mail per post or per team member back to back — publishing a cycle of
 * ten posts would otherwise burst well past it. Each send reserves the next
 * free slot before it waits; the reservation is synchronous, so concurrent
 * callers in this process queue up rather than race. Other processes share
 * the same limit, which is what the retry in sendMail is for.
 */
const MIN_GAP_MS = 550
const RATE_LIMIT_RETRIES = 3

async function waitForSendSlot() {
  const now = Date.now()
  const slot = Math.max(now, globalForMail.nextMailSlot ?? 0)
  globalForMail.nextMailSlot = slot + MIN_GAP_MS
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now))
}

/**
 * Nodemailer accepted "a@x.com, b@y.com" as a list and some callers still pass
 * one (the access-key request goes to every admin). Resend wants an array for
 * more than one recipient.
 */
function recipients(to: string) {
  return to
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean)
}

export type MailInput = {
  // Nullable: a client may be added without an email, and every send site
  // treats "nowhere to send it" the same way it treats a failed send.
  to: string | null
  subject: string
  html: string
  text: string
}

/**
 * Sends one mail and reports whether it left the building. Callers treat a
 * `false` as "the record was still created, just tell the admin to share the
 * link themselves" — mail is a courtesy here, not the source of access.
 */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<boolean> {
  // No address is not an error: clients created without one are reachable
  // only through the access key their admin reads out to them.
  if (!to) return false

  const resend = client()
  if (!resend) {
    console.warn(`[mail] RESEND_API_KEY is not set — skipped "${subject}" to ${to}`)
    return false
  }

  try {
    const message = {
      from: sender(),
      to: recipients(to),
      subject,
      text,
      html,
      attachments: [await logoAttachment()],
    }

    // Enough to diagnose a failed send from the deployment's logs: which sender
    // and which key this deployment really has. Only the key's last four
    // characters — they tell keys apart, and the rest must never reach a log.
    console.log(
      `[mail] sending "${subject}" to ${to} from ${message.from} (key …${process.env.RESEND_API_KEY?.slice(-4)})`,
    )

    // Resend reports API failures (unverified sender, bad key, rate limit) in
    // `error` rather than by throwing; the catch is for network failures.
    for (let attempt = 1; ; attempt++) {
      await waitForSendSlot()
      const { data, error } = await resend.emails.send(message)
      if (!error) {
        console.log(`[mail] accepted "${subject}" to ${to} — Resend id ${data?.id}`)
        return true
      }

      if (error.name === "rate_limit_exceeded" && attempt <= RATE_LIMIT_RETRIES) {
        console.warn(`[mail] rate limited on "${subject}" to ${to} — retry ${attempt}/${RATE_LIMIT_RETRIES}`)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        continue
      }
      console.error(
        `[mail] Resend rejected "${subject}" to ${to} from ${message.from}: ${error.statusCode} ${error.name} — ${error.message}`,
      )
      return false
    }
  } catch (error) {
    console.error(`[mail] failed to send "${subject}" to ${to}`, error)
    return false
  }
}

/** Absolute origin for links in emails, without a trailing slash. */
export function appOrigin() {
  return configuredOrigin() || "http://localhost:3000"
}
