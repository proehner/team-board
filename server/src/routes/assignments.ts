import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toAssignment(row: Row) {
  return {
    ...row,
    isAutoSuggested: row.isAutoSuggested === 1 || row.isAutoSuggested === true,
    isSynthetic:     row.isSynthetic     === 1 || row.isSynthetic     === true,
    isArchived:      row.isArchived      === 1 || row.isArchived      === true,
  }
}

// ─── Rotation settings ───────────────────────────────────────────────────────
// Members can be excluded from the automatic suggestion, and their counter can
// be corrected by hand (e.g. for duties taken over outside the tool). Both feed
// into the fairness algorithm below.

const excludedMemberIds = (teamId: string): string[] =>
  dbAll<{ memberId: string }>('SELECT memberId FROM rotation_exclusions WHERE teamId = ?', [teamId])
    .map((r) => r.memberId)

const adjustmentsFor = (teamId: string, type?: string) =>
  type === undefined
    ? dbAll<{ type: string; memberId: string; delta: number }>(
        'SELECT type, memberId, delta FROM rotation_adjustments WHERE teamId = ? AND delta != 0', [teamId],
      )
    : dbAll<{ type: string; memberId: string; delta: number }>(
        'SELECT type, memberId, delta FROM rotation_adjustments WHERE teamId = ? AND type = ?', [teamId, type],
      )

// GET /api/assignments/rotation-settings
router.get('/rotation-settings', (req, res) => {
  const { teamId } = req
  res.json({
    excludedMemberIds: excludedMemberIds(teamId!),
    adjustments: adjustmentsFor(teamId!),
  })
})

// PUT /api/assignments/exclusions/:memberId   body: { excluded: boolean }
router.put('/exclusions/:memberId', (req, res) => {
  const { memberId } = req.params
  const { teamId } = req
  if (!dbGet('SELECT id FROM members WHERE id = ? AND teamId = ?', [memberId, teamId])) {
    return res.status(404).json({ error: 'Member not found.' })
  }
  if (req.body.excluded) {
    dbRun('INSERT OR IGNORE INTO rotation_exclusions (teamId, memberId) VALUES (?, ?)', [teamId, memberId])
  } else {
    dbRun('DELETE FROM rotation_exclusions WHERE teamId = ? AND memberId = ?', [teamId, memberId])
  }
  res.json({ memberId, excluded: !!req.body.excluded })
})

// PUT /api/assignments/adjustments   body: { type, memberId, delta }
// `delta` is the absolute correction value, not an increment.
router.put('/adjustments', (req, res) => {
  const { teamId } = req
  const { type, memberId } = req.body
  const delta = Math.round(Number(req.body.delta))
  if (!type || !memberId) {
    return res.status(400).json({ error: 'type and memberId are required.' })
  }
  if (!Number.isFinite(delta) || delta < 0 || delta > 9999) {
    return res.status(400).json({ error: 'delta must be between 0 and 9999.' })
  }
  if (!dbGet('SELECT id FROM members WHERE id = ? AND teamId = ?', [memberId, teamId])) {
    return res.status(404).json({ error: 'Member not found.' })
  }
  if (delta === 0) {
    dbRun('DELETE FROM rotation_adjustments WHERE teamId = ? AND type = ? AND memberId = ?', [teamId, type, memberId])
  } else {
    dbRun(
      `INSERT INTO rotation_adjustments (teamId, type, memberId, delta) VALUES (?, ?, ?, ?)
       ON CONFLICT(teamId, type, memberId) DO UPDATE SET delta = excluded.delta`,
      [teamId, type, memberId, delta],
    )
  }
  res.json({ type, memberId, delta })
})

// GET /api/assignments/suggest/:type  — must be BEFORE /:id to avoid param conflict
// Archived entries are INTENTIONALLY included – they count for the fairness algorithm.
router.get('/suggest/:type', (req, res) => {
  const { type } = req.params
  const { teamId } = req
  const excluded = new Set(excludedMemberIds(teamId!))
  const members = dbAll<{ id: string }>(
    'SELECT id FROM members WHERE isActive = 1 AND teamId = ?', [teamId],
  ).filter((m) => !excluded.has(m.id))
  if (members.length === 0) return res.json({ memberId: null })

  const counts: Record<string, number> = {}
  const lastDates: Record<string, string> = {}
  members.forEach((m) => { counts[m.id] = 0; lastDates[m.id] = '1900-01-01' })

  // Count all non-synthetic entries for this team (including archived ones!)
  const past = dbAll<{ memberId: string; endDate: string }>(
    'SELECT memberId, endDate FROM assignments WHERE type = ? AND isSynthetic = 0 AND teamId = ?',
    [type, teamId],
  )
  for (const a of past) {
    if (counts[a.memberId] !== undefined) {
      counts[a.memberId]++
      if (a.endDate > lastDates[a.memberId]) lastDates[a.memberId] = a.endDate
    }
  }

  // Manual corrections count like real assignments
  for (const adj of adjustmentsFor(teamId!, type)) {
    if (counts[adj.memberId] !== undefined) counts[adj.memberId] += adj.delta
  }

  const minCount = Math.min(...members.map((m) => counts[m.id]))
  const candidates = members.filter((m) => counts[m.id] === minCount)
  candidates.sort((a, b) => lastDates[a.id].localeCompare(lastDates[b.id]))
  res.json({ memberId: candidates[0]?.id ?? null })
})

// GET /api/assignments/archive-preview?before=YYYY-MM-DD
router.get('/archive-preview', (req, res) => {
  const { teamId } = req
  const before = (req.query.before as string) || new Date().toISOString().split('T')[0]
  const rows = dbAll<Row>(
    `SELECT a.*, m.name as memberName
     FROM assignments a
     LEFT JOIN members m ON m.id = a.memberId
     WHERE a.endDate < ? AND a.isSynthetic = 0 AND a.isArchived = 0 AND a.teamId = ?
     ORDER BY a.endDate DESC`,
    [before, teamId],
  )
  res.json({ count: rows.length, items: rows.map(toAssignment) })
})

// POST /api/assignments/archive-old
router.post('/archive-old', (req, res) => {
  const { teamId } = req
  const before = (req.body.before as string) || new Date().toISOString().split('T')[0]
  const result = dbRun(
    'UPDATE assignments SET isArchived = 1 WHERE endDate < ? AND isSynthetic = 0 AND isArchived = 0 AND teamId = ?',
    [before, teamId],
  )
  res.json({ archived: result.changes })
})

// GET /api/assignments
router.get('/', (req, res) => {
  const { teamId } = req
  res.json(
    dbAll<Row>('SELECT * FROM assignments WHERE teamId = ? ORDER BY startDate DESC', [teamId])
      .map(toAssignment),
  )
})

// POST /api/assignments
router.post('/', (req, res) => {
  const { teamId } = req
  const { type, memberId, sprintId, startDate, endDate, notes = '', isAutoSuggested = false } = req.body
  if (!type || !memberId || !startDate || !endDate) {
    return res.status(400).json({ error: 'type, memberId, startDate and endDate are required.' })
  }
  const id = uid()
  dbRun(
    'INSERT INTO assignments (id, type, memberId, sprintId, startDate, endDate, notes, isAutoSuggested, isSynthetic, isArchived, teamId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)',
    [id, type, memberId, sprintId ?? null, startDate, endDate, notes, isAutoSuggested ? 1 : 0, teamId],
  )
  res.status(201).json(toAssignment(dbGet<Row>('SELECT * FROM assignments WHERE id = ?', [id])!))
})

// PATCH /api/assignments/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM assignments WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Assignment not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['type', 'memberId', 'sprintId', 'startDate', 'endDate', 'notes']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (req.body.isAutoSuggested !== undefined) {
    updates.push('isAutoSuggested = ?'); values.push(req.body.isAutoSuggested ? 1 : 0)
  }
  if (req.body.isArchived !== undefined) {
    updates.push('isArchived = ?'); values.push(req.body.isArchived ? 1 : 0)
  }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toAssignment(dbGet<Row>('SELECT * FROM assignments WHERE id = ?', [id])!))
})

// DELETE /api/assignments/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM assignments WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Assignment not found.' })
  res.status(204).send()
})

export default router
