import nodemailer from 'nodemailer'
import { dbAll } from './db'

type MemberRow = { name: string; email: string }

// ─── Mention parsing ──────────────────────────────────────────────────────────

export function findMentionedMembers(content: string): MemberRow[] {
  const allMembers = dbAll<MemberRow>(
    "SELECT name, email FROM members WHERE isActive = 1 AND email IS NOT NULL AND email != ''",
  )
  const mentioned = new Map<string, MemberRow>()
  for (const m of allMembers) {
    const tag   = '@' + m.name
    const idx   = content.toLowerCase().indexOf(tag.toLowerCase())
    if (idx === -1) continue
    // Require a word boundary after the name (space, newline, or end of string)
    const charAfter = content[idx + tag.length]
    if (charAfter === undefined || charAfter === ' ' || charAfter === '\n' || charAfter === '\t') {
      mentioned.set(m.email.toLowerCase(), m)
    }
  }
  return [...mentioned.values()]
}

// ─── SMTP transport ───────────────────────────────────────────────────────────

function buildTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  })
}

// ─── Send mention notifications ───────────────────────────────────────────────

export async function sendMentionNotifications(opts: {
  mentionedMembers: MemberRow[]
  authorName:   string
  content:      string
  contextTitle: string
  contextType:  'topic' | 'knownError'
}): Promise<void> {
  if (opts.mentionedMembers.length === 0) return
  const transporter = buildTransporter()
  if (!transporter) return

  const from    = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@team-board'
  const subject = `[Team Board] ${opts.authorName} hat dich in einem Kommentar erwähnt`

  const safeContent = opts.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const safeAuthor = opts.authorName.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const safeTitle  = opts.contextTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const label      = opts.contextType === 'topic' ? 'Meeting-Topic' : 'Known Error'

  const html = `
    <div style="font-family:sans-serif;max-width:600px;color:#1e293b;">
      <h2 style="color:#4f46e5;margin-bottom:4px;">Team Board – Erwähnung</h2>
      <p style="margin-top:0;color:#64748b;font-size:14px;">${label}: <strong>${safeTitle}</strong></p>
      <p><strong>${safeAuthor}</strong> hat dich in folgendem Kommentar erwähnt:</p>
      <blockquote style="border-left:3px solid #6366f1;padding:8px 16px;margin:16px 0;background:#f5f3ff;border-radius:4px;font-size:14px;color:#374151;">
        ${safeContent}
      </blockquote>
      <p style="color:#94a3b8;font-size:12px;">
        Du erhältst diese E-Mail, weil du im Team Board als Mitglied eingetragen bist.
      </p>
    </div>
  `

  for (const member of opts.mentionedMembers) {
    transporter.sendMail({ from, to: member.email, subject, html }).catch((err: Error) => {
      console.error(`[email] Failed to notify ${member.email}:`, err.message)
    })
  }
}
