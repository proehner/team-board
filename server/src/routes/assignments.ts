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

// GET /api/assignments/suggest/:type  — must be BEFORE /:id to avoid param conflict
// Archivierte Einträge werden BEWUSST einbezogen – sie zählen für Fairness-Algorithmus und Statistik.
router.get('/suggest/:type', (req, res) => {
  const { type } = req.params
  const members = dbAll<{ id: string }>('SELECT id FROM members WHERE isActive = 1')
  if (members.length === 0) return res.json({ memberId: null })

  const counts: Record<string, number> = {}
  const lastDates: Record<string, string> = {}
  members.forEach((m) => { counts[m.id] = 0; lastDates[m.id] = '1900-01-01' })

  // Alle nicht-synthetischen Einträge zählen (inkl. archivierter!)
  const past = dbAll<{ memberId: string; endDate: string }>(
    'SELECT memberId, endDate FROM assignments WHERE type = ? AND isSynthetic = 0', [type],
  )
  for (const a of past) {
    if (counts[a.memberId] !== undefined) {
      counts[a.memberId]++
      if (a.endDate > lastDates[a.memberId]) lastDates[a.memberId] = a.endDate
    }
  }

  const minCount = Math.min(...members.map((m) => counts[m.id]))
  const candidates = members.filter((m) => counts[m.id] === minCount)
  candidates.sort((a, b) => lastDates[a.id].localeCompare(lastDates[b.id]))
  res.json({ memberId: candidates[0]?.id ?? null })
})

// GET /api/assignments/archive-preview?before=YYYY-MM-DD
// Gibt alle Einträge zurück, die archiviert werden würden (zur Vorschau).
router.get('/archive-preview', (req, res) => {
  const before = (req.query.before as string) || new Date().toISOString().split('T')[0]
  const rows = dbAll<Row>(
    `SELECT a.*, m.name as memberName
     FROM assignments a
     LEFT JOIN members m ON m.id = a.memberId
     WHERE a.endDate < ? AND a.isSynthetic = 0 AND a.isArchived = 0
     ORDER BY a.endDate DESC`,
    [before],
  )
  res.json({ count: rows.length, items: rows.map(toAssignment) })
})

// POST /api/assignments/archive-old
// Archiviert alle abgelaufenen Einträge (endDate < before). Löscht nichts.
router.post('/archive-old', (req, res) => {
  const before = (req.body.before as string) || new Date().toISOString().split('T')[0]
  const result = dbRun(
    'UPDATE assignments SET isArchived = 1 WHERE endDate < ? AND isSynthetic = 0 AND isArchived = 0',
    [before],
  )
  res.json({ archived: result.changes })
})

// GET /api/assignments
router.get('/', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM assignments ORDER BY startDate DESC').map(toAssignment))
})

// POST /api/assignments
router.post('/', (req, res) => {
  const { type, memberId, sprintId, startDate, endDate, notes = '', isAutoSuggested = false } = req.body
  if (!type || !memberId || !startDate || !endDate) {
    return res.status(400).json({ error: 'type, memberId, startDate und endDate sind erforderlich.' })
  }
  const id = uid()
  dbRun(
    'INSERT INTO assignments (id, type, memberId, sprintId, startDate, endDate, notes, isAutoSuggested, isSynthetic, isArchived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)',
    [id, type, memberId, sprintId ?? null, startDate, endDate, notes, isAutoSuggested ? 1 : 0],
  )
  res.status(201).json(toAssignment(dbGet<Row>('SELECT * FROM assignments WHERE id = ?', [id])!))
})

// PATCH /api/assignments/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM assignments WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Zuweisung nicht gefunden.' })
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
  const r = dbRun('DELETE FROM assignments WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Zuweisung nicht gefunden.' })
  res.status(204).send()
})

export default router
