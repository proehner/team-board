import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import { requireAdmin } from '../middleware/auth'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

const DEFAULT_RESPONSIBILITY_TYPES = [
  { name: 'Support-Dienst',   color: '#6366f1', sortOrder: 0 },
  { name: 'Code-Review-Lead', color: '#10b981', sortOrder: 1 },
  { name: 'Release-Manager',  color: '#f59e0b', sortOrder: 2 },
  { name: 'Incident-Manager', color: '#ef4444', sortOrder: 3 },
  { name: 'Demo-Moderator',   color: '#8b5cf6', sortOrder: 4 },
  { name: 'Onboarding-Buddy', color: '#14b8a6', sortOrder: 5 },
]

function seedResponsibilityTypesForTeam(teamId: string): void {
  const existing = dbAll<{ name: string }>(
    'SELECT name FROM responsibility_types WHERE teamId = ?', [teamId],
  )
  const existingNames = new Set(existing.map((r) => r.name))
  for (const t of DEFAULT_RESPONSIBILITY_TYPES) {
    if (!existingNames.has(t.name)) {
      dbRun(
        'INSERT INTO responsibility_types (id, name, teamId, color, sortOrder) VALUES (?, ?, ?, ?, ?)',
        [uid(), t.name, teamId, t.color, t.sortOrder],
      )
    }
  }
}

// GET /api/teams  – list all teams (no team header required)
router.get('/', (_req, res) => {
  const teams = dbAll<Row>('SELECT * FROM teams ORDER BY createdAt ASC')
  res.json(teams)
})

// POST /api/teams  – create a new team (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { name, description = '' } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required.' })
  const id = uid()
  dbRun(
    'INSERT INTO teams (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
    [id, name.trim(), description, new Date().toISOString()],
  )
  // Seed default responsibility types for the new team
  seedResponsibilityTypesForTeam(id)
  res.status(201).json(dbGet<Row>('SELECT * FROM teams WHERE id = ?', [id]))
})

// PATCH /api/teams/:id  – update team (admin only)
router.patch('/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM teams WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Team not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  if (req.body.name !== undefined)        { updates.push('name = ?');        values.push(req.body.name.trim()) }
  if (req.body.description !== undefined) { updates.push('description = ?'); values.push(req.body.description) }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' })
  values.push(id)
  dbRun(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(dbGet<Row>('SELECT * FROM teams WHERE id = ?', [id]))
})

// DELETE /api/teams/:id  – delete team (admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params
  const allTeams = dbAll<{ id: string }>('SELECT id FROM teams')
  if (allTeams.length <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last team.' })
  }
  const r = dbRun('DELETE FROM teams WHERE id = ?', [id])
  if (r.changes === 0) return res.status(404).json({ error: 'Team not found.' })
  res.status(204).send()
})

export { seedResponsibilityTypesForTeam }
export default router
