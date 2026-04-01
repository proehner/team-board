import { Router } from 'express'
import { dbGet, dbAll, dbRun } from '../db'
import crypto from 'crypto'

const router = Router()
const uid = () => crypto.randomUUID()

type Row = Record<string, unknown>

function toCheck(row: Row) {
  const questions = JSON.parse(row.questions as string)
  const responses = dbAll<{ ratings: string }>('SELECT ratings FROM pulse_responses WHERE checkId = ?', [row.id as string])
  const responseCount = responses.length
  const averageRatings: number[] = questions.map((_: unknown, i: number) => {
    if (responseCount === 0) return 0
    const sum = responses.reduce((acc, r) => {
      const arr = JSON.parse(r.ratings)
      return acc + (arr[i] ?? 0)
    }, 0)
    return Math.round((sum / responseCount) * 10) / 10
  })
  return { ...row, questions, responseCount, averageRatings }
}

router.get('/', (_req, res) => {
  res.json(dbAll<Row>('SELECT * FROM pulse_checks ORDER BY createdAt DESC').map(toCheck))
})

router.get('/:id', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM pulse_checks WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Not found.' })
  res.json(toCheck(row))
})

router.post('/', (req, res) => {
  const { title, questions, sprintId } = req.body
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'title and questions are required.' })
  }
  const id = uid()
  dbRun('INSERT INTO pulse_checks (id, title, questions, sprintId, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, title, JSON.stringify(questions), sprintId ?? null, new Date().toISOString()])
  res.status(201).json(toCheck(dbGet<Row>('SELECT * FROM pulse_checks WHERE id = ?', [id])!))
})

router.post('/:id/respond', (req, res) => {
  const row = dbGet<Row>('SELECT * FROM pulse_checks WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'Not found.' })
  if (row.closedAt) return res.status(409).json({ error: 'Check is already closed.' })
  const { ratings } = req.body
  if (!Array.isArray(ratings)) return res.status(400).json({ error: 'ratings required.' })
  dbRun('INSERT INTO pulse_responses (id, checkId, ratings, submittedAt) VALUES (?, ?, ?, ?)',
    [uid(), req.params.id, JSON.stringify(ratings), new Date().toISOString()])
  res.status(201).json({ ok: true })
})

router.patch('/:id', (req, res) => {
  const { id } = req.params
  if (!dbGet('SELECT id FROM pulse_checks WHERE id = ?', [id])) {
    return res.status(404).json({ error: 'Not found.' })
  }
  const updates: string[] = []
  const values: unknown[] = []
  if (req.body.title !== undefined) { updates.push('title = ?'); values.push(req.body.title) }
  if (req.body.closedAt !== undefined) { updates.push('closedAt = ?'); values.push(req.body.closedAt) }
  if (updates.length > 0) { values.push(id); dbRun(`UPDATE pulse_checks SET ${updates.join(', ')} WHERE id = ?`, values) }
  res.json(toCheck(dbGet<Row>('SELECT * FROM pulse_checks WHERE id = ?', [id])!))
})

router.delete('/:id', (req, res) => {
  const r = dbRun('DELETE FROM pulse_checks WHERE id = ?', [req.params.id])
  if (r.changes === 0) return res.status(404).json({ error: 'Not found.' })
  res.status(204).send()
})

export default router
