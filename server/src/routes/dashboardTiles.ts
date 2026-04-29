import { Router } from 'express'
import { dbAll, dbGet, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()

interface TileRow {
  id: string
  title: string
  url: string
  description: string
  color: string
  is_global: number
  user_id: string
  sort_order: number
  created_at: string
}

function toTile(r: TileRow) {
  return {
    id:          r.id,
    title:       r.title,
    url:         r.url,
    description: r.description ?? '',
    color:       r.color,
    isGlobal:    r.is_global === 1,
    userId:      r.user_id,
    sortOrder:   r.sort_order,
    createdAt:   r.created_at,
  }
}

// GET /api/dashboard/tiles  – own tiles + global tiles
router.get('/tiles', (req, res) => {
  const rows = dbAll<TileRow>(
    `SELECT * FROM dashboard_tiles
     WHERE is_global = 1 OR user_id = ?
     ORDER BY is_global DESC, sort_order ASC, created_at ASC`,
    [req.user!.id],
  )
  res.json(rows.map(toTile))
})

// POST /api/dashboard/tiles
router.post('/tiles', (req, res) => {
  const { title, url, description = '', color = 'indigo', isGlobal = false } = req.body
  if (!title?.trim())  return res.status(400).json({ error: 'title is required' })
  if (!url?.trim())    return res.status(400).json({ error: 'url is required' })

  const maxOrder = dbGet<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) as m FROM dashboard_tiles WHERE user_id = ?',
    [req.user!.id],
  )
  const id  = crypto.randomUUID()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO dashboard_tiles (id, title, url, description, color, is_global, user_id, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title.trim(), url.trim(), description, color, isGlobal ? 1 : 0, req.user!.id, (maxOrder?.m ?? 0) + 1, now],
  )
  res.status(201).json(toTile(dbGet<TileRow>('SELECT * FROM dashboard_tiles WHERE id = ?', [id])!))
})

// PATCH /api/dashboard/tiles/:id
router.patch('/tiles/:id', (req, res) => {
  const { id } = req.params
  const tile = dbGet<TileRow>('SELECT * FROM dashboard_tiles WHERE id = ?', [id])
  if (!tile) return res.status(404).json({ error: 'Tile not found' })
  if (tile.user_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const updates: string[] = []
  const values:  unknown[] = []
  const { title, url, description, color, isGlobal } = req.body
  if (title       !== undefined) { updates.push('title = ?');       values.push(title.trim()) }
  if (url         !== undefined) { updates.push('url = ?');         values.push(url.trim()) }
  if (description !== undefined) { updates.push('description = ?'); values.push(description) }
  if (color       !== undefined) { updates.push('color = ?');       values.push(color) }
  if (isGlobal    !== undefined) { updates.push('is_global = ?');   values.push(isGlobal ? 1 : 0) }
  if (updates.length > 0) {
    values.push(id)
    dbRun(`UPDATE dashboard_tiles SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toTile(dbGet<TileRow>('SELECT * FROM dashboard_tiles WHERE id = ?', [id])!))
})

// DELETE /api/dashboard/tiles/:id
router.delete('/tiles/:id', (req, res) => {
  const tile = dbGet<TileRow>('SELECT * FROM dashboard_tiles WHERE id = ?', [req.params.id])
  if (!tile) return res.status(404).json({ error: 'Tile not found' })
  if (tile.user_id !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  dbRun('DELETE FROM dashboard_tiles WHERE id = ?', [req.params.id])
  res.status(204).send()
})

export default router
