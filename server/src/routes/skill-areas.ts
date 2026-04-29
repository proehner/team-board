import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function buildAreas(teamId: string) {
  const areas = dbAll<Row>('SELECT * FROM skill_areas WHERE teamId = ? ORDER BY sortOrder, name', [teamId])
  const cats  = dbAll<Row>('SELECT * FROM skill_area_categories WHERE teamId = ? ORDER BY sortOrder, name', [teamId])
  return areas.map((a) => ({
    ...a,
    categories: cats.filter((c) => c.areaId === a.id),
  }))
}

// GET /api/skill-areas
router.get('/', (req, res) => {
  res.json(buildAreas(req.teamId!))
})

// POST /api/skill-areas
router.post('/', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  const id = uid()
  const maxOrder = (dbGet<{ n: number }>('SELECT COALESCE(MAX(sortOrder),0) as n FROM skill_areas WHERE teamId = ?', [req.teamId])?.n ?? 0)
  dbRun('INSERT INTO skill_areas (id, name, teamId, sortOrder) VALUES (?, ?, ?, ?)', [id, name.trim(), req.teamId, maxOrder + 1])
  res.status(201).json({ ...dbGet<Row>('SELECT * FROM skill_areas WHERE id = ?', [id])!, categories: [] })
})

// PATCH /api/skill-areas/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM skill_areas WHERE id = ? AND teamId = ?', [id, req.teamId])) {
    return res.status(404).json({ error: 'Area not found.' })
  }
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  dbRun('UPDATE skill_areas SET name = ? WHERE id = ?', [name.trim(), id])
  res.json({ ...dbGet<Row>('SELECT * FROM skill_areas WHERE id = ?', [id])!, categories: dbAll<Row>('SELECT * FROM skill_area_categories WHERE areaId = ? ORDER BY sortOrder, name', [id]) })
})

// DELETE /api/skill-areas/:id
router.delete('/:id', (req, res) => {
  // Unlink skills that reference categories in this area before deleting
  dbRun(`
    UPDATE skills SET categoryId = NULL
    WHERE categoryId IN (SELECT id FROM skill_area_categories WHERE areaId = ?)
  `, [req.params.id])
  const r = dbRun('DELETE FROM skill_areas WHERE id = ? AND teamId = ?', [req.params.id, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Area not found.' })
  res.status(204).send()
})

// POST /api/skill-areas/:id/categories
router.post('/:id/categories', (req, res) => {
  const areaId = req.params.id
  if (!dbGet('SELECT id FROM skill_areas WHERE id = ? AND teamId = ?', [areaId, req.teamId])) {
    return res.status(404).json({ error: 'Area not found.' })
  }
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  const id = uid()
  const maxOrder = (dbGet<{ n: number }>('SELECT COALESCE(MAX(sortOrder),0) as n FROM skill_area_categories WHERE areaId = ?', [areaId])?.n ?? 0)
  dbRun('INSERT INTO skill_area_categories (id, name, areaId, teamId, sortOrder) VALUES (?, ?, ?, ?, ?)', [id, name.trim(), areaId, req.teamId, maxOrder + 1])
  res.status(201).json(dbGet<Row>('SELECT * FROM skill_area_categories WHERE id = ?', [id])!)
})

// PATCH /api/skill-areas/:id/categories/:catId
router.patch('/:id/categories/:catId', (req, res) => {
  const { catId } = req.params
  if (!dbGet('SELECT id FROM skill_area_categories WHERE id = ? AND teamId = ?', [catId, req.teamId])) {
    return res.status(404).json({ error: 'Category not found.' })
  }
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'name is required.' })
  dbRun('UPDATE skill_area_categories SET name = ? WHERE id = ?', [name.trim(), catId])
  res.json(dbGet<Row>('SELECT * FROM skill_area_categories WHERE id = ?', [catId])!)
})

// DELETE /api/skill-areas/:id/categories/:catId
router.delete('/:id/categories/:catId', (req, res) => {
  const { catId } = req.params
  // Unlink skills that reference this category
  dbRun('UPDATE skills SET categoryId = NULL WHERE categoryId = ?', [catId])
  const r = dbRun('DELETE FROM skill_area_categories WHERE id = ? AND teamId = ?', [catId, req.teamId])
  if (r.changes === 0) return res.status(404).json({ error: 'Category not found.' })
  res.status(204).send()
})

export default router
