import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

// GET /api/responsibility-types
router.get('/', (req, res) => {
  const { teamId } = req
  res.json(dbAll('SELECT * FROM responsibility_types WHERE teamId = ? ORDER BY sortOrder, name', [teamId]))
})

// POST /api/responsibility-types
router.post('/', (req, res) => {
  const { teamId } = req
  const { name, color = '#6366f1' } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required.' })
  if (dbGet('SELECT id FROM responsibility_types WHERE name = ? AND teamId = ?', [name.trim(), teamId])) {
    return res.status(409).json({ error: 'A responsibility type with this name already exists.' })
  }
  const id = uid()
  const sortOrder = (dbGet<{ n: number }>(
    'SELECT COALESCE(MAX(sortOrder),0)+1 AS n FROM responsibility_types WHERE teamId = ?', [teamId],
  )?.n ?? 1)
  dbRun(
    'INSERT INTO responsibility_types (id, name, teamId, color, sortOrder) VALUES (?, ?, ?, ?, ?)',
    [id, name.trim(), teamId, color, sortOrder],
  )
  res.status(201).json(dbGet<Row>('SELECT * FROM responsibility_types WHERE id = ?', [id]))
})

// PATCH /api/responsibility-types/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM responsibility_types WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Responsibility type not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  if (req.body.name !== undefined)      { updates.push('name = ?');      values.push(req.body.name.trim()) }
  if (req.body.color !== undefined)     { updates.push('color = ?');     values.push(req.body.color) }
  if (req.body.sortOrder !== undefined) { updates.push('sortOrder = ?'); values.push(req.body.sortOrder) }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' })
  values.push(id)
  dbRun(`UPDATE responsibility_types SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(dbGet<Row>('SELECT * FROM responsibility_types WHERE id = ?', [id]))
})

// DELETE /api/responsibility-types/:id
router.delete('/:id', (req, res) => {
  const r = dbRun(
    'DELETE FROM responsibility_types WHERE id = ? AND teamId = ?', [req.params.id, req.teamId],
  )
  if (r.changes === 0) return res.status(404).json({ error: 'Responsibility type not found.' })
  res.status(204).send()
})

export default router
