import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { dbGet } from '../db'

// ─── JWT Secret ───────────────────────────────────────────────────────────────
// No fallback: if the environment variable is missing, the server will not start.
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

// ─── Mapping: page key → API path prefixes ────────────────────────────────────
// Used for server-side access control (requirePageAccess).
const PAGE_TO_API: Record<string, string[]> = {
  team:           ['/api/members'],
  kompetenzen:    ['/api/skills'],
  sprints:        ['/api/sprints'],
  rotation:       ['/api/assignments', '/api/responsibility-types'],
  retro:          ['/api/retrospectives'],
  pulse:          ['/api/pulse'],
  'azure-ranking': ['/api/azure-ranking'],
  // dashboard, health, stakeholder have no dedicated API endpoints
}

export interface AuthUser {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'user'
  forbiddenPages: string[]
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
// Validates the X-Team-ID header and attaches teamId to req.
// Must be used after requireAuth.
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
// Blocks write operations (POST/PUT/PATCH/DELETE) on locked sections.
// GET requests are always allowed because reference data (e.g. member names)
// is needed across sections (Dashboard, Sprints, Rotation, etc.).
// Admins always have full access.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requirePageAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }
  if (user.role === 'admin' || user.forbiddenPages.length === 0) {
    next()
    return
  }

  // Read access (GET, HEAD, OPTIONS) is always allowed
  if (!WRITE_METHODS.has(req.method)) {
    next()
    return
  }

  const requestedPath = req.baseUrl + req.path

  for (const page of user.forbiddenPages) {
    const prefixes = PAGE_TO_API[page] ?? []
    for (const prefix of prefixes) {
      if (requestedPath.startsWith(prefix)) {
        res.status(403).json({ error: `No access to section "${page}"` })
        return
      }
    }
  }

  next()
}
