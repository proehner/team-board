import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toMeeting(row: Row) {
  return {
    ...row,
    description: row.description ?? '',
    dayOfWeek:   row.dayOfWeek  != null ? Number(row.dayOfWeek) : undefined,
    meetingTime: row.meetingTime ?? undefined,
    location:    row.location   ?? undefined,
  }
}

function toTopic(row: Row) {
  return {
    ...row,
    description: row.description ?? '',
    closedAt:    row.closedAt ?? undefined,
    assigneeIds: JSON.parse((row.assigneeIds as string) ?? '[]'),
  }
}

// ─── Meetings ─────────────────────────────────────────────────────────────────

// GET /api/meetings
router.get('/', (req, res) => {
  res.json(
    dbAll<Row>('SELECT * FROM meetings WHERE teamId = ? ORDER BY title ASC', [req.teamId]).map(toMeeting),
  )
})

// GET /api/meetings/:id
router.get('/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM meetings WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (!row) return res.status(404).json({ error: 'Meeting not found.' })
  res.json(toMeeting(row))
})

// POST /api/meetings
router.post('/', (req, res) => {
  const { title, description = '', recurrence = 'weekly', dayOfWeek, meetingTime, location } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO meetings (id, title, description, recurrence, dayOfWeek, meetingTime, location, teamId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title.trim(), description, recurrence, dayOfWeek ?? null, meetingTime ?? null, location?.trim() ?? null, req.teamId, now, now],
  )
  res.status(201).json(toMeeting(dbGet<Row>('SELECT * FROM meetings WHERE id = ?', [id])!))
})

// PATCH /api/meetings/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  const updates: string[] = []
  const values:  unknown[] = []
  for (const f of ['title', 'description', 'recurrence', 'location']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  for (const f of ['dayOfWeek']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (req.body.meetingTime !== undefined) { updates.push('meetingTime = ?'); values.push(req.body.meetingTime ?? null) }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString(), id)
    dbRun(`UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toMeeting(dbGet<Row>('SELECT * FROM meetings WHERE id = ?', [id])!))
})

// DELETE /api/meetings/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM meetings WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Meeting not found.' })
  res.status(204).send()
})

// ─── Topics ───────────────────────────────────────────────────────────────────

// GET /api/meetings/:meetingId/topics?archived=true
router.get('/:meetingId/topics', (req, res) => {
  const { meetingId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  const showArchived = req.query.archived === 'true'
  const rows = showArchived
    ? dbAll<Row>('SELECT * FROM meeting_topics WHERE meetingId = ? ORDER BY status ASC, sortOrder ASC, createdAt DESC', [meetingId])
    : dbAll<Row>("SELECT * FROM meeting_topics WHERE meetingId = ? AND status = 'open' ORDER BY sortOrder ASC, createdAt DESC", [meetingId])
  res.json(rows.map(toTopic))
})

// GET /api/meetings/:meetingId/topics/:topicId
router.get('/:meetingId/topics/:topicId', (req, res) => {
  const { meetingId, topicId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  const row = dbGet<Row>('SELECT * FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])
  if (!row) return res.status(404).json({ error: 'Topic not found.' })
  res.json(toTopic(row))
})

// POST /api/meetings/:meetingId/topics
router.post('/:meetingId/topics', (req, res) => {
  const { meetingId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  const { title, description = '', assigneeIds = [] } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const maxOrder = dbGet<{ m: number }>('SELECT MAX(sortOrder) as m FROM meeting_topics WHERE meetingId = ?', [meetingId])
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO meeting_topics (id, meetingId, title, description, status, sortOrder, assigneeIds, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [id, meetingId, title.trim(), description, (maxOrder?.m ?? -1) + 1, JSON.stringify(assigneeIds), now, now],
  )
  res.status(201).json(toTopic(dbGet<Row>('SELECT * FROM meeting_topics WHERE id = ?', [id])!))
})

// PATCH /api/meetings/:meetingId/topics/:topicId
router.patch('/:meetingId/topics/:topicId', (req, res) => {
  const { meetingId, topicId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  if (!dbGet('SELECT id FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])) {
    return res.status(404).json({ error: 'Topic not found.' })
  }
  const updates: string[] = []
  const values:  unknown[] = []
  for (const f of ['title', 'description', 'sortOrder']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (req.body.assigneeIds !== undefined) {
    updates.push('assigneeIds = ?')
    values.push(JSON.stringify(req.body.assigneeIds))
  }
  if (req.body.status !== undefined) {
    updates.push('status = ?')
    values.push(req.body.status)
    updates.push('closedAt = ?')
    values.push(req.body.status === 'closed' ? new Date().toISOString() : null)
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString(), topicId)
    dbRun(`UPDATE meeting_topics SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toTopic(dbGet<Row>('SELECT * FROM meeting_topics WHERE id = ?', [topicId])!))
})

// DELETE /api/meetings/:meetingId/topics/:topicId
router.delete('/:meetingId/topics/:topicId', (req, res) => {
  const { meetingId, topicId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  const r = dbRun('DELETE FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])
  if (r.changes === 0) return res.status(404).json({ error: 'Topic not found.' })
  res.status(204).send()
})

// ─── Comments ─────────────────────────────────────────────────────────────────

// GET /api/meetings/:meetingId/topics/:topicId/comments
router.get('/:meetingId/topics/:topicId/comments', (req, res) => {
  const { meetingId, topicId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  if (!dbGet('SELECT id FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])) {
    return res.status(404).json({ error: 'Topic not found.' })
  }
  res.json(dbAll<Row>('SELECT * FROM topic_comments WHERE topicId = ? ORDER BY createdAt ASC', [topicId]))
})

// POST /api/meetings/:meetingId/topics/:topicId/comments
router.post('/:meetingId/topics/:topicId/comments', (req, res) => {
  const { meetingId, topicId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  if (!dbGet('SELECT id FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])) {
    return res.status(404).json({ error: 'Topic not found.' })
  }
  const { content, authorName = '' } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'content is required.' })
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    'INSERT INTO topic_comments (id, topicId, content, authorName, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, topicId, content.trim(), authorName, now],
  )
  res.status(201).json(dbGet<Row>('SELECT * FROM topic_comments WHERE id = ?', [id]))
})

// DELETE /api/meetings/:meetingId/topics/:topicId/comments/:commentId
router.delete('/:meetingId/topics/:topicId/comments/:commentId', (req, res) => {
  const { meetingId, topicId, commentId } = req.params
  if (!dbGet('SELECT id FROM meetings WHERE id = ? AND teamId = ?', [meetingId, req.teamId])) {
    return res.status(404).json({ error: 'Meeting not found.' })
  }
  if (!dbGet('SELECT id FROM meeting_topics WHERE id = ? AND meetingId = ?', [topicId, meetingId])) {
    return res.status(404).json({ error: 'Topic not found.' })
  }
  const r = dbRun('DELETE FROM topic_comments WHERE id = ? AND topicId = ?', [commentId, topicId])
  if (r.changes === 0) return res.status(404).json({ error: 'Comment not found.' })
  res.status(204).send()
})

export default router
