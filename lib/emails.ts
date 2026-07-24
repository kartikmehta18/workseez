import { appOrigin, LOGO_CID, sendMail } from "@/lib/mailer"
import { ROLE_LABELS, type Role } from "@/lib/rbac"

/**
 * Email HTML is deliberately old-fashioned: tables for layout and inline
 * styles only. Outlook renders with Word's engine, which ignores flexbox,
 * grid and most of a <style> block, so anything more modern collapses there.
 */
const NAVY = "#061128"
const PAGE_BG = "#f4f5f7"
const BORDER = "#e5e7eb"
const MUTED = "#6b7280"
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

type Layout = {
  /** Hidden line shown as the inbox snippet next to the subject. */
  preheader: string
  heading: string
  /** Paragraphs of body copy, rendered above the button. */
  body: string[]
  buttonLabel: string
  buttonHref: string
  /** Small print under the button, e.g. which account to sign in with. */
  footnote?: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

function renderLayout({
  preheader,
  heading,
  body,
  buttonLabel,
  buttonHref,
  footnote,
}: Layout) {
  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:#374151;">${line}</p>`,
    )
    .join("")

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:${PAGE_BG};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

            <!-- Brand bar -->
            <tr>
              <td align="center" style="background-color:${NAVY};border-radius:12px 12px 0 0;padding:26px 32px;">
                <!-- The mark is square, so it sits beside the wordmark rather than
                     being stretched across the header. -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:12px;">
                      <img src="cid:${LOGO_CID}" width="44" height="44" alt="Workseez" style="display:block;width:44px;height:44px;border:0;border-radius:10px;" />
                    </td>
                    <td style="font-family:${FONT};font-size:20px;font-weight:600;letter-spacing:-0.2px;color:#ffffff;">Workseez</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border:1px solid ${BORDER};border-top:0;border-radius:0 0 12px 12px;padding:36px 32px 32px;">
                <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;color:#0f172a;">${escapeHtml(heading)}</h1>
                ${paragraphs}

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;">
                  <tr>
                    <td align="center" bgcolor="${NAVY}" style="border-radius:8px;">
                      <a href="${buttonHref}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(buttonLabel)}</a>
                    </td>
                  </tr>
                </table>

                ${
                  footnote
                    ? `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};">${footnote}</p>`
                    : ""
                }

                <p style="margin:22px 0 0;padding-top:20px;border-top:1px solid ${BORDER};font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
                  If the button doesn't work, paste this into your browser:<br />
                  <a href="${buttonHref}" style="color:#1d4ed8;word-break:break-all;">${escapeHtml(buttonHref)}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 16px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">
                You received this email because someone at Workseez invited you to the client portal.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

const asText = (lines: string[]) => lines.join("\n")

type InviteInput = {
  to: string
  name?: string | null
  /** The admin or manager who created the account. */
  invitedBy?: string | null
}

const greeting = (name?: string | null) => {
  const first = name?.trim().split(/\s+/)[0]
  return first ? `Hi ${escapeHtml(first)},` : "Hi,"
}

const invitedByLine = (invitedBy?: string | null) =>
  invitedBy ? `${escapeHtml(invitedBy)} has invited you` : "You've been invited"

/** Invite for a team member (Admin or Manager). */
export async function sendTeamInviteEmail({
  to,
  name,
  invitedBy,
  role,
}: InviteInput & { role: Role }) {
  const loginUrl = `${appOrigin()}/login`
  const roleLabel = ROLE_LABELS[role]

  const html = renderLayout({
    preheader: `Your Workseez account is ready — sign in as a ${roleLabel}.`,
    heading: "You've been invited to Workseez",
    body: [
      greeting(name),
      `${invitedByLine(invitedBy)} to join the Workseez client portal as a <strong>${escapeHtml(roleLabel)}</strong>.`,
      "Sign in to see the clients you work with, their files, updates and everything the team keeps in one place.",
    ],
    buttonLabel: "Sign in to Workseez",
    buttonHref: loginUrl,
    footnote: `Sign in with Google using <strong>${escapeHtml(to)}</strong> — access is tied to that address.`,
  })

  const text = asText([
    `Hi${name ? ` ${name.trim().split(/\s+/)[0]}` : ""},`,
    "",
    `${invitedBy ? `${invitedBy} has invited you` : "You've been invited"} to join the Workseez client portal as a ${roleLabel}.`,
    "",
    `Sign in here: ${loginUrl}`,
    "",
    `Use Google sign-in with ${to} — access is tied to that address.`,
  ])

  return sendMail({ to, subject: "You've been invited to Workseez", html, text })
}

/** Invite for a client whose portal profile was just created. */
export async function sendClientInviteEmail({
  to,
  name,
  invitedBy,
  company,
}: InviteInput & { company?: string | null }) {
  const loginUrl = `${appOrigin()}/login`

  const html = renderLayout({
    preheader: "Your Workseez client portal is ready — sign in to take a look.",
    heading: "Your Workseez portal is ready",
    body: [
      greeting(name),
      `${invitedByLine(invitedBy)} to the Workseez client portal${
        company ? ` for <strong>${escapeHtml(company)}</strong>` : ""
      }.`,
      "It's where you'll find your project progress, shared files and updates from your account manager — all in one place.",
    ],
    buttonLabel: "Sign in to your portal",
    buttonHref: loginUrl,
    footnote: `Sign in with Google using <strong>${escapeHtml(to)}</strong> — access is tied to that address.`,
  })

  const text = asText([
    `Hi${name ? ` ${name.trim().split(/\s+/)[0]}` : ""},`,
    "",
    `${invitedBy ? `${invitedBy} has invited you` : "You've been invited"} to the Workseez client portal${
      company ? ` for ${company}` : ""
    }.`,
    "",
    `Sign in here: ${loginUrl}`,
    "",
    `Use Google sign-in with ${to} — access is tied to that address.`,
  ])

  return sendMail({ to, subject: "Your Workseez portal is ready", html, text })
}
