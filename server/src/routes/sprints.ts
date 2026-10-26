import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toCapacity(row: Row) {
  let activities: Record<string, number> = {}
  try { activities = JSON.parse(row.activities as string) } catch { /* malformed → empty */ }
  return { ...row, activities }
}

function getCapacity(sprintId: string) {
  return dbAll<Row>('SELECT * FROM sprint_capacity WHERE sprintId = ?', [sprintId]).map(toCapacity)
}

function getSprintWithCapacity(id: string) {
  const sprint = dbGet<Row>('SELECT * FROM sprints WHERE id = ?', [id])
  if (!sprint) return null
  return { ...sprint, capacity: getCapacity(id) }
}

const isValidAmount = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max

// GET /api/sprints
router.get('/', (req, res) => {
  const { teamId } = req
  const sprints = dbAll<Row>('SELECT * FROM sprints WHERE teamId = ? ORDER BY createdAt DESC', [teamId])
  res.json(sprints.map((sp) => ({
    ...sp,
    capacity: getCapacity(sp.id as string),
  })))
})

// GET /api/sprints/:id
router.get('/:id', (req, res) => {
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  res.json(getSprintWithCapacity(req.params.id))
})

// POST /api/sprints
router.post('/', (req, res) => {
  const { teamId } = req
  const { name, goal = '', startDate, endDate, notes = '' } = req.body
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'name, startDate and endDate are required.' })
  }
  const id = uid()
  dbRun(
    'INSERT INTO sprints (id, name, goal, startDate, endDate, status, plannedPoints, notes, createdAt, teamId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, goal, startDate, endDate, 'Geplant', 0, notes, new Date().toISOString(), teamId],
  )
  res.status(201).json(getSprintWithCapacity(id))
})

// PATCH /api/sprints/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['name', 'goal', 'startDate', 'endDate', 'status', 'velocity', 'plannedPoints', 'notes', 'goalMet', 'completedItems', 'plannedItems', 'teamSatisfaction', 'impediments', 'capacityHours', 'remainingHours', 'averageBurndown', 'teamDaysOff']) {
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
  const r = dbRun('DELETE FROM sprints WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Sprint not found.' })
  res.status(204).send()
})

// POST /api/sprints/:id/capacity  – add members to the capacity plan (existing entries stay untouched)
router.post('/:id/capacity', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  const { memberIds } = req.body
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'memberIds is required.' })
  }
  for (const memberId of memberIds) {
    if (!dbGet('SELECT id FROM members WHERE id = ? AND teamId = ?', [memberId, req.teamId])) {
      return res.status(400).json({ error: `Member not found: ${memberId}` })
    }
  }
  for (const memberId of memberIds) {
    dbRun('INSERT OR IGNORE INTO sprint_capacity (sprintId, memberId) VALUES (?, ?)', [id, memberId])
  }
  res.json(getSprintWithCapacity(id))
})

// POST /api/sprints/:id/capacity/copy  – copy hours per day + activities from another sprint.
// Only active members are copied; days off and notes are sprint-specific and stay untouched.
router.post('/:id/capacity/copy', (req, res) => {
  const { id } = req.params
  const { sourceSprintId } = req.body
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  if (!sourceSprintId || sourceSprintId === id || !dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [sourceSprintId, req.teamId])) {
    return res.status(400).json({ error: 'Valid sourceSprintId is required.' })
  }
  const rows = dbAll<{ memberId: string; hoursPerDay: number; activities: string }>(
    `SELECT c.memberId, c.hoursPerDay, c.activities FROM sprint_capacity c
     JOIN members m ON m.id = c.memberId
     WHERE c.sprintId = ? AND m.teamId = ? AND m.isActive = 1`,
    [sourceSprintId, req.teamId],
  )
  for (const row of rows) {
    dbRun(
      `INSERT INTO sprint_capacity (sprintId, memberId, hoursPerDay, activities) VALUES (?, ?, ?, ?)
       ON CONFLICT(sprintId, memberId) DO UPDATE SET hoursPerDay = excluded.hoursPerDay, activities = excluded.activities`,
      [id, row.memberId, row.hoursPerDay, row.activities],
    )
  }
  res.json(getSprintWithCapacity(id))
})

// PUT /api/sprints/:id/capacity/:memberId  – create or update a member's capacity.
// Only provided fields are changed. Activities are merged per key so that edits of
// different cells don't overwrite each other; a value of 0 or null removes the entry.
router.put('/:id/capacity/:memberId', (req, res) => {
  const { id, memberId } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  if (!dbGet('SELECT id FROM members WHERE id = ? AND teamId = ?', [memberId, req.teamId])) {
    return res.status(404).json({ error: 'Member not found.' })
  }
  const { hoursPerDay, daysOff, activities, notes } = req.body
  if (hoursPerDay !== undefined && !isValidAmount(hoursPerDay, 24)) {
    return res.status(400).json({ error: 'hoursPerDay must be between 0 and 24.' })
  }
  if (daysOff !== undefined && !isValidAmount(daysOff, 366)) {
    return res.status(400).json({ error: 'daysOff must be a non-negative number.' })
  }
  if (notes !== undefined && typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be a string.' })
  }
  if (activities !== undefined) {
    if (typeof activities !== 'object' || activities === null || Array.isArray(activities)) {
      return res.status(400).json({ error: 'activities must be an object.' })
    }
    const knownIds = new Set(
      dbAll<{ id: string }>('SELECT id FROM capacity_activities WHERE teamId = ?', [req.teamId]).map((a) => a.id),
    )
    for (const [activityId, h] of Object.entries(activities)) {
      if (!knownIds.has(activityId)) return res.status(400).json({ error: `Unknown activity: ${activityId}` })
      if (h !== null && !isValidAmount(h, 24)) {
        return res.status(400).json({ error: 'Activity hours must be between 0 and 24.' })
      }
    }
  }

  const existing = dbGet<Row>('SELECT * FROM sprint_capacity WHERE sprintId = ? AND memberId = ?', [id, memberId])
  const merged: Record<string, number> = existing ? toCapacity(existing).activities : {}
  for (const [activityId, h] of Object.entries((activities ?? {}) as Record<string, number | null>)) {
    if (h) merged[activityId] = h
    else delete merged[activityId]
  }

  if (existing) {
    dbRun(
      'UPDATE sprint_capacity SET hoursPerDay = ?, daysOff = ?, activities = ?, notes = ? WHERE sprintId = ? AND memberId = ?',
      [hoursPerDay ?? existing.hoursPerDay, daysOff ?? existing.daysOff, JSON.stringify(merged), notes ?? existing.notes, id, memberId],
    )
  } else {
    dbRun(
      'INSERT INTO sprint_capacity (sprintId, memberId, hoursPerDay, daysOff, activities, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, memberId, hoursPerDay ?? 8, daysOff ?? 0, JSON.stringify(merged), notes ?? ''],
    )
  }
  res.json(getSprintWithCapacity(id))
})

// DELETE /api/sprints/:id/capacity/:memberId
router.delete('/:id/capacity/:memberId', (req, res) => {
  const { id, memberId } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  dbRun('DELETE FROM sprint_capacity WHERE sprintId = ? AND memberId = ?', [id, memberId])
  res.json(getSprintWithCapacity(id))
})

export default router
