import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toCategory(row: Row) {
  return {
    id:        row.id,
    name:      row.name,
    color:     row.color ?? '#6366f1',
    sortOrder: row.sortOrder ?? 0,
  }
}

// GET /api/ticket-categories
router.get('/', (_req, res) => {
  const rows = dbAll<Row>('SELECT * FROM ticket_categories ORDER BY sortOrder ASC, name ASC', [])
  res.json(rows.map(toCategory))
})

// POST /api/ticket-categories
router.post('/', (req, res) => {
  const { name, color = '#6366f1', sortOrder = 0 } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  const id = uid()
  dbRun(
    'INSERT INTO ticket_categories (id, name, color, sortOrder) VALUES (?, ?, ?, ?)',
    [id, name.trim(), color, sortOrder],
  )
  res.status(201).json(toCategory(dbGet<Row>('SELECT * FROM ticket_categories WHERE id = ?', [id])!))
})

// PATCH /api/ticket-categories/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM ticket_categories WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Category not found.' })
  }
  const updates: string[] = []
  const values:  unknown[] = []
  for (const f of ['name', 'color', 'sortOrder']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE ticket_categories SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toCategory(dbGet<Row>('SELECT * FROM ticket_categories WHERE id = ?', [id])!))
})

// DELETE /api/ticket-categories/:id
router.delete('/:id', (req, res) => {
  dbRun('UPDATE tickets SET categoryId = NULL WHERE categoryId = ?', [req.params.id])
  const r = dbRun('DELETE FROM ticket_categories WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Category not found.' })
  res.status(204).send()
})

export default router
