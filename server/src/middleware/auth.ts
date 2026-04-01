import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// ─── JWT Secret ───────────────────────────────────────────────────────────────
// Kein Fallback: fehlt die Umgebungsvariable, startet der Server nicht.
if (!process.env.JWT_SECRET) {
  console.error(
    '\n❌  FEHLER: Umgebungsvariable JWT_SECRET ist nicht gesetzt.\n' +
    '   Lege eine .env-Datei im server/-Verzeichnis an:\n' +
    '   JWT_SECRET=<langer-zufälliger-wert>\n' +
    '   Beispiel: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n',
  )
  process.exit(1)
}

export const JWT_SECRET     = process.env.JWT_SECRET
export const JWT_EXPIRES_IN = '8h'

// ─── Mapping: Seiten-Key → API-Pfad-Präfixe ──────────────────────────────────
// Wird für die Backend-seitige Zugriffssteuerung (requirePageAccess) verwendet.
const PAGE_TO_API: Record<string, string[]> = {
  team:           ['/api/members'],
  kompetenzen:    ['/api/skills'],
  sprints:        ['/api/sprints'],
  rotation:       ['/api/assignments', '/api/responsibility-types'],
  retro:          ['/api/retrospectives'],
  pulse:          ['/api/pulse'],
  'azure-ranking': ['/api/azure-ranking'],
  // dashboard, health, stakeholder nutzen keine eigenen API-Endpunkte
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
    }
  }
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers['authorization']
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Nicht authentifiziert' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' })
  }
}

// ─── requireAdmin ─────────────────────────────────────────────────────────────
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Keine Berechtigung' })
    return
  }
  next()
}

// ─── requirePageAccess ────────────────────────────────────────────────────────
// Sperrt schreibende Operationen (POST/PUT/PATCH/DELETE) auf gesperrten Bereichen.
// GET-Anfragen sind immer erlaubt, da Referenzdaten (z.B. Mitgliedernamen)
// bereichsübergreifend benötigt werden (Dashboard, Sprints, Rotation etc.).
// Admins haben immer Vollzugriff.
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requirePageAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user
  if (!user) {
    res.status(401).json({ error: 'Nicht authentifiziert' })
    return
  }
  if (user.role === 'admin' || user.forbiddenPages.length === 0) {
    next()
    return
  }

  // Lesezugriff (GET, HEAD, OPTIONS) ist immer erlaubt
  if (!WRITE_METHODS.has(req.method)) {
    next()
    return
  }

  const requestedPath = req.baseUrl + req.path

  for (const page of user.forbiddenPages) {
    const prefixes = PAGE_TO_API[page] ?? []
    for (const prefix of prefixes) {
      if (requestedPath.startsWith(prefix)) {
        res.status(403).json({ error: `Kein Zugriff auf Bereich "${page}"` })
        return
      }
    }
  }

  next()
}
