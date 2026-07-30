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
  /** Optional label/value rows — the post's date, status and so on. */
  details?: { label: string; value: string }[]
  buttonLabel: string
  buttonHref: string
  /** Small print under the button, e.g. which account to sign in with. */
  footnote?: string
  /** Closing line under the card. Defaults to the invite wording. */
  footer?: string
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
  details,
  buttonLabel,
  buttonHref,
  footnote,
  footer,
}: Layout) {
  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:#374151;">${line}</p>`,
    )
    .join("")

  // Two-column rows in a bordered box. A <table> rather than a <dl> for the
  // same reason as the rest of this file: Word's engine ignores most of it.
  const detailRows =
    details && details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border:1px solid ${BORDER};border-radius:8px;background-color:#f9fafb;">
          ${details
            .map(
              ({ label, value }) =>
                `<tr>
                  <td style="padding:10px 14px;font-family:${FONT};font-size:13px;line-height:20px;color:${MUTED};white-space:nowrap;">${escapeHtml(label)}</td>
                  <td style="padding:10px 14px;font-family:${FONT};font-size:13px;line-height:20px;color:#111827;font-weight:600;">${escapeHtml(value)}</td>
                </tr>`,
            )
            .join("")}
        </table>`
      : ""

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
                ${detailRows}

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
                ${escapeHtml(
                  footer ??
                    "You received this email because someone at Workseez invited you to the client portal.",
                )}
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

/* ------------------------------------------------------------------ *
 * Content calendar
 *
 * Four notifications, in two directions. The client hears when work lands on
 * their calendar or moves on; the team hears when the client does something
 * they are waiting for. Nothing is sent for a post the client cannot see, so
 * these are all fired after the state change, by the action that made it.
 * ------------------------------------------------------------------ */

const CONTENT_FOOTER = "You're getting this because you're on a Workseez content calendar."

type PostMailBase = {
  to: string
  /** Who the mail is about — the client, not necessarily the recipient. */
  name?: string | null
  postTitle: string
  kindLabel: string
  statusLabel: string
  dateLabel?: string | null
}

const calendarUrl = () => `${appOrigin()}/dashboard/content`

const postDetails = ({
  postTitle,
  kindLabel,
  statusLabel,
  dateLabel,
}: Pick<PostMailBase, "postTitle" | "kindLabel" | "statusLabel" | "dateLabel">) => [
  { label: "Content", value: postTitle },
  { label: "Type", value: kindLabel },
  ...(dateLabel ? [{ label: "Planned for", value: dateLabel }] : []),
  { label: "Status", value: statusLabel },
]

/** A post has been published to the client for the first time. */
export async function sendContentPublishedEmail({
  to,
  name,
  postTitle,
  kindLabel,
  statusLabel,
  dateLabel,
  needsRawUpload,
}: PostMailBase & { needsRawUpload: boolean }) {
  const url = calendarUrl()

  const html = renderLayout({
    preheader: `${postTitle} is on your content calendar.`,
    heading: "New content on your calendar",
    body: [
      greeting(name),
      `Your team has added <strong>${escapeHtml(postTitle)}</strong> to your content calendar. Open it to read the script and the shoot direction.`,
      needsRawUpload
        ? "This one needs footage from you — there's an upload button on the card that drops your files straight into the right Drive folder."
        : "Anything you'd like changed, leave it as feedback on the post and your team will pick it up.",
    ],
    details: postDetails({ postTitle, kindLabel, statusLabel, dateLabel }),
    buttonLabel: "Open your content calendar",
    buttonHref: url,
    footer: CONTENT_FOOTER,
  })

  const text = asText([
    `Hi${name ? ` ${name.trim().split(/\s+/)[0]}` : ""},`,
    "",
    `Your team has added "${postTitle}" to your content calendar.`,
    "",
    `Type: ${kindLabel}`,
    ...(dateLabel ? [`Planned for: ${dateLabel}`] : []),
    `Status: ${statusLabel}`,
    ...(needsRawUpload ? ["", "This one needs raw footage from you."] : []),
    "",
    `Open it here: ${url}`,
  ])

  return sendMail({ to, subject: `New on your calendar: ${postTitle}`, html, text })
}

/** The status of a post the client can already see has moved. */
export async function sendContentStatusEmail({
  to,
  name,
  postTitle,
  kindLabel,
  statusLabel,
  dateLabel,
  previousStatusLabel,
}: PostMailBase & { previousStatusLabel: string }) {
  const url = calendarUrl()

  const html = renderLayout({
    preheader: `${postTitle} is now ${statusLabel.toLowerCase()}.`,
    heading: "A post on your calendar moved on",
    body: [
      greeting(name),
      `<strong>${escapeHtml(postTitle)}</strong> has moved from <strong>${escapeHtml(previousStatusLabel)}</strong> to <strong>${escapeHtml(statusLabel)}</strong>.`,
    ],
    details: postDetails({ postTitle, kindLabel, statusLabel, dateLabel }),
    buttonLabel: "See the update",
    buttonHref: url,
    footer: CONTENT_FOOTER,
  })

  const text = asText([
    `Hi${name ? ` ${name.trim().split(/\s+/)[0]}` : ""},`,
    "",
    `"${postTitle}" has moved from ${previousStatusLabel} to ${statusLabel}.`,
    ...(dateLabel ? [`Planned for: ${dateLabel}`] : []),
    "",
    `See it here: ${url}`,
  ])

  return sendMail({ to, subject: `${postTitle} — now ${statusLabel.toLowerCase()}`, html, text })
}

/** The client has left feedback on a post. Goes to the team, not the client. */
export async function sendContentFeedbackEmail({
  to,
  clientName,
  postTitle,
  excerpt,
  clientId,
}: {
  to: string
  clientName: string
  postTitle: string
  excerpt: string
  clientId: string
}) {
  const url = `${appOrigin()}/dashboard/clients/${clientId}/content`

  const html = renderLayout({
    preheader: `${clientName} left feedback on ${postTitle}.`,
    heading: `${clientName} left feedback`,
    body: [
      `<strong>${escapeHtml(clientName)}</strong> commented on <strong>${escapeHtml(postTitle)}</strong>:`,
      `<span style="display:block;padding:12px 14px;border-left:3px solid ${BORDER};color:#374151;">${escapeHtml(excerpt)}</span>`,
    ],
    buttonLabel: "Open the calendar",
    buttonHref: url,
    footer: CONTENT_FOOTER,
  })

  const text = asText([
    `${clientName} commented on "${postTitle}":`,
    "",
    excerpt,
    "",
    `Open it here: ${url}`,
  ])

  return sendMail({ to, subject: `Feedback from ${clientName}: ${postTitle}`, html, text })
}

/** Raw footage has landed in Drive. Goes to the team. */
export async function sendContentUploadEmail({
  to,
  clientName,
  postTitle,
  fileCount,
  folderUrl,
  clientId,
}: {
  to: string
  clientName: string
  postTitle: string
  fileCount: number
  folderUrl: string | null
  clientId: string
}) {
  const url = `${appOrigin()}/dashboard/clients/${clientId}/content`
  const files = `${fileCount} ${fileCount === 1 ? "file" : "files"}`

  const html = renderLayout({
    preheader: `${clientName} uploaded ${files} for ${postTitle}.`,
    heading: "Raw footage uploaded",
    body: [
      `<strong>${escapeHtml(clientName)}</strong> uploaded <strong>${escapeHtml(files)}</strong> for <strong>${escapeHtml(postTitle)}</strong>.`,
      folderUrl
        ? `It's in Drive now: <a href="${folderUrl}" style="color:#1d4ed8;">open the folder</a>.`
        : "It's in the shared Drive folder for that post.",
    ],
    buttonLabel: "Open the calendar",
    buttonHref: url,
    footer: CONTENT_FOOTER,
  })

  const text = asText([
    `${clientName} uploaded ${files} for "${postTitle}".`,
    ...(folderUrl ? ["", `Drive folder: ${folderUrl}`] : []),
    "",
    `Open the calendar: ${url}`,
  ])

  return sendMail({ to, subject: `${clientName} uploaded footage for ${postTitle}`, html, text })
}
