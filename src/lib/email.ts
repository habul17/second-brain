import "server-only"
import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const from = process.env.EMAIL_FROM ?? "Second Brain <noreply@abulhassan.dev>"

/** Password reset only works when email is set up. */
export const canSendEmail = resend !== null

/** Sends a plain, single-button email. Without a Resend key (local dev) it prints the link instead. */
export async function sendEmail({ to, subject, intro, button, url }: {
  to: string
  subject: string
  intro: string
  button: string
  url: string
}) {
  if (!resend) {
    console.log(`\n📧  ${subject} → ${to}\n    ${url}\n`)
    return
  }
  const html = `
    <div style="font-family:ui-monospace,Menlo,monospace;max-width:480px;margin:0 auto;padding:32px 20px;color:#111">
      <p style="font-size:15px;line-height:1.6">${intro}</p>
      <p style="margin:28px 0"><a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${button}</a></p>
      <p style="font-size:12px;color:#666;line-height:1.6">If you didn't ask for this, you can ignore this email.</p>
    </div>`
  const { error } = await resend.emails.send({ from, to, subject, html, text: `${intro}\n\n${url}` })
  if (error) throw new Error(`Email failed: ${error.message}`)
}
