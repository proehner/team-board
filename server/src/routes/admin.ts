import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { dbAll, dbGet, dbRun } from '../db'
import { requireAuth, requireAdmin, computePagePermissions, ALL_PAGE_KEYS } from '../middleware/auth'
import crypto from 'crypto'

const router = Router()

router.use(requireAuth, requireAdmin)

// ─── User helpers ─────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: 'admin' | 'user'
  forbidden_pages: string
  is_active: number
  created_at: string
  member_id?: string
}

function userToPublic(u: UserRow) {
  const forbiddenPages: string[] = JSON.parse(u.forbidden_pages ?? '[]')
  const groupIds = dbAll<{ group_id: string }>(
    'SELECT group_id FROM user_groups WHERE user_id = ?',
    [u.id],
  ).map((r) => r.group_id)

  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    forbiddenPages,
    pagePermissions: u.role === 'admin' ? {} : computePagePermissions(u.id, forbiddenPages),
    groupIds,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
    memberId: u.member_id ?? undefined,
  }
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', (_req, res) => {
  const users = dbAll<UserRow>('SELECT * FROM users ORDER BY created_at ASC')
  res.json(users.map(userToPublic))
})

// ─── POST /api/admin/users ────────────────────────────────────────────────────
router.post('/users', (req, res) => {
  const { username, password, displayName, role, groupIds, memberId } =
    req.body as {
      username?: string
      password?: string
      displayName?: string
      role?: string
      groupIds?: string[]
      memberId?: string | null
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
  const safeMemberId = memberId || null

  dbRun(
    'INSERT INTO users (id, username, password_hash, display_name, role, forbidden_pages, is_active, created_at, member_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
    [id, username.toLowerCase().trim(), hash, displayName.trim(), safeRole, '[]', new Date().toISOString(), safeMemberId],
  )

  // Assign to default group(s) if none explicitly provided
  const assignGroups = Array.isArray(groupIds) ? groupIds : []
  if (assignGroups.length === 0) {
    const defaultGroups = dbAll<{ id: string }>(
      'SELECT id FROM permission_groups WHERE is_default = 1',
    )
    for (const g of defaultGroups) assignGroups.push(g.id)
  }
  for (const gid of assignGroups) {
    const exists = dbGet('SELECT id FROM permission_groups WHERE id = ?', [gid])
    if (exists) dbRun('INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)', [id, gid])
  }

  const created = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])!
  res.status(201).json(userToPublic(created))
})

// ─── PATCH /api/admin/users/:id ───────────────────────────────────────────────
router.patch('/users/:id', (req, res) => {
  const { id } = req.params
  const { displayName, role, groupIds, isActive, password, memberId } =
    req.body as {
      displayName?: string
      role?: string
      groupIds?: string[]
      isActive?: boolean
      password?: string
      memberId?: string | null
    }

  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (user.role === 'admin' && (role === 'user' || isActive === false)) {
    const adminCount = dbGet<{ n: number }>(
      "SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND is_active = 1",
    )
    if ((adminCount?.n ?? 0) <= 1) {
      res.status(400).json({ error: 'The last active administrator cannot be modified' })
      return
    }
  }

  const newDisplayName = displayName !== undefined ? displayName.trim()  : user.display_name
  const newRole        = role        !== undefined ? (role === 'admin' ? 'admin' : 'user') : user.role
  const newActive      = isActive    !== undefined ? (isActive ? 1 : 0) : user.is_active
  const newHash        = password && password.length >= 6
    ? bcrypt.hashSync(password, 10)
    : user.password_hash
  const newMemberId    = memberId !== undefined ? (memberId || null) : user.member_id

  if (password && password.length > 0 && password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' })
    return
  }

  dbRun(
    'UPDATE users SET display_name = ?, role = ?, is_active = ?, password_hash = ?, member_id = ? WHERE id = ?',
    [newDisplayName, newRole, newActive, newHash, newMemberId, id],
  )

  // Update group assignments if provided
  if (Array.isArray(groupIds)) {
    dbRun('DELETE FROM user_groups WHERE user_id = ?', [id])
    for (const gid of groupIds) {
      const exists = dbGet('SELECT id FROM permission_groups WHERE id = ?', [gid])
      if (exists) dbRun('INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)', [id, gid])
    }
  }

  const updated = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])!
  res.json(userToPublic(updated))
})

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
  const { id } = req.params

  const user = dbGet<UserRow>('SELECT * FROM users WHERE id = ?', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

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

// ─── Permission Group helpers ─────────────────────────────────────────────────

interface GroupRow {
  id: string
  name: string
  description: string
  permissions: string
  is_default: number
  created_at: string
}

function groupToPublic(g: GroupRow) {
  let permissions: Record<string, string> = {}
  try { permissions = JSON.parse(g.permissions) } catch { /* use empty */ }

  // Ensure all pages are represented.
  // Sub-permissions (kompetenzen-matrix, kompetenzen-matrix-footer) default to 'read'.
  const SUB_READ_DEFAULTS = new Set(['kompetenzen-matrix', 'kompetenzen-matrix-footer', 'azure-ranking-refresh'])
  for (const page of ALL_PAGE_KEYS) {
    if (!(page in permissions)) permissions[page] = SUB_READ_DEFAULTS.has(page) ? 'read' : 'write'
  }
  // 'none' is not a valid UI choice for kompetenzen-matrix (block via parent page instead).
  if (permissions['kompetenzen-matrix'] === 'none') permissions['kompetenzen-matrix'] = 'read'

  const memberCount = dbGet<{ n: number }>(
    'SELECT COUNT(*) as n FROM user_groups WHERE group_id = ?',
    [g.id],
  )?.n ?? 0

  return {
    id: g.id,
    name: g.name,
    description: g.description,
    permissions,
    isDefault: g.is_default === 1,
    memberCount,
    createdAt: g.created_at,
  }
}

// ─── GET /api/admin/groups ────────────────────────────────────────────────────
router.get('/groups', (_req, res) => {
  const groups = dbAll<GroupRow>('SELECT * FROM permission_groups ORDER BY created_at ASC')
  res.json(groups.map(groupToPublic))
})

// ─── POST /api/admin/groups ───────────────────────────────────────────────────
router.post('/groups', (req, res) => {
  const { name, description, permissions, isDefault } =
    req.body as {
      name?: string
      description?: string
      permissions?: Record<string, string>
      isDefault?: boolean
    }

  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name required' })
    return
  }

  const existing = dbGet('SELECT id FROM permission_groups WHERE name = ?', [name.trim()])
  if (existing) {
    res.status(409).json({ error: 'Group name already taken' })
    return
  }

  // Build safe permissions object
  const safePerms: Record<string, string> = {}
  for (const page of ALL_PAGE_KEYS) {
    const v = permissions?.[page]
    safePerms[page] = (v === 'none' || v === 'read' || v === 'write-own') ? v : 'write'
  }

  const id = crypto.randomUUID()

  // If this is set as default, unset previous defaults
  if (isDefault) {
    dbRun('UPDATE permission_groups SET is_default = 0 WHERE is_default = 1')
  }

  dbRun(
    'INSERT INTO permission_groups (id, name, description, permissions, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name.trim(), (description ?? '').trim(), JSON.stringify(safePerms), isDefault ? 1 : 0, new Date().toISOString()],
  )

  const created = dbGet<GroupRow>('SELECT * FROM permission_groups WHERE id = ?', [id])!
  res.status(201).json(groupToPublic(created))
})

// ─── PATCH /api/admin/groups/:id ─────────────────────────────────────────────
router.patch('/groups/:id', (req, res) => {
  const { id } = req.params
  const { name, description, permissions, isDefault } =
    req.body as {
      name?: string
      description?: string
      permissions?: Record<string, string>
      isDefault?: boolean
    }

  const group = dbGet<GroupRow>('SELECT * FROM permission_groups WHERE id = ?', [id])
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  if (name !== undefined) {
    const conflict = dbGet('SELECT id FROM permission_groups WHERE name = ? AND id != ?', [name.trim(), id])
    if (conflict) {
      res.status(409).json({ error: 'Group name already taken' })
      return
    }
  }

  const newName = name !== undefined ? name.trim() : group.name
  const newDesc = description !== undefined ? description.trim() : group.description

  let newPerms: Record<string, string>
  try { newPerms = JSON.parse(group.permissions) } catch { newPerms = {} }
  if (permissions) {
    for (const page of ALL_PAGE_KEYS) {
      const v = permissions[page]
      if (v === 'none' || v === 'read' || v === 'write' || v === 'write-own') newPerms[page] = v
    }
  }

  if (isDefault) {
    dbRun('UPDATE permission_groups SET is_default = 0 WHERE is_default = 1')
  }
  const newDefault = isDefault !== undefined ? (isDefault ? 1 : 0) : group.is_default

  dbRun(
    'UPDATE permission_groups SET name = ?, description = ?, permissions = ?, is_default = ? WHERE id = ?',
    [newName, newDesc, JSON.stringify(newPerms), newDefault, id],
  )

  const updated = dbGet<GroupRow>('SELECT * FROM permission_groups WHERE id = ?', [id])!
  res.json(groupToPublic(updated))
})

// ─── DELETE /api/admin/groups/:id ────────────────────────────────────────────
router.delete('/groups/:id', (req, res) => {
  const { id } = req.params
  const group = dbGet<GroupRow>('SELECT * FROM permission_groups WHERE id = ?', [id])
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }
  dbRun('DELETE FROM permission_groups WHERE id = ?', [id])
  res.status(204).end()
})

export default router
