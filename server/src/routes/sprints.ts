import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function getSprintWithCapacity(id: string) {
  const sprint = dbGet<Row>('SELECT * FROM sprints WHERE id = ?', [id])
  if (!sprint) return null
  const capacity = dbAll('SELECT * FROM sprint_capacity WHERE sprintId = ?', [id])
  return { ...sprint, capacity }
}

// GET /api/sprints
router.get('/', (_req, res) => {
  const sprints = dbAll<Row>('SELECT * FROM sprints ORDER BY createdAt DESC')
  res.json(sprints.map((sp) => ({
    ...sp,
    capacity: dbAll('SELECT * FROM sprint_capacity WHERE sprintId = ?', [sp.id as string]),
  })))
})

// GET /api/sprints/:id
router.get('/:id', (req, res) => {
  const sprint = getSprintWithCapacity(req.params.id)
  if (!sprint) return res.status(404).json({ error: 'Sprint nicht gefunden.' })
  res.json(sprint)
})

// POST /api/sprints
router.post('/', (req, res) => {
  const { name, goal = '', startDate, endDate, notes = '' } = req.body
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'name, startDate und endDate sind erforderlich.' })
  }
  const id = uid()
  dbRun(
    'INSERT INTO sprints (id, name, goal, startDate, endDate, status, plannedPoints, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, goal, startDate, endDate, 'Geplant', 0, notes, new Date().toISOString()],
  )
  res.status(201).json(getSprintWithCapacity(id))
})

// PATCH /api/sprints/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Sprint nicht gefunden.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['name', 'goal', 'startDate', 'endDate', 'status', 'velocity', 'plannedPoints', 'notes']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE sprints SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(getSprintWithCapacity(id))
})

// DELETE /api/sprints/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM sprints WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Sprint nicht gefunden.' })
  res.status(204).send()
})

// PUT /api/sprints/:id/capacity/:memberId
router.put('/:id/capacity/:memberId', (req, res) => {
  const { id, memberId } = req.params
  const { availableDays, plannedPoints } = req.body
  if (availableDays === undefined || plannedPoints === undefined) {
    return res.status(400).json({ error: 'availableDays und plannedPoints sind erforderlich.' })
  }
  dbRun(
    'INSERT OR REPLACE INTO sprint_capacity (sprintId, memberId, availableDays, plannedPoints) VALUES (?, ?, ?, ?)',
    [id, memberId, availableDays, plannedPoints],
  )
  const sum = (dbGet<{ s: number }>('SELECT COALESCE(SUM(plannedPoints),0) as s FROM sprint_capacity WHERE sprintId = ?', [id])?.s ?? 0)
  dbRun('UPDATE sprints SET plannedPoints = ? WHERE id = ?', [sum, id])
  res.json({ sprintId: id, memberId, availableDays, plannedPoints })
})

// DELETE /api/sprints/:id/capacity/:memberId
router.delete('/:id/capacity/:memberId', (req, res) => {
  const { id, memberId } = req.params
  dbRun('DELETE FROM sprint_capacity WHERE sprintId = ? AND memberId = ?', [id, memberId])
  const sum = (dbGet<{ s: number }>('SELECT COALESCE(SUM(plannedPoints),0) as s FROM sprint_capacity WHERE sprintId = ?', [id])?.s ?? 0)
  dbRun('UPDATE sprints SET plannedPoints = ? WHERE id = ?', [sum, id])
  res.status(204).send()
})

export default router
