import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { dbAll, dbGet, dbRun } from '../db'
import { requireAuth, requireAdmin } from '../middleware/auth'
import crypto from 'crypto'

const router = Router()

// All routes require auth + admin role
router.use(requireAuth, requireAdmin)

interface UserRow {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: 'admin' | 'user'
  forbidden_pages: string
  is_active: number
  created_at: string
}

function toPublic(u: UserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    forbiddenPages: JSON.parse(u.forbidden_pages ?? '[]') as string[],
    isActive: u.is_active === 1,
    createdAt: u.created_at,
  }
}

// GET /api/admin/users
router.get('/users', (_req, res) => {
  const users = dbAll<UserRow>('SELECT * FROM users ORDER BY created_at ASC')
  res.json(users.map(toPublic))
})

// POST /api/admin/users
router.post('/users', (req, res) => {
  const { username, password, displayName, role, forbiddenPages } =
    req.body as {
      username?: string
      password?: string
      displayName?: string
      role?: string
      forbiddenPages?: string[]
    }

  if (!username || !password || !displayName) {
    res.status(400).json({ error: 'Username, password and display name required' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' })
    return
  }

  const existing = dbGet('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()])
  if (existing) {
    res.status(409).json({ error: 'Username already taken' })
    return
  }

  const hash = bcrypt.hashSync(password, 10)
  const id = crypto.randomUUID()
  const safeRole = role === 'admin' ? 'admin' : 'user'
  const pages = JSON.stringify(Array.isArray(forbiddenPages) ? forbiddenPages : [])

  dbRun(
    'INSERT INTO users (id, username, password_hash, display_name, role, forbidden_pages, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    [id, username.toLowerCase().trim(), hash, displayName.trim(), safeRole, pages, new Date().toISOString()],
  )

  const created = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])!
  res.status(201).json(toPublic(created))
})

// PATCH /api/admin/users/:id
router.patch('/users/:id', (req, res) => {
  const { id } = req.params
  const { displayName, role, forbiddenPages, isActive, password } =
    req.body as {
      displayName?: string
      role?: string
      forbiddenPages?: string[]
      isActive?: boolean
      password?: string
    }

  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Do not deactivate / demote the last admin
  if (user.role === 'admin' && (role === 'user' || isActive === false)) {
    const adminCount = dbGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND is_active = 1",
    )
    if ((adminCount?.n ?? 0) <= 1) {
      res.status(400).json({ error: 'The last active administrator cannot be modified' })
      return
    }
  }

  const newDisplayName  = displayName  !== undefined ? displayName.trim()  : user.display_name
  const newRole         = role         !== undefined ? (role === 'admin' ? 'admin' : 'user') : user.role
  const newPages        = forbiddenPages !== undefined ? JSON.stringify(forbiddenPages) : user.forbidden_pages
  const newActive       = isActive     !== undefined ? (isActive ? 1 : 0) : user.is_active
  const newHash         = password && password.length >= 6
    ? bcrypt.hashSync(password, 10)
    : user.password_hash

  if (password && password.length > 0 && password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' })
    return
  }

  dbRun(
    'UPDATE users SET display_name = ?, role = ?, forbidden_pages = ?, is_active = ?, password_hash = ? WHERE id = ?',
    [newDisplayName, newRole, newPages, newActive, newHash, id],
  )

  const updated = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])!
  res.json(toPublic(updated))
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const { id } = req.params

  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  // Do not delete the last admin
  if (user.role === 'admin') {
    const adminCount = dbGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND is_active = 1",
    )
    if ((adminCount?.n ?? 0) <= 1) {
      res.status(400).json({ error: 'The last administrator cannot be deleted' })
      return
    }
  }

  dbRun('DELETE FROM users WHERE id = ?', [id])
  res.status(204).end()
})

export default router
