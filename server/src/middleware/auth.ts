import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { dbAll, dbGet } from '../db'

// ─── JWT Secret ───────────────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error(
    '\n❌  ERROR: Environment variable JWT_SECRET is not set.\n' +
    '   Create a .env file in the server/ directory:\n' +
    '   JWT_SECRET=<long-random-value>\n' +
    '   Example: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n',
  )
  process.exit(1)
}

export const JWT_SECRET     = process.env.JWT_SECRET
export const JWT_EXPIRES_IN = '8h'

export type PagePermission = 'none' | 'read' | 'write-own' | 'write'

// ─── All controllable page keys ───────────────────────────────────────────────
export const ALL_PAGE_KEYS = [
  'dashboard',
  'team',
  'kompetenzen',
  'kompetenzen-matrix',
  'kompetenzen-matrix-footer',
  'sprints',
  'rotation',
  'retro',
  'health',
  'pulse',
  'stakeholder',
  'azure-ranking',
  'azure-ranking-refresh',
  'known-errors',
  'meetings',
  'tickets',
  'roadmap',
]

// Sub-permissions that are never auto-granted based on admin role.
// They must be explicitly set in a permission group, even for admins.
export const NON_BYPASSABLE_SUBS = new Set(['azure-ranking-refresh'])

// ─── Mapping: page key → API path prefixes ────────────────────────────────────
// NOTE: kompetenzen-matrix must come BEFORE kompetenzen so that
// /api/skills/member-skill is matched by the more specific prefix first.
export const PAGE_TO_API: Record<string, string[]> = {
  team:                 ['/api/members'],
  'kompetenzen-matrix': ['/api/skills/member-skill'],
  kompetenzen:          ['/api/skills', '/api/skill-areas'],
  sprints:              ['/api/sprints'],
  rotation:             ['/api/assignments', '/api/responsibility-types'],
  retro:                ['/api/retrospectives'],
  pulse:                ['/api/pulse'],
  'azure-ranking':      ['/api/azure-ranking'],
  'known-errors':       ['/api/known-errors'],
  meetings:             ['/api/meetings'],
  tickets:              ['/api/tickets', '/api/ticket-categories'],
  roadmap:              ['/api/roadmap'],
}

const PERM_RANK: Record<PagePermission, number> = { none: 0, read: 1, 'write-own': 2, write: 3 }

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'user'
  forbiddenPages: string[]
  pagePermissions: Record<string, PagePermission>
  memberId?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
      teamId?: string
    }
  }
}

// ─── computePagePermissions ───────────────────────────────────────────────────
// Resolves effective permissions by union-ing all assigned permission groups.
// If the user has no groups, falls back to forbidden_pages (those = 'none').
export function computePagePermissions(
  userId: string,
  forbiddenPages: string[],
): Record<string, PagePermission> {
  const result: Record<string, PagePermission> = {}

  const groupRows = dbAll<{ permissions: string }>(
    `SELECT pg.permissions
     FROM user_groups ug
     JOIN permission_groups pg ON pg.id = ug.group_id
     WHERE ug.user_id = ?`,
    [userId],
  )

  if (groupRows.length === 0) {
    // Backward compat: forbidden_pages entries become 'none', rest 'write'
    for (const page of ALL_PAGE_KEYS) {
      result[page] = forbiddenPages.includes(page) ? 'none' : 'write'
    }
    return result
  }

  // Start all pages at 'none', then raise to the highest group permission.
  // kompetenzen-matrix starts at 'read' because 'none' is not a valid UI choice
  // (block the whole section via kompetenzen = none instead).
  for (const page of ALL_PAGE_KEYS) {
    result[page] = page === 'kompetenzen-matrix' ? 'read' : 'none'
  }

  for (const row of groupRows) {
    let perms: Record<string, string> = {}
    try { perms = JSON.parse(row.permissions) } catch { /* skip malformed */ }

    for (const page of ALL_PAGE_KEYS) {
      let storedPerm: string
      if (page === 'kompetenzen-matrix' && !(page in perms)) {
        // Groups created before kompetenzen-matrix was introduced lack that key;
        // inherit from kompetenzen so existing write-access isn't silently lost.
        storedPerm = perms['kompetenzen'] ?? 'none'
      } else if (page === 'kompetenzen-matrix-footer' && !(page in perms)) {
        // Groups created before kompetenzen-matrix-footer was introduced lack that key;
        // default to 'read' so existing groups keep showing the footer.
        storedPerm = 'read'
      } else if (page === 'azure-ranking-refresh' && !(page in perms)) {
        // Groups created before azure-ranking-refresh was introduced lack that key;
        // default to 'read' so existing groups can still trigger refreshes.
        storedPerm = 'read'
      } else {
        storedPerm = perms[page] ?? 'none'
      }
      const groupPerm = storedPerm as PagePermission
      if (PERM_RANK[groupPerm] > PERM_RANK[result[page]]) {
        result[page] = groupPerm
      }
    }
  }

  return result
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization']
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    // Ensure pagePermissions exists for tokens issued before this feature
    if (!payload.pagePermissions) {
      payload.pagePermissions = {}
      for (const page of ALL_PAGE_KEYS) {
        payload.pagePermissions[page] = payload.forbiddenPages?.includes(page) ? 'none' : 'write'
      }
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' })
  }
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Insufficient permissions' })
    return
  }
  next()
}

// ─── requireTeam ─────────────────────────────────────────────────────────────
export function requireTeam(req: Request, res: Response, next: NextFunction): void {
  const teamId = req.headers['x-team-id'] as string | undefined
  if (!teamId) {
    res.status(400).json({ error: 'X-Team-ID header required' })
    return
  }
  const team = dbGet<{ id: string }>('SELECT id FROM teams WHERE id = ?', [teamId])
  if (!team) {
    res.status(404).json({ error: 'Team not found' })
    return
  }
  req.teamId = teamId
  next()
}

// ─── requirePageAccess ────────────────────────────────────────────────────────
// Enforces page-level permissions:
//   'none'  → all requests blocked (403)
//   'read'  → only GET/HEAD/OPTIONS allowed, writes return 403
//   'write' → all requests allowed
// Admins bypass all page access checks.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requirePageAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  if (user.role === 'admin') {
    next()
    return
  }

  const requestedPath = req.baseUrl + req.path

  for (const [page, prefixes] of Object.entries(PAGE_TO_API)) {
    for (const prefix of prefixes) {
      if (!requestedPath.startsWith(prefix)) continue

      const perm: PagePermission = user.pagePermissions?.[page] ?? 'write'

      if (perm === 'none') {
        res.status(403).json({ error: `No access to section "${page}"` })
        return
      }
      if (perm === 'read' && WRITE_METHODS.has(req.method)) {
        res.status(403).json({ error: `Read-only access to section "${page}"` })
        return
      }
      if (perm === 'write-own' && WRITE_METHODS.has(req.method)) {
        // For kompetenzen-matrix: only allow writes to the user's own member record
        if (page === 'kompetenzen-matrix') {
          const requestedMemberId = req.body?.memberId
          if (!requestedMemberId || requestedMemberId !== req.user?.memberId) {
            res.status(403).json({ error: 'Can only update your own skill levels' })
            return
          }
        }
        next()
        return
      }
      next()
      return
    }
  }

  next()
}
