import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

// GET /api/responsibility-types
router.get('/', (_req, res) => {
  res.json(dbAll('SELECT * FROM responsibility_types ORDER BY sortOrder, name'))
})

// POST /api/responsibility-types
router.post('/', (req, res) => {
  const { name, color = '#6366f1' } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name erforderlich.' })
  if (dbGet('SELECT id FROM responsibility_types WHERE name = ?', [name.trim()])) {
    return res.status(409).json({ error: 'Verantwortlichkeit mit diesem Namen existiert bereits.' })
  }
  const id = uid()
  const sortOrder = (dbGet<{ n: number }>('SELECT COALESCE(MAX(sortOrder),0)+1 AS n FROM responsibility_types')?.n ?? 1)
  dbRun('INSERT INTO responsibility_types (id, name, color, sortOrder) VALUES (?, ?, ?, ?)',
    [id, name.trim(), color, sortOrder])
  res.status(201).json(dbGet<Row>('SELECT * FROM responsibility_types WHERE id = ?', [id]))
})

// PATCH /api/responsibility-types/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM responsibility_types WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Verantwortlichkeit nicht gefunden.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  if (req.body.name !== undefined) { updates.push('name = ?'); values.push(req.body.name.trim()) }
  if (req.body.color !== undefined) { updates.push('color = ?'); values.push(req.body.color) }
  if (req.body.sortOrder !== undefined) { updates.push('sortOrder = ?'); values.push(req.body.sortOrder) }
  if (updates.length === 0) return res.status(400).json({ error: 'Keine Felder angegeben.' })
  values.push(id)
  dbRun(`UPDATE responsibility_types SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(dbGet<Row>('SELECT * FROM responsibility_types WHERE id = ?', [id]))
})

// DELETE /api/responsibility-types/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM responsibility_types WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Verantwortlichkeit nicht gefunden.' })
  res.status(204).send()
})

export default router
