import { Router, RequestHandler } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { dbGet, dbAll, dbRun } from '../db'
import { requireAuth } from '../middleware/auth'

const router = Router()

// ─── Storage setup ────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
})

type AttachmentRow = {
  id: string
  knownErrorId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedAt: string
}

// ─── Attachment CRUD (auth required) ─────────────────────────────────────────
// These routes are defined BEFORE the /:filename catch-all to ensure they match first.

// GET /api/uploads/known-errors/:errorId/attachments
router.get('/known-errors/:errorId/attachments', requireAuth as RequestHandler, (req, res) => {
  const rows = dbAll<AttachmentRow>(
    'SELECT * FROM known_error_attachments WHERE knownErrorId = ? ORDER BY uploadedAt ASC',
    [req.params.errorId],
  )
  res.json(rows)
})

// POST /api/uploads/known-errors/:errorId/attachments
router.post(
  '/known-errors/:errorId/attachments',
  requireAuth as RequestHandler,
  upload.single('file'),
  (req, res) => {
    const { errorId } = req.params
    if (!dbGet('SELECT id FROM known_errors WHERE id = ?', [errorId])) {
      return res.status(404).json({ error: 'Known error not found.' })
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })

    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO known_error_attachments (id, knownErrorId, filename, originalName, mimeType, size, uploadedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, errorId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, now],
    )
    const row = dbGet<AttachmentRow>('SELECT * FROM known_error_attachments WHERE id = ?', [id])!
    res.status(201).json(row)
  },
)

// DELETE /api/uploads/known-errors/:errorId/attachments/:attachId
router.delete(
  '/known-errors/:errorId/attachments/:attachId',
  requireAuth as RequestHandler,
  (req, res) => {
    const { errorId, attachId } = req.params
    const row = dbGet<AttachmentRow>(
      'SELECT * FROM known_error_attachments WHERE id = ? AND knownErrorId = ?',
      [attachId, errorId],
    )
    if (!row) return res.status(404).json({ error: 'Attachment not found.' })

    const filePath = path.join(UPLOADS_DIR, row.filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    dbRun('DELETE FROM known_error_attachments WHERE id = ?', [attachId])
    res.status(204).send()
  },
)

// ─── Serve uploaded files (public — needed for <img> in markdown) ─────────────

// GET /api/uploads/:filename
router.get('/:filename', (req, res) => {
  const filename = path.basename(req.params.filename) // prevent path traversal
  const filePath = path.join(UPLOADS_DIR, filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' })
  res.sendFile(filePath)
})

export default router
