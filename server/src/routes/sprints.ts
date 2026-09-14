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
router.get('/', (req, res) => {
  const { teamId } = req
  const sprints = dbAll<Row>('SELECT * FROM sprints WHERE teamId = ? ORDER BY createdAt DESC', [teamId])
  res.json(sprints.map((sp) => ({
    ...sp,
    capacity: dbAll('SELECT * FROM sprint_capacity WHERE sprintId = ?', [sp.id as string]),
  })))
})

// ─── Sprint settings (per team) ──────────────────────────────────────────────
// Configure how new sprints are pre-filled: naming pattern, length and the
// weekdays a sprint starts / ends on.
// NOTE: these routes must stay ABOVE the `/:id` routes, otherwise Express
// would match "settings" as a sprint id.

interface SprintSettings {
  namePattern:   string
  durationWeeks: number
  startWeekday:  number  // ISO weekday, 1 = Monday … 7 = Sunday
  endWeekday:    number
}

const DEFAULT_SPRINT_SETTINGS: SprintSettings = {
  namePattern:   '{YYYY}_{KW1}_{KW2}',
  durationWeeks: 2,
  startWeekday:  1,
  endWeekday:    5,
}

function getSprintSettings(teamId: string): SprintSettings {
  const row = dbGet<Row>('SELECT * FROM sprint_settings WHERE teamId = ?', [teamId])
  if (!row) return { ...DEFAULT_SPRINT_SETTINGS }
  return {
    namePattern:   (row.namePattern as string) || DEFAULT_SPRINT_SETTINGS.namePattern,
    durationWeeks: Number(row.durationWeeks) || DEFAULT_SPRINT_SETTINGS.durationWeeks,
    startWeekday:  Number(row.startWeekday)  || DEFAULT_SPRINT_SETTINGS.startWeekday,
    endWeekday:    Number(row.endWeekday)    || DEFAULT_SPRINT_SETTINGS.endWeekday,
  }
}

const clampWeekday = (v: unknown, fallback: number): number => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : fallback
}

// GET /api/sprints/settings
router.get('/settings', (req, res) => {
  res.json(getSprintSettings(req.teamId!))
})

// PUT /api/sprints/settings
router.put('/settings', (req, res) => {
  const { teamId } = req
  const current = getSprintSettings(teamId!)
  const pattern = typeof req.body.namePattern === 'string' ? req.body.namePattern.trim() : current.namePattern
  if (!pattern) return res.status(400).json({ error: 'namePattern must not be empty.' })

  const weeks = Math.round(Number(req.body.durationWeeks ?? current.durationWeeks))
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > 12) {
    return res.status(400).json({ error: 'durationWeeks must be between 1 and 12.' })
  }

  const settings: SprintSettings = {
    namePattern:   pattern,
    durationWeeks: weeks,
    startWeekday:  clampWeekday(req.body.startWeekday, current.startWeekday),
    endWeekday:    clampWeekday(req.body.endWeekday,   current.endWeekday),
  }

  dbRun(
    `INSERT INTO sprint_settings (teamId, namePattern, durationWeeks, startWeekday, endWeekday)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(teamId) DO UPDATE SET
       namePattern = excluded.namePattern,
       durationWeeks = excluded.durationWeeks,
       startWeekday = excluded.startWeekday,
       endWeekday = excluded.endWeekday`,
    [teamId, settings.namePattern, settings.durationWeeks, settings.startWeekday, settings.endWeekday],
  )
  res.json(settings)
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
  for (const f of ['name', 'goal', 'startDate', 'endDate', 'status', 'velocity', 'plannedPoints', 'notes', 'goalMet', 'completedItems', 'plannedItems', 'teamSatisfaction', 'impediments', 'capacityHours', 'remainingHours', 'averageBurndown']) {
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

// PUT /api/sprints/:id/capacity/:memberId
router.put('/:id/capacity/:memberId', (req, res) => {
  const { id, memberId } = req.params
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  const { availableDays, plannedPoints } = req.body
  if (availableDays === undefined || plannedPoints === undefined) {
    return res.status(400).json({ error: 'availableDays and plannedPoints are required.' })
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
  if (!dbGet('SELECT id FROM sprints WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Sprint not found.' })
  }
  dbRun('DELETE FROM sprint_capacity WHERE sprintId = ? AND memberId = ?', [id, memberId])
  const sum = (dbGet<{ s: number }>('SELECT COALESCE(SUM(plannedPoints),0) as s FROM sprint_capacity WHERE sprintId = ?', [id])?.s ?? 0)
  dbRun('UPDATE sprints SET plannedPoints = ? WHERE id = ?', [sum, id])
  res.status(204).send()
})

export default router
