import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toActivity(row: Row) {
  return { ...row, countsToSprint: row.countsToSprint === 1 || row.countsToSprint === true }
}

function getActivity(id: string) {
  const row = dbGet<Row>('SELECT * FROM capacity_activities WHERE id = ?', [id])
  return row ? toActivity(row) : null
}

// GET /api/capacity-activities
router.get('/', (req, res) => {
  const { teamId } = req
  res.json(dbAll<Row>('SELECT * FROM capacity_activities WHERE teamId = ? ORDER BY sortOrder, name', [teamId]).map(toActivity))
})

// POST /api/capacity-activities
router.post('/', (req, res) => {
  const { teamId } = req
  const { name, color = '#6366f1', countsToSprint = false } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required.' })
  if (dbGet('SELECT id FROM capacity_activities WHERE name = ? AND teamId = ?', [name.trim(), teamId])) {
    return res.status(409).json({ error: 'An activity with this name already exists.' })
  }
  const id = uid()
  const sortOrder = (dbGet<{ n: number }>(
    'SELECT COALESCE(MAX(sortOrder),0)+1 AS n FROM capacity_activities WHERE teamId = ?', [teamId],
  )?.n ?? 1)
  dbRun(
    'INSERT INTO capacity_activities (id, name, teamId, color, countsToSprint, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name.trim(), teamId, color, countsToSprint ? 1 : 0, sortOrder],
  )
  res.status(201).json(getActivity(id))
})

// PATCH /api/capacity-activities/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  const { teamId } = req
  if (!dbGet('SELECT id FROM capacity_activities WHERE id = ? AND teamId = ?', [id, teamId])) {
    return res.status(404).json({ error: 'Activity not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ error: 'Name required.' })
    if (dbGet('SELECT id FROM capacity_activities WHERE name = ? AND teamId = ? AND id != ?', [name, teamId, id])) {
      return res.status(409).json({ error: 'An activity with this name already exists.' })
    }
    updates.push('name = ?'); values.push(name)
  }
  if (req.body.color !== undefined)          { updates.push('color = ?');          values.push(req.body.color) }
  if (req.body.countsToSprint !== undefined) { updates.push('countsToSprint = ?'); values.push(req.body.countsToSprint ? 1 : 0) }
  if (req.body.sortOrder !== undefined)      { updates.push('sortOrder = ?');      values.push(req.body.sortOrder) }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' })
  values.push(id)
  dbRun(`UPDATE capacity_activities SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(getActivity(id))
})

// DELETE /api/capacity-activities/:id
// Also removes the activity's hours from all sprint capacities of the team.
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const r = dbRun('DELETE FROM capacity_activities WHERE id = ? AND teamId = ?', [id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Activity not found.' })
  dbRun(
    'UPDATE sprint_capacity SET activities = json_remove(activities, ?) WHERE sprintId IN (SELECT id FROM sprints WHERE teamId = ?)',
    [`$."${id}"`, req.teamId],
  )
  res.status(204).send()
})

export default router
