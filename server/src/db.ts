import { Database } from 'node-sqlite3-wasm'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'teamlead.db')

// Remove stale lock directory (created on hard process termination)
const lockDir = `${DB_PATH}.lock`
if (fs.existsSync(lockDir)) {
  fs.rmSync(lockDir, { recursive: true, force: true })
  console.warn(`Stale DB lock cleaned up: ${lockDir}`)
}

// Create a backup of the database (if it exists)
if (fs.existsSync(DB_PATH)) {
  // Remove backups older than 30 days
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000
  const backupPrefix = path.basename(DB_PATH) + '.backup-'
  const dir = path.dirname(DB_PATH)
  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith(backupPrefix)) continue
    const ts = parseInt(file.slice(backupPrefix.length), 10)
    if (!isNaN(ts) && Date.now() - ts > maxAgeMs) {
      fs.unlinkSync(path.join(dir, file))
      console.info(`Old database backup removed: ${file}`)
    }
  }

  const backupPath = `${DB_PATH}.backup-${Date.now()}`
  fs.copyFileSync(DB_PATH, backupPath)
  console.info(`Database backup created: ${backupPath}`)
}

let db: InstanceType<typeof Database>
try {
  db = new Database(DB_PATH)
} catch (err) {
  console.error(`Could not open database file: ${DB_PATH}`)
  throw err
}

// node-sqlite3-wasm (WASM-based) does not reliably support WAL on Windows.
// DELETE journal mode (default) is sufficient for this application.
db.exec(`PRAGMA foreign_keys = ON`)

try {
  db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    avatarColor TEXT NOT NULL,
    joinedAt    TEXT NOT NULL,
    isActive    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS member_skills (
    memberId  TEXT NOT NULL,
    skillId   TEXT NOT NULL,
    level     INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL,
    notes     TEXT,
    PRIMARY KEY (memberId, skillId),
    FOREIGN KEY (memberId) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (skillId)  REFERENCES skills(id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sprints (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    goal          TEXT NOT NULL DEFAULT '',
    startDate     TEXT NOT NULL,
    endDate       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'Geplant',
    velocity      INTEGER,
    plannedPoints INTEGER NOT NULL DEFAULT 0,
    notes         TEXT NOT NULL DEFAULT '',
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sprint_capacity (
    sprintId      TEXT NOT NULL,
    memberId      TEXT NOT NULL,
    availableDays INTEGER NOT NULL DEFAULT 0,
    plannedPoints INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sprintId, memberId),
    FOREIGN KEY (sprintId) REFERENCES sprints(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,
    memberId        TEXT NOT NULL,
    sprintId        TEXT,
    startDate       TEXT NOT NULL,
    endDate         TEXT NOT NULL,
    notes           TEXT NOT NULL DEFAULT '',
    isAutoSuggested INTEGER NOT NULL DEFAULT 0,
    isSynthetic     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS responsibility_types (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE,
    color     TEXT NOT NULL DEFAULT '#6366f1',
    sortOrder INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS retrospectives (
    id            TEXT PRIMARY KEY,
    sprintId      TEXT,
    title         TEXT NOT NULL,
    date          TEXT NOT NULL,
    facilitatorId TEXT,
    isFinalized   INTEGER NOT NULL DEFAULT 0,
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS retro_items (
    id         TEXT PRIMARY KEY,
    retroId    TEXT NOT NULL,
    type       TEXT NOT NULL,
    text       TEXT NOT NULL,
    votes      INTEGER NOT NULL DEFAULT 0,
    assigneeId TEXT,
    status     TEXT NOT NULL DEFAULT 'Offen',
    dueDate    TEXT,
    FOREIGN KEY (retroId) REFERENCES retrospectives(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pulse_checks (
    id        TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    questions TEXT NOT NULL,
    sprintId  TEXT,
    createdAt TEXT NOT NULL,
    closedAt  TEXT
  );

  CREATE TABLE IF NOT EXISTS pulse_responses (
    id          TEXT PRIMARY KEY,
    checkId     TEXT NOT NULL,
    ratings     TEXT NOT NULL,
    submittedAt TEXT NOT NULL,
    FOREIGN KEY (checkId) REFERENCES pulse_checks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    username       TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    display_name   TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'user',
    forbidden_pages TEXT NOT NULL DEFAULT '[]',
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS software (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    vendor      TEXT,
    version     TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS known_errors (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    ticketNumber TEXT,
    description  TEXT NOT NULL DEFAULT '',
    solution     TEXT NOT NULL DEFAULT '',
    workaround   TEXT,
    severity     TEXT NOT NULL DEFAULT 'medium',
    status       TEXT NOT NULL DEFAULT 'open',
    softwareIds  TEXT NOT NULL DEFAULT '[]',
    tags         TEXT NOT NULL DEFAULT '[]',
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL
  );
`)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('locked')) {
    console.error(
      '\n❌  ERROR: The database is locked.\n' +
      '   Another server process is likely already running.\n' +
      '   Solution: Stop all running Node processes and then restart.\n' +
      '   Windows: taskkill /F /IM node.exe\n',
    )
  }
  throw err
}

// ─── Migrations (existing databases) ─────────────────────────────────────────
// ─── Known Errors migration ───────────────────────────────────────────────────
const knownErrorCols = db.prepare('PRAGMA table_info(known_errors)').all([]) as Array<{ name: string }>
if (knownErrorCols.length > 0 && !knownErrorCols.some((c) => c.name === 'ticketNumber')) {
  db.exec('ALTER TABLE known_errors ADD COLUMN ticketNumber TEXT')
}

const assignmentCols = db.prepare('PRAGMA table_info(assignments)').all([]) as Array<{ name: string }>
if (!assignmentCols.some((c) => c.name === 'isSynthetic')) {
  db.exec('ALTER TABLE assignments ADD COLUMN isSynthetic INTEGER NOT NULL DEFAULT 0')
}
if (!assignmentCols.some((c) => c.name === 'isArchived')) {
  db.exec('ALTER TABLE assignments ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0')
}

// Migrate members.role and skills.category to JSON arrays (idempotent)
db.exec("UPDATE members SET role = json_array(role) WHERE role NOT LIKE '[%'")
db.exec("UPDATE skills SET category = json_array(category) WHERE category NOT LIKE '[%'")

export default db

// ─── Typed query helpers ──────────────────────────────────────────────────────
// node-sqlite3-wasm uses array params: stmt.run([a, b, c])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BindValues = any[]

export function dbGet<T = Record<string, unknown>>(sql: string, params: BindValues = []): T | undefined {
  return db.prepare(sql).get(params) as T | undefined
}

export function dbAll<T = Record<string, unknown>>(sql: string, params: BindValues = []): T[] {
  return db.prepare(sql).all(params) as T[]
}

export function dbRun(sql: string, params: BindValues = []): { changes: number; lastInsertRowid: number } {
  return db.prepare(sql).run(params) as { changes: number; lastInsertRowid: number }
}
