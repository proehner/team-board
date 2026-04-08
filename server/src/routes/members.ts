import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

const AVATAR_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316',
  '#84cc16','#0ea5e9','#a855f7','#e11d48',
]

function pickColor(): string {
  const row = dbGet<{ n: number }>('SELECT COUNT(*) as n FROM members')
  return AVATAR_COLORS[(row?.n ?? 0) % AVATAR_COLORS.length]
}

type Row = Record<string, unknown>

function toMember(row: Row) {
  const { role, isActive, ...rest } = row
  let roles: string[]
  try {
    roles = JSON.parse(role as string)
  } catch {
    roles = [role as string]
  }
  return { ...rest, roles, isActive: isActive === 1 || isActive === true }
}

// GET /api/members
router.get('/', (_req, res) => {
  res.json(dbAll('SELECT * FROM members ORDER BY joinedAt').map(toMember))
})

// POST /api/members
router.post('/', (req, res) => {
  const { name, email, roles, isActive = true } = req.body
  if (!name || !email || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'name, email and roles are required.' })
  }
  const id = uid()
  const joinedAt = new Date().toISOString().split('T')[0]
  dbRun('INSERT INTO members (id, name, email, role, avatarColor, joinedAt, isActive) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, email, JSON.stringify(roles), pickColor(), joinedAt, isActive ? 1 : 0])

  // Initial rotation leveling: bring new member up to the minimum level of active members
  const activeOthers = dbAll<{ id: string }>('SELECT id FROM members WHERE isActive = 1 AND id != ?', [id])
  if (activeOthers.length > 0) {
    const types = dbAll<{ name: string }>('SELECT name FROM responsibility_types')
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const yest = yesterday.toISOString().split('T')[0]
    for (const { name: type } of types) {
      const counts: Record<string, number> = {}
      activeOthers.forEach((m) => { counts[m.id] = 0 })
      const past = dbAll<{ memberId: string }>(
        'SELECT memberId FROM assignments WHERE type = ? AND isSynthetic = 0', [type],
      )
      for (const a of past) {
        if (counts[a.memberId] !== undefined) counts[a.memberId]++
      }
      const minCount = Math.min(...Object.values(counts))
      for (let i = 0; i < minCount; i++) {
        dbRun(
          'INSERT INTO assignments (id, type, memberId, sprintId, startDate, endDate, notes, isAutoSuggested, isSynthetic) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, 1)',
          [uid(), type, id, yest, yest, ''],
        )
      }
    }
  }

  res.status(201).json(toMember(dbGet<Row>('SELECT * FROM members WHERE id = ?', [id])!))
})

// PATCH /api/members/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM members WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Member not found.' })
  }
  const allowed = ['name', 'email', 'avatarColor', 'joinedAt'] as const
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of allowed) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
  }
  if (req.body.roles !== undefined) {
    updates.push('role = ?'); values.push(JSON.stringify(req.body.roles))
  }
  if (req.body.isActive !== undefined) {
    updates.push('isActive = ?'); values.push(req.body.isActive ? 1 : 0)
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' })
  values.push(id)
  dbRun(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(toMember(dbGet<Row>('SELECT * FROM members WHERE id = ?', [id])!))
})

// DELETE /api/members/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM members WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Member not found.' })
  res.status(204).send()
})

export default router
