import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toTicket(row: Row) {
  const topicLinks = dbAll<{ topicId: string }>(
    'SELECT topicId FROM topic_ticket_links WHERE ticketId = ?',
    [row.id as string],
  )
  return {
    ...row,
    description: row.description ?? '',
    assigneeIds: JSON.parse((row.assigneeIds as string) ?? '[]'),
    isGlobal:    row.isGlobal === 1 || row.isGlobal === true,
    topicIds:    topicLinks.map((l) => l.topicId),
  }
}

// GET /api/tickets
router.get('/', (req, res) => {
  const rows = dbAll<Row>(
    'SELECT * FROM tickets WHERE teamId = ? OR isGlobal = 1 ORDER BY createdAt DESC',
    [req.teamId],
  )
  res.json(rows.map(toTicket))
})

// GET /api/tickets/by-topic/:topicId – must come before /:id to avoid conflict
router.get('/by-topic/:topicId', (req, res) => {
  const rows = dbAll<Row>(
    `SELECT t.* FROM tickets t
     INNER JOIN topic_ticket_links l ON l.ticketId = t.id
     WHERE l.topicId = ?
     ORDER BY t.createdAt DESC`,
    [req.params.topicId],
  )
  res.json(rows.map(toTicket))
})

// GET /api/tickets/:id
router.get('/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM tickets WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Ticket not found.' })
  res.json(toTicket(row))
})

// POST /api/tickets
router.post('/', (req, res) => {
  const { title, description = '', status = 'todo', priority = 'medium', assigneeIds = [], isGlobal = false, topicId } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const id     = uid()
  const now    = new Date().toISOString()
  const teamId = isGlobal ? null : req.teamId
  dbRun(
    `INSERT INTO tickets (id, title, description, status, priority, assigneeIds, teamId, isGlobal, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title.trim(), description, status, priority, JSON.stringify(assigneeIds), teamId, isGlobal ? 1 : 0, now, now],
  )
  if (topicId) {
    dbRun('INSERT OR IGNORE INTO topic_ticket_links (topicId, ticketId) VALUES (?, ?)', [topicId, id])
  }
  res.status(201).json(toTicket(dbGet<Row>('SELECT * FROM tickets WHERE id = ?', [id])!))
})

// PATCH /api/tickets/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM tickets WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Ticket not found.' })
  }
  const updates: string[] = []
  const values:  unknown[] = []
  for (const f of ['title', 'description', 'status', 'priority']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (req.body.assigneeIds !== undefined) {
    updates.push('assigneeIds = ?')
    values.push(JSON.stringify(req.body.assigneeIds))
  }
  if (req.body.isGlobal !== undefined) {
    updates.push('isGlobal = ?')
    values.push(req.body.isGlobal ? 1 : 0)
    updates.push('teamId = ?')
    values.push(req.body.isGlobal ? null : req.teamId)
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)
    dbRun(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toTicket(dbGet<Row>('SELECT * FROM tickets WHERE id = ?', [id])!))
})

// DELETE /api/tickets/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM tickets WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Ticket not found.' })
  res.status(204).send()
})

// POST /api/tickets/:id/link/:topicId – link a ticket to a topic
router.post('/:id/link/:topicId', (req, res) => {
  const { id, topicId } = req.params
  if (!dbGet('SELECT id FROM tickets WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Ticket not found.' })
  }
  if (!dbGet('SELECT id FROM meeting_topics WHERE id = ?', [topicId])) {
    return res.status(404).json({ error: 'Topic not found.' })
  }
  dbRun('INSERT OR IGNORE INTO topic_ticket_links (topicId, ticketId) VALUES (?, ?)', [topicId, id])
  res.json(toTicket(dbGet<Row>('SELECT * FROM tickets WHERE id = ?', [id])!))
})

// DELETE /api/tickets/:id/link/:topicId – unlink a ticket from a topic
router.delete('/:id/link/:topicId', (req, res) => {
  dbRun('DELETE FROM topic_ticket_links WHERE topicId = ? AND ticketId = ?', [req.params.topicId, req.params.id])
  res.status(204).send()
})

export default router
