import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toSkill(row: Row) {
  const { category, ...rest } = row
  let categories: string[]
  try {
    categories = JSON.parse(category as string)
  } catch {
    categories = [category as string]
  }
  return { ...rest, categories }
}

// GET /api/skills
router.get('/', (req, res) => {
  const { teamId } = req
  const skills = dbAll('SELECT * FROM skills WHERE teamId = ? ORDER BY name', [teamId]).map(toSkill)
  const memberSkills = dbAll(
    'SELECT ms.* FROM member_skills ms JOIN members m ON ms.memberId = m.id WHERE m.teamId = ?',
    [teamId],
  )
  res.json({ skills, memberSkills })
})

// POST /api/skills
router.post('/', (req, res) => {
  const { name, categories, description } = req.body
  if (!name || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: 'name and categories are required.' })
  }
  const id = uid()
  dbRun('INSERT INTO skills (id, name, category, description, teamId) VALUES (?, ?, ?, ?, ?)',
    [id, name, JSON.stringify(categories), description ?? null, req.teamId ?? null])
  res.status(201).json(toSkill(dbGet<Row>('SELECT * FROM skills WHERE id = ?', [id])!))
})

// PATCH /api/skills/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM skills WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Skill not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  for (const f of ['name', 'description']) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f] ?? null) }
  }
  if (req.body.categories !== undefined) {
    updates.push('category = ?'); values.push(JSON.stringify(req.body.categories))
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields provided.' })
  values.push(id)
  dbRun(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`, values)
  res.json(toSkill(dbGet<Row>('SELECT * FROM skills WHERE id = ?', [id])!))
})

// DELETE /api/skills/:id
router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM skills WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Skill not found.' })
  res.status(204).send()
})

// PUT /api/skills/member-skill  – set a single skill level for a member
router.put('/member-skill', (req, res) => {
  const { memberId, skillId, level, notes } = req.body
  if (memberId === undefined || skillId === undefined || level === undefined) {
    return res.status(400).json({ error: 'memberId, skillId and level are required.' })
  }
  const updatedAt = new Date().toISOString()
  dbRun(
    'INSERT OR REPLACE INTO member_skills (memberId, skillId, level, updatedAt, notes) VALUES (?, ?, ?, ?, ?)',
    [memberId, skillId, level, updatedAt, notes ?? null],
  )
  res.json({ memberId, skillId, level, updatedAt, notes: notes ?? null })
})

export default router
