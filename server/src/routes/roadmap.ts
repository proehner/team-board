import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

const JSON_FIELDS_FEATURE = ['tags'] as const
const JSON_FIELDS_TICKET  = ['tags'] as const
const JSON_FIELDS_ENDPOINT = [] as const
const JSON_FIELDS_SCREEN   = ['components', 'endpointIds'] as const

function toFeature(row: Row) {
  return {
    ...row,
    tags:             JSON.parse((row.tags as string) ?? '[]'),
    targetVersion:    row.targetVersion  ?? undefined,
    targetYear:       row.targetYear     ?? undefined,
    targetQuarter:    row.targetQuarter  ?? undefined,
    category:         row.category       ?? undefined,
  }
}

function toTicket(row: Row) {
  return {
    ...row,
    tags:            JSON.parse((row.tags as string) ?? '[]'),
    storyPoints:     row.storyPoints  ?? undefined,
    assignedTeam:    row.assignedTeam ?? undefined,
  }
}

// ─── All tickets (cross-feature summary) ─────────────────────────────────────

// GET /api/roadmap/tickets
router.get('/tickets', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM roadmap_tickets ORDER BY featureId, sortOrder ASC').map(toTicket))
})

// ─── Features ─────────────────────────────────────────────────────────────────

// GET /api/roadmap/features
router.get('/features', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM roadmap_features ORDER BY createdAt DESC').map(toFeature))
})

// GET /api/roadmap/features/:id
router.get('/features/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM roadmap_features WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Feature not found.' })
  res.json(toFeature(row))
})

// POST /api/roadmap/features
router.post('/features', (req, res) => {
  const {
    title,
    description = '',
    status = 'idea',
    priority = 'medium',
    targetVersion,
    targetYear,
    targetQuarter,
    category,
    tags = [],
    goals = '',
    acceptanceCriteria = '',
    uiNotes = '',
    backendNotes = '',
    technicalNotes = '',
    risks = '',
  } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO roadmap_features
       (id, title, description, status, priority, targetVersion, targetYear, targetQuarter,
        category, tags, goals, acceptanceCriteria, uiNotes, backendNotes, technicalNotes, risks, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, title.trim(), description, status, priority,
      targetVersion ?? null, targetYear ?? null, targetQuarter ?? null,
      category ?? null,
      JSON.stringify(tags),
      goals, acceptanceCriteria, uiNotes, backendNotes, technicalNotes, risks,
      now, now,
    ],
  )
  res.status(201).json(toFeature(dbGet<Row>('SELECT * FROM roadmap_features WHERE id = ?', [id])!))
})

// PATCH /api/roadmap/features/:id
router.patch('/features/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM roadmap_features WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Feature not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  const textFields = [
    'title', 'description', 'status', 'priority', 'targetVersion', 'targetYear',
    'targetQuarter', 'category', 'goals', 'acceptanceCriteria', 'uiNotes',
    'backendNotes', 'technicalNotes', 'risks',
  ]
  for (const f of textFields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f] ?? null)
    }
  }
  if (req.body.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(req.body.tags))
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(id)
    dbRun(`UPDATE roadmap_features SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toFeature(dbGet<Row>('SELECT * FROM roadmap_features WHERE id = ?', [id])!))
})

// DELETE /api/roadmap/features/:id
router.delete('/features/:id', (req, res) => {
  const r = dbRun('DELETE FROM roadmap_features WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Feature not found.' })
  res.status(204).send()
})

// ─── Tickets ──────────────────────────────────────────────────────────────────

// GET /api/roadmap/features/:featureId/tickets
router.get('/features/:featureId/tickets', (req, res) => {
  const tickets = dbAll<Row>(
    'SELECT * FROM roadmap_tickets WHERE featureId = ? ORDER BY sortOrder ASC, createdAt ASC',
    [req.params.featureId],
  )
  res.json(tickets.map(toTicket))
})

// POST /api/roadmap/features/:featureId/tickets
router.post('/features/:featureId/tickets', (req, res) => {
  const { featureId } = req.params
  if (!dbGet('SELECT id FROM roadmap_features WHERE id = ?', [featureId])) {
    return res.status(404).json({ error: 'Feature not found.' })
  }
  const {
    title,
    description = '',
    acceptanceCriteria = '',
    type = 'task',
    area = 'other',
    storyPoints,
    priority = 'medium',
    assignedTeam,
    tags = [],
    sortOrder = 0,
  } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'title is required.' })
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO roadmap_tickets
       (id, featureId, title, description, acceptanceCriteria, type, area,
        storyPoints, priority, assignedTeam, tags, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, featureId, title.trim(), description, acceptanceCriteria, type, area,
      storyPoints ?? null, priority, assignedTeam ?? null,
      JSON.stringify(tags), sortOrder, now, now,
    ],
  )
  res.status(201).json(toTicket(dbGet<Row>('SELECT * FROM roadmap_tickets WHERE id = ?', [id])!))
})

// PATCH /api/roadmap/features/:featureId/tickets/:ticketId
router.patch('/features/:featureId/tickets/:ticketId', (req, res) => {
  const { ticketId } = req.params
  if (!dbGet('SELECT id FROM roadmap_tickets WHERE id = ?', [ticketId])) {
    return res.status(404).json({ error: 'Ticket not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  const fields = [
    'title', 'description', 'acceptanceCriteria', 'type', 'area',
    'storyPoints', 'priority', 'assignedTeam', 'sortOrder',
  ]
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f] ?? null)
    }
  }
  if (req.body.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(req.body.tags))
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(ticketId)
    dbRun(`UPDATE roadmap_tickets SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toTicket(dbGet<Row>('SELECT * FROM roadmap_tickets WHERE id = ?', [ticketId])!))
})

// DELETE /api/roadmap/features/:featureId/tickets/:ticketId
router.delete('/features/:featureId/tickets/:ticketId', (req, res) => {
  const r = dbRun('DELETE FROM roadmap_tickets WHERE id = ?', [req.params.ticketId])
  if (r.changes === 0) return res.status(404).json({ error: 'Ticket not found.' })
  res.status(204).send()
})

// ─── Endpoints ────────────────────────────────────────────────────────────────

function toEndpoint(row: Row) {
  return { ...row, authRequired: row.authRequired === 1 || row.authRequired === true }
}

function toScreen(row: Row) {
  return {
    ...row,
    components:  JSON.parse((row.components  as string) ?? '[]'),
    endpointIds: JSON.parse((row.endpointIds as string) ?? '[]'),
  }
}

// GET /api/roadmap/features/:featureId/endpoints
router.get('/features/:featureId/endpoints', (req, res) => {
  const rows = dbAll<Row>(
    'SELECT * FROM roadmap_endpoints WHERE featureId = ? ORDER BY sortOrder ASC, createdAt ASC',
    [req.params.featureId],
  )
  res.json(rows.map(toEndpoint))
})

// POST /api/roadmap/features/:featureId/endpoints
router.post('/features/:featureId/endpoints', (req, res) => {
  const { featureId } = req.params
  if (!dbGet('SELECT id FROM roadmap_features WHERE id = ?', [featureId])) {
    return res.status(404).json({ error: 'Feature not found.' })
  }
  const {
    method = 'GET',
    path: p = '',
    title = '',
    description = '',
    requestBody = '',
    responseBody = '',
    authRequired = true,
    complexity = 'm',
    notes = '',
    sortOrder = 0,
  } = req.body
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO roadmap_endpoints
       (id, featureId, method, path, title, description, requestBody, responseBody,
        authRequired, complexity, notes, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, featureId, method, p, title, description, requestBody, responseBody,
     authRequired ? 1 : 0, complexity, notes, sortOrder, now, now],
  )
  res.status(201).json(toEndpoint(dbGet<Row>('SELECT * FROM roadmap_endpoints WHERE id = ?', [id])!))
})

// PATCH /api/roadmap/features/:featureId/endpoints/:endpointId
router.patch('/features/:featureId/endpoints/:endpointId', (req, res) => {
  const { endpointId } = req.params
  if (!dbGet('SELECT id FROM roadmap_endpoints WHERE id = ?', [endpointId])) {
    return res.status(404).json({ error: 'Endpoint not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  const fields = ['method', 'path', 'title', 'description', 'requestBody', 'responseBody', 'complexity', 'notes', 'sortOrder']
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f] ?? null)
    }
  }
  if (req.body.authRequired !== undefined) {
    updates.push('authRequired = ?')
    values.push(req.body.authRequired ? 1 : 0)
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(endpointId)
    dbRun(`UPDATE roadmap_endpoints SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toEndpoint(dbGet<Row>('SELECT * FROM roadmap_endpoints WHERE id = ?', [endpointId])!))
})

// DELETE /api/roadmap/features/:featureId/endpoints/:endpointId
router.delete('/features/:featureId/endpoints/:endpointId', (req, res) => {
  const r = dbRun('DELETE FROM roadmap_endpoints WHERE id = ?', [req.params.endpointId])
  if (r.changes === 0) return res.status(404).json({ error: 'Endpoint not found.' })
  res.status(204).send()
})

// ─── Screens ──────────────────────────────────────────────────────────────────

// GET /api/roadmap/features/:featureId/screens
router.get('/features/:featureId/screens', (req, res) => {
  const rows = dbAll<Row>(
    'SELECT * FROM roadmap_screens WHERE featureId = ? ORDER BY sortOrder ASC, createdAt ASC',
    [req.params.featureId],
  )
  res.json(rows.map(toScreen))
})

// POST /api/roadmap/features/:featureId/screens
router.post('/features/:featureId/screens', (req, res) => {
  const { featureId } = req.params
  if (!dbGet('SELECT id FROM roadmap_features WHERE id = ?', [featureId])) {
    return res.status(404).json({ error: 'Feature not found.' })
  }
  const {
    title = '',
    route = '',
    description = '',
    components = [],
    endpointIds = [],
    wireframeNotes = '',
    sortOrder = 0,
  } = req.body
  const id  = uid()
  const now = new Date().toISOString()
  dbRun(
    `INSERT INTO roadmap_screens
       (id, featureId, title, route, description, components, endpointIds, wireframeNotes, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, featureId, title, route, description,
     JSON.stringify(components), JSON.stringify(endpointIds),
     wireframeNotes, sortOrder, now, now],
  )
  res.status(201).json(toScreen(dbGet<Row>('SELECT * FROM roadmap_screens WHERE id = ?', [id])!))
})

// PATCH /api/roadmap/features/:featureId/screens/:screenId
router.patch('/features/:featureId/screens/:screenId', (req, res) => {
  const { screenId } = req.params
  if (!dbGet('SELECT id FROM roadmap_screens WHERE id = ?', [screenId])) {
    return res.status(404).json({ error: 'Screen not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  const fields = ['title', 'route', 'description', 'wireframeNotes', 'sortOrder']
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`)
      values.push(req.body[f] ?? null)
    }
  }
  if (req.body.components !== undefined) {
    updates.push('components = ?')
    values.push(JSON.stringify(req.body.components))
  }
  if (req.body.endpointIds !== undefined) {
    updates.push('endpointIds = ?')
    values.push(JSON.stringify(req.body.endpointIds))
  }
  if (updates.length > 0) {
    updates.push('updatedAt = ?')
    values.push(new Date().toISOString())
    values.push(screenId)
    dbRun(`UPDATE roadmap_screens SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  res.json(toScreen(dbGet<Row>('SELECT * FROM roadmap_screens WHERE id = ?', [screenId])!))
})

// DELETE /api/roadmap/features/:featureId/screens/:screenId
router.delete('/features/:featureId/screens/:screenId', (req, res) => {
  const r = dbRun('DELETE FROM roadmap_screens WHERE id = ?', [req.params.screenId])
  if (r.changes === 0) return res.status(404).json({ error: 'Screen not found.' })
  res.status(204).send()
})

export default router
