import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toSoftware(row: Row) {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor ?? undefined,
    version: row.version ?? undefined,
    description: row.description ?? undefined,
  }
}

// GET /api/software
router.get('/', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM software ORDER BY name ASC').map(toSoftware))
})

// POST /api/software
router.post('/', (req, res) => {
  const { name, vendor, version, description } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  const id = uid()
  dbRun(
    'INSERT INTO software (id, name, vendor, version, description) VALUES (?, ?, ?, ?, ?)',
    [id, name.trim(), vendor?.trim() ?? null, version?.trim() ?? null, description?.trim() ?? null],
  )
  res.status(201).json(toSoftware(dbGet<Row>('SELECT * FROM software WHERE id = ?', [id])!))
})

// PATCH /api/software/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM software WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Software not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['name', 'vendor', 'version', 'description']) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f]?.trim() ?? null)
    }
  }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE software SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toSoftware(dbGet<Row>('SELECT * FROM software WHERE id = ?', [id])!))
})

// DELETE /api/software/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM software WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Software not found.' })
  res.status(204).send()
})

export default router
