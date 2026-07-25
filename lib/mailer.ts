import { readFile } from "node:fs/promises"
import path from "node:path"
import nodemailer, { type Transporter } from "nodemailer"

/**
 * SMTP is optional: a developer running the portal locally without mail
 * credentials should still be able to invite people. When the host is missing
 * every send is skipped (and logged) instead of throwing, so the invite itself
 * never fails because of mail configuration.
 */
function smtpConfig() {
  const host = process.env.SMTP_HOST
  if (!host) return null

  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASSWORD

  return {
    host,
    port,
    // Port 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    // SMTP_SECURE overrides the guess for hosts that do neither by convention.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: user && pass ? { user, pass } : undefined,
  }
}

/**
 * Cached on globalThis for the same reason as the Prisma pool: the transport is
 * built at module scope, so every dev hot reload would otherwise leave another
 * pool of open SMTP connections behind.
 */
const globalForMail = globalThis as unknown as {
  mailTransport?: Transporter | null
  mailLogo?: Buffer
}

function transport(): Transporter | null {
  if (globalForMail.mailTransport !== undefined) return globalForMail.mailTransport

  const config = smtpConfig()
  // `pool` keeps one connection warm across the handful of mails this app
  // sends, rather than reconnecting (and re-authenticating) per invite.
  const created = config ? nodemailer.createTransport({ ...config, pool: true }) : null

  globalForMail.mailTransport = created
  return created
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
    cid: LOGO_CID,
    contentType: "image/jpeg",
  }
}

export type MailInput = {
  to: string
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
  const mailer = transport()
  if (!mailer) {
    console.warn(`[mail] SMTP_HOST is not set — skipped "${subject}" to ${to}`)
    return false
  }

  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM || `"Workseez" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
      attachments: [await logoAttachment()],
    })
    return true
  } catch (error) {
    console.error(`[mail] failed to send "${subject}" to ${to}`, error)
    return false
  }
}

/** Absolute origin for links in emails, without a trailing slash. */
export function appOrigin() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")
}
