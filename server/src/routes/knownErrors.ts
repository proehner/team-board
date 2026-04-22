import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import { findMentionedMembers, sendMentionNotifications } from '../email'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toKnownError(row: Row) {
  return {
    ...row,
    ticketNumber: row.ticketNumber ?? undefined,
    softwareIds: JSON.parse((row.softwareIds as string) ?? '[]'),
    tags: JSON.parse((row.tags as string) ?? '[]'),
    workaround: row.workaround ?? undefined,
  }
}

// GET /api/known-errors
router.get('/', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM known_errors ORDER BY createdAt DESC').map(toKnownError))
})

// GET /api/known-errors/:id
router.get('/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM known_errors WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Known error not found.' })
  res.json(toKnownError(row))
})

// POST /api/known-errors
router.post('/', (req, res) => {
  const {
    title, ticketNumber, description = '', solution = '', workaround,
    severity = 'medium', status = 'open',
    softwareIds = [], tags = [],
  } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const id = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO known_errors
       (id, title, ticketNumber, description, solution, workaround, severity, status, softwareIds, tags, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      title.trim(),
      ticketNumber?.trim() ?? null,
      description,
      solution,
      workaround ?? null,
      severity,
      status,
      JSON.stringify(softwareIds),
      JSON.stringify(tags),
      now,
      now,
    ],
  )
  res.status(201).json(toKnownError(dbGet<Row>('SELECT * FROM known_errors WHERE id = ?', [id])!))
})

// PATCH /api/known-errors/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM known_errors WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Known error not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['title', 'ticketNumber', 'description', 'solution', 'workaround', 'severity', 'status']) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f] ?? null)
    }
  }
  if (req.body.softwareIds !== undefined) {
    updates.push('softwareIds = ?')
    values.push(JSON.stringify(req.body.softwareIds))
  }
  if (req.body.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(req.body.tags))
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(id)
    dbRun(`UPDATE known_errors SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toKnownError(dbGet<Row>('SELECT * FROM known_errors WHERE id = ?', [id])!))
})

// DELETE /api/known-errors/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM known_errors WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Known error not found.' })
  res.status(204).send()
})

// ─── Comments ─────────────────────────────────────────────────────────────────

// GET /api/known-errors/:id/comments
router.get('/:id/comments', (req, res) => {
  if (!dbGet('SELECT id FROM known_errors WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Known error not found.' })
  }
  res.json(dbAll<Row>('SELECT * FROM known_error_comments WHERE knownErrorId = ? ORDER BY createdAt ASC', [req.params.id]))
})

// POST /api/known-errors/:id/comments
router.post('/:id/comments', (req, res) => {
  const ke = dbGet<{ id: string; title: string }>('SELECT id, title FROM known_errors WHERE id = ?', [req.params.id])
  if (!ke) return res.status(404).json({ error: 'Known error not found.' })
  const { content, authorName = '' } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'content is required.' })
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    'INSERT INTO known_error_comments (id, knownErrorId, content, authorName, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, ke.id, content.trim(), authorName, now],
  )
  const saved = dbGet<Row>('SELECT * FROM known_error_comments WHERE id = ?', [id])!
  // Send mention notifications asynchronously (fire-and-forget)
  sendMentionNotifications({
    mentionedMembers: findMentionedMembers(content.trim()),
    authorName,
    content: content.trim(),
    contextTitle: ke.title,
    contextType: 'knownError',
  })
  res.status(201).json(saved)
})

// DELETE /api/known-errors/:id/comments/:commentId
router.delete('/:id/comments/:commentId', (req, res) => {
  if (!dbGet('SELECT id FROM known_errors WHERE id = ?', [req.params.id])) {
    return res.status(404).json({ error: 'Known error not found.' })
  }
  const r = dbRun('DELETE FROM known_error_comments WHERE id = ? AND knownErrorId = ?', [req.params.commentId, req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Comment not found.' })
  res.status(204).send()
})

export default router
