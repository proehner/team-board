import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toRetro(row: Row) {
  return {
    ...row,
    isFinalized: row.isFinalized === 1 || row.isFinalized === true,
    items: dbAll('SELECT * FROM retro_items WHERE retroId = ? ORDER BY votes DESC', [row.id as string]),
  }
}

// GET /api/retrospectives
router.get('/', (req, res) => {
  const { teamId } = req
  res.json(dbAll<Row>('SELECT * FROM retrospectives WHERE teamId = ? ORDER BY date DESC', [teamId]).map(toRetro))
})

// GET /api/retrospectives/:id
router.get('/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM retrospectives WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (!row) return res.status(404).json({ error: 'Retrospective not found.' })
  res.json(toRetro(row))
})

// POST /api/retrospectives
router.post('/', (req, res) => {
  const { teamId } = req
  const { title, date, sprintId, facilitatorId, isFinalized = false } = req.body
  if (!title || !date) return res.status(400).json({ error: 'title and date are required.' })
  const id = uid()
  dbRun(
    'INSERT INTO retrospectives (id, sprintId, title, date, facilitatorId, isFinalized, createdAt, teamId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, sprintId ?? null, title, date, facilitatorId ?? null, isFinalized ? 1 : 0, new Date().toISOString(), teamId],
  )
  res.status(201).json(toRetro(dbGet<Row>('SELECT * FROM retrospectives WHERE id = ?', [id])!))
})

// PATCH /api/retrospectives/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM retrospectives WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Retrospective not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['title', 'date', 'sprintId', 'facilitatorId']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (req.body.isFinalized !== undefined) {
    updates.push('isFinalized = ?'); values.push(req.body.isFinalized ? 1 : 0)
  }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE retrospectives SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toRetro(dbGet<Row>('SELECT * FROM retrospectives WHERE id = ?', [id])!))
})

// DELETE /api/retrospectives/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM retrospectives WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Retrospective not found.' })
  res.status(204).send()
})

// ─── Retro Items ──────────────────────────────────────────────────────────────

// POST /api/retrospectives/:id/items
router.post('/:id/items', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM retrospectives WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Retrospective not found.' })
  }
  const { type, text } = req.body
  if (!type || !text) return res.status(400).json({ error: 'type and text are required.' })
  const itemId = uid()
  dbRun(
    'INSERT INTO retro_items (id, retroId, type, text, votes, status) VALUES (?, ?, ?, ?, 0, ?)',
    [itemId, id, type, text, 'Offen'],
  )
  res.status(201).json(dbGet<Row>('SELECT * FROM retro_items WHERE id = ?', [itemId]))
})

// PATCH /api/retrospectives/:id/items/:itemId
router.patch('/:id/items/:itemId', (req, res) => {
  const { itemId } = req.params
  if (!dbGet('SELECT id FROM retro_items WHERE id = ?', [itemId])) {
    return res.status(404).json({ error: 'Item not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['text', 'votes', 'assigneeId', 'status', 'dueDate', 'ticketUrl']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (updates.length > 0) {
    values.push(itemId)
    dbRun(`UPDATE retro_items SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(dbGet<Row>('SELECT * FROM retro_items WHERE id = ?', [itemId]))
})

// DELETE /api/retrospectives/:id/items/:itemId
router.delete('/:id/items/:itemId', (req, res) => {
  const r = dbRun('DELETE FROM retro_items WHERE id = ?', [req.params.itemId])
  if (r.changes === 0) return res.status(404).json({ error: 'Item not found.' })
  res.status(204).send()
})

// POST /api/retrospectives/:id/items/:itemId/vote
router.post('/:id/items/:itemId/vote', (req, res) => {
  const { itemId } = req.params
  const { delta } = req.body
  if (delta !== 1 && delta !== -1) return res.status(400).json({ error: 'delta must be 1 or -1.' })
  dbRun('UPDATE retro_items SET votes = MAX(0, votes + ?) WHERE id = ?', [delta, itemId])
  res.json(dbGet<Row>('SELECT * FROM retro_items WHERE id = ?', [itemId]))
})

export default router
