import { Database } from 'node-sqlite3-wasm'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

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
  CREATE TABLE IF NOT EXISTS teams (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    avatarColor TEXT NOT NULL,
    joinedAt    TEXT NOT NULL,
    isActive    INTEGER NOT NULL DEFAULT 1,
    teamId      TEXT
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
    createdAt     TEXT NOT NULL,
    teamId        TEXT
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
    isSynthetic     INTEGER NOT NULL DEFAULT 0,
    teamId          TEXT
  );

  CREATE TABLE IF NOT EXISTS responsibility_types (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    teamId    TEXT,
    color     TEXT NOT NULL DEFAULT '#6366f1',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    UNIQUE(name, teamId)
  );

  CREATE TABLE IF NOT EXISTS retrospectives (
    id            TEXT PRIMARY KEY,
    sprintId      TEXT,
    title         TEXT NOT NULL,
    date          TEXT NOT NULL,
    facilitatorId TEXT,
    isFinalized   INTEGER NOT NULL DEFAULT 0,
    createdAt     TEXT NOT NULL,
    teamId        TEXT
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
    closedAt  TEXT,
    teamId    TEXT
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

  CREATE TABLE IF NOT EXISTS roadmap_features (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL DEFAULT '',
    status             TEXT NOT NULL DEFAULT 'idea',
    priority           TEXT NOT NULL DEFAULT 'medium',
    targetVersion      TEXT,
    targetYear         INTEGER,
    targetQuarter      INTEGER,
    category           TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    goals              TEXT NOT NULL DEFAULT '',
    acceptanceCriteria TEXT NOT NULL DEFAULT '',
    uiNotes            TEXT NOT NULL DEFAULT '',
    backendNotes       TEXT NOT NULL DEFAULT '',
    technicalNotes     TEXT NOT NULL DEFAULT '',
    risks              TEXT NOT NULL DEFAULT '',
    createdAt          TEXT NOT NULL,
    updatedAt          TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roadmap_tickets (
    id                 TEXT PRIMARY KEY,
    featureId          TEXT NOT NULL,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL DEFAULT '',
    acceptanceCriteria TEXT NOT NULL DEFAULT '',
    type               TEXT NOT NULL DEFAULT 'task',
    area               TEXT NOT NULL DEFAULT 'other',
    storyPoints        INTEGER,
    priority           TEXT NOT NULL DEFAULT 'medium',
    assignedTeam       TEXT,
    tags               TEXT NOT NULL DEFAULT '[]',
    sortOrder          INTEGER NOT NULL DEFAULT 0,
    createdAt          TEXT NOT NULL,
    updatedAt          TEXT NOT NULL,
    FOREIGN KEY (featureId) REFERENCES roadmap_features(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS roadmap_endpoints (
    id           TEXT PRIMARY KEY,
    featureId    TEXT NOT NULL,
    method       TEXT NOT NULL DEFAULT 'GET',
    path         TEXT NOT NULL DEFAULT '',
    title        TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    requestBody  TEXT NOT NULL DEFAULT '',
    responseBody TEXT NOT NULL DEFAULT '',
    authRequired INTEGER NOT NULL DEFAULT 1,
    complexity   TEXT NOT NULL DEFAULT 'm',
    notes        TEXT NOT NULL DEFAULT '',
    sortOrder    INTEGER NOT NULL DEFAULT 0,
    createdAt    TEXT NOT NULL,
    updatedAt    TEXT NOT NULL,
    FOREIGN KEY (featureId) REFERENCES roadmap_features(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS roadmap_screens (
    id             TEXT PRIMARY KEY,
    featureId      TEXT NOT NULL,
    title          TEXT NOT NULL DEFAULT '',
    route          TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    components     TEXT NOT NULL DEFAULT '[]',
    endpointIds    TEXT NOT NULL DEFAULT '[]',
    wireframeNotes TEXT NOT NULL DEFAULT '',
    sortOrder      INTEGER NOT NULL DEFAULT 0,
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL,
    FOREIGN KEY (featureId) REFERENCES roadmap_features(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS known_error_attachments (
    id           TEXT PRIMARY KEY,
    knownErrorId TEXT NOT NULL,
    filename     TEXT NOT NULL,
    originalName TEXT NOT NULL,
    mimeType     TEXT NOT NULL,
    size         INTEGER NOT NULL,
    uploadedAt   TEXT NOT NULL,
    FOREIGN KEY (knownErrorId) REFERENCES known_errors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS known_error_comments (
    id           TEXT PRIMARY KEY,
    knownErrorId TEXT NOT NULL,
    content      TEXT NOT NULL,
    authorName   TEXT NOT NULL DEFAULT '',
    createdAt    TEXT NOT NULL,
    FOREIGN KEY (knownErrorId) REFERENCES known_errors(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    recurrence  TEXT NOT NULL DEFAULT 'weekly',
    dayOfWeek   INTEGER,
    meetingTime TEXT,
    location    TEXT,
    teamId      TEXT,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meeting_topics (
    id          TEXT PRIMARY KEY,
    meetingId   TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'open',
    sortOrder   INTEGER NOT NULL DEFAULT 0,
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL,
    closedAt    TEXT,
    FOREIGN KEY (meetingId) REFERENCES meetings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS topic_comments (
    id          TEXT PRIMARY KEY,
    topicId     TEXT NOT NULL,
    content     TEXT NOT NULL,
    authorName  TEXT NOT NULL DEFAULT '',
    createdAt   TEXT NOT NULL,
    FOREIGN KEY (topicId) REFERENCES meeting_topics(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS topic_attachments (
    id           TEXT PRIMARY KEY,
    topicId      TEXT NOT NULL,
    filename     TEXT NOT NULL,
    originalName TEXT NOT NULL,
    mimeType     TEXT NOT NULL,
    size         INTEGER NOT NULL,
    uploadedAt   TEXT NOT NULL,
    FOREIGN KEY (topicId) REFERENCES meeting_topics(id) ON DELETE CASCADE
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
// ─── Sprint metric columns ────────────────────────────────────────────────────
const sprintCols = db.prepare('PRAGMA table_info(sprints)').all([]) as Array<{ name: string }>
const sprintColNames = new Set(sprintCols.map((c) => c.name))
if (!sprintColNames.has('goalMet'))          db.exec('ALTER TABLE sprints ADD COLUMN goalMet TEXT')
if (!sprintColNames.has('completedItems'))   db.exec('ALTER TABLE sprints ADD COLUMN completedItems INTEGER')
if (!sprintColNames.has('plannedItems'))     db.exec('ALTER TABLE sprints ADD COLUMN plannedItems INTEGER')
if (!sprintColNames.has('teamSatisfaction')) db.exec('ALTER TABLE sprints ADD COLUMN teamSatisfaction INTEGER')
if (!sprintColNames.has('impediments'))      db.exec("ALTER TABLE sprints ADD COLUMN impediments TEXT NOT NULL DEFAULT ''")
if (!sprintColNames.has('capacityHours'))    db.exec('ALTER TABLE sprints ADD COLUMN capacityHours INTEGER')
if (!sprintColNames.has('remainingHours'))   db.exec('ALTER TABLE sprints ADD COLUMN remainingHours INTEGER')
if (!sprintColNames.has('averageBurndown'))  db.exec('ALTER TABLE sprints ADD COLUMN averageBurndown REAL')

// ─── Retro Items migration ────────────────────────────────────────────────────
const retroItemCols = db.prepare('PRAGMA table_info(retro_items)').all([]) as Array<{ name: string }>
if (retroItemCols.length > 0 && !retroItemCols.some((c) => c.name === 'ticketUrl')) {
  db.exec('ALTER TABLE retro_items ADD COLUMN ticketUrl TEXT')
}

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

// ─── Multi-team migration ─────────────────────────────────────────────────────
// Add teamId columns to existing tables (idempotent)
const memberCols  = db.prepare('PRAGMA table_info(members)').all([])  as Array<{ name: string }>
const sprintCols2 = db.prepare('PRAGMA table_info(sprints)').all([])  as Array<{ name: string }>
const assignCols2 = db.prepare('PRAGMA table_info(assignments)').all([]) as Array<{ name: string }>
const retroCols   = db.prepare('PRAGMA table_info(retrospectives)').all([]) as Array<{ name: string }>
const pulseCols   = db.prepare('PRAGMA table_info(pulse_checks)').all([])  as Array<{ name: string }>

if (!memberCols.some((c) => c.name === 'teamId'))  db.exec('ALTER TABLE members ADD COLUMN teamId TEXT')
if (!sprintCols2.some((c) => c.name === 'teamId')) db.exec('ALTER TABLE sprints ADD COLUMN teamId TEXT')
if (!assignCols2.some((c) => c.name === 'teamId')) db.exec('ALTER TABLE assignments ADD COLUMN teamId TEXT')
if (!retroCols.some((c) => c.name === 'teamId'))   db.exec('ALTER TABLE retrospectives ADD COLUMN teamId TEXT')
if (!pulseCols.some((c) => c.name === 'teamId'))   db.exec('ALTER TABLE pulse_checks ADD COLUMN teamId TEXT')

// ─── responsibility_types: migrate to UNIQUE(name, teamId) ───────────────────
// The old schema had UNIQUE(name) which prevents multiple teams having the same
// type name. We recreate the table without the global UNIQUE(name) constraint.
const rtColsCheck = db.prepare('PRAGMA table_info(responsibility_types)').all([]) as Array<{ name: string }>
if (!rtColsCheck.some((c) => c.name === 'teamId')) {
  db.exec(`
    CREATE TABLE responsibility_types_new (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      teamId    TEXT,
      color     TEXT NOT NULL DEFAULT '#6366f1',
      sortOrder INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO responsibility_types_new (id, name, teamId, color, sortOrder)
      SELECT id, name, NULL, color, sortOrder FROM responsibility_types;
    DROP TABLE responsibility_types;
    ALTER TABLE responsibility_types_new RENAME TO responsibility_types;
  `)
}

// ─── meetings: add isGlobal column ───────────────────────────────────────────
const meetingCols = db.prepare('PRAGMA table_info(meetings)').all([]) as Array<{ name: string }>
if (!meetingCols.some((c) => c.name === 'isGlobal')) {
  db.exec('ALTER TABLE meetings ADD COLUMN isGlobal INTEGER NOT NULL DEFAULT 0')
}

// ─── meeting_topics: add assigneeIds column (may be missing on older DBs) ────
const topicCols = db.prepare('PRAGMA table_info(meeting_topics)').all([]) as Array<{ name: string }>
if (!topicCols.some((c) => c.name === 'assigneeIds')) {
  db.exec("ALTER TABLE meeting_topics ADD COLUMN assigneeIds TEXT NOT NULL DEFAULT '[]'")
}

// ─── Assign existing data to the default team if no team exists yet ──────────
// This ensures that databases upgraded from single-team mode keep all their data.
const teamCount = (db.prepare('SELECT COUNT(*) as n FROM teams').get([]) as { n: number }).n
if (teamCount === 0) {
  const defaultTeamId = crypto.randomUUID()
  db.prepare('INSERT INTO teams (id, name, description, createdAt) VALUES (?, ?, ?, ?)').run([
    defaultTeamId, 'Team', 'Standard-Team (automatisch migriert)', new Date().toISOString(),
  ])
  db.prepare('UPDATE members  SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  db.prepare('UPDATE sprints  SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  db.prepare('UPDATE assignments SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  db.prepare('UPDATE retrospectives SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  db.prepare('UPDATE pulse_checks SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  db.prepare('UPDATE responsibility_types SET teamId = ? WHERE teamId IS NULL').run([defaultTeamId])
  console.info(`Multi-team migration: existing data assigned to default team "${defaultTeamId}"`)
}

// ─── meeting_topics migration: add assigneeIds ────────────────────────────────
const meetingTopicCols = db.prepare('PRAGMA table_info(meeting_topics)').all([]) as Array<{ name: string }>
if (meetingTopicCols.length > 0 && !meetingTopicCols.some((c) => c.name === 'assigneeIds')) {
  db.exec("ALTER TABLE meeting_topics ADD COLUMN assigneeIds TEXT NOT NULL DEFAULT '[]'")
}

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
