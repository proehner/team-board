import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { dbGet, dbRun } from '../db'
import { JWT_SECRET, JWT_EXPIRES_IN, requireAuth, type AuthUser } from '../middleware/auth'
import crypto from 'crypto'

const router = Router()

interface UserRow {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: 'admin' | 'user'
  forbidden_pages: string
  is_active: number
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string }

  if (!username || !password) {
    res.status(400).json({ error: 'Benutzername und Passwort erforderlich' })
    return
  }

  const user = dbGet<UserRow>(
    'SELECT * FROM users WHERE username = ? AND is_active = 1',
    [username.toLowerCase().trim()],
  )

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Benutzername oder Passwort falsch' })
    return
  }

  const payload: AuthUser = {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    forbiddenPages: JSON.parse(user.forbidden_pages ?? '[]'),
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  res.json({ token, user: payload })
})

// GET /api/auth/me  – gibt frische Benutzerdaten zurück (Token wird mitgeschickt)
router.get('/me', requireAuth, (req, res) => {
  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ? AND is_active = 1', [req.user!.id])
  if (!user) {
    res.status(401).json({ error: 'Benutzer nicht gefunden' })
    return
  }
  const payload: AuthUser = {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    forbiddenPages: JSON.parse(user.forbidden_pages ?? '[]'),
  }
  res.json(payload)
})

// POST /api/auth/change-password  – Passwort ändern (eigenes Konto)
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' })
    return
  }

  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [req.user!.id])
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Aktuelles Passwort falsch' })
    return
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  dbRun('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user!.id])
  res.json({ ok: true })
})

export function seedAdminUser(): void {
  const existing = dbGet<{ n: number }>('SELECT COUNT(*) as n FROM users')
  if ((existing?.n ?? 0) > 0) return

  const hash = bcrypt.hashSync('admin123', 10)
  dbRun(
    'INSERT INTO users (id, username, password_hash, display_name, role, forbidden_pages, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    [crypto.randomUUID(), 'admin', hash, 'Administrator', 'admin', '[]', new Date().toISOString()],
  )
  console.log('Standard-Admin erstellt: admin / admin123 (bitte sofort ändern!)')
}

export default router
