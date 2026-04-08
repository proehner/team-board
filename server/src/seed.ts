import { dbGet, dbAll, dbRun } from './db'
import crypto from 'crypto'

const uid = () => crypto.randomUUID()

const AVATAR_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

const DEFAULT_RESPONSIBILITY_TYPES = [
  { name: 'Support-Dienst',   color: '#6366f1', sortOrder: 0 },
  { name: 'Code-Review-Lead', color: '#10b981', sortOrder: 1 },
  { name: 'Release-Manager',  color: '#f59e0b', sortOrder: 2 },
  { name: 'Incident-Manager', color: '#ef4444', sortOrder: 3 },
  { name: 'Demo-Moderator',   color: '#8b5cf6', sortOrder: 4 },
  { name: 'Onboarding-Buddy', color: '#14b8a6', sortOrder: 5 },
]

export function seedResponsibilityTypes(): void {
  const existing = dbAll<{ name: string }>('SELECT name FROM responsibility_types')
  const existingNames = new Set(existing.map((r) => r.name))
  for (const t of DEFAULT_RESPONSIBILITY_TYPES) {
    if (!existingNames.has(t.name)) {
      dbRun('INSERT INTO responsibility_types (id, name, color, sortOrder) VALUES (?, ?, ?, ?)',
        [uid(), t.name, t.color, t.sortOrder])
    }
  }
}

export function seedIfEmpty(): void {
  const row = dbGet<{ n: number }>('SELECT COUNT(*) as n FROM members')
  if ((row?.n ?? 0) > 0) return

  console.log('Database empty – inserting seed data…')

  const today = new Date()
  const sprintStart = new Date(today); sprintStart.setDate(today.getDate() - 5)
  const sprintEnd   = new Date(sprintStart); sprintEnd.setDate(sprintStart.getDate() + 13)
  const prevStart   = new Date(sprintStart); prevStart.setDate(sprintStart.getDate() - 14)
  const prevEnd     = new Date(sprintStart); prevEnd.setDate(sprintStart.getDate() - 1)

  // ─── Members ──────────────────────────────────────────────────────────────
  const memberData = [
    { name: 'Anna Müller',   email: 'anna.mueller@team.de',   roles: ['Senior Developer'], color: AVATAR_COLORS[0], joined: '2022-03-15' },
    { name: 'Max Berger',    email: 'max.berger@team.de',     roles: ['Developer'],        color: AVATAR_COLORS[2], joined: '2023-01-10' },
    { name: 'Thomas Schulz', email: 'thomas.schulz@team.de', roles: ['DevOps Engineer'],  color: AVATAR_COLORS[1], joined: '2021-07-01' },
    { name: 'Sarah Koch',    email: 'sarah.koch@team.de',     roles: ['QA Engineer'],      color: AVATAR_COLORS[3], joined: '2022-09-20' },
    { name: 'David Fischer', email: 'david.fischer@team.de', roles: ['Developer'],        color: AVATAR_COLORS[4], joined: '2023-06-05' },
  ]
  const memberIds = memberData.map((m) => {
    const id = uid()
    dbRun('INSERT INTO members (id, name, email, role, avatarColor, joinedAt, isActive) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, m.name, m.email, JSON.stringify(m.roles), m.color, m.joined])
    return id
  })

  // ─── Skills ───────────────────────────────────────────────────────────────
  const skillData = [
    { name: 'React',          cats: ['Frontend'],    desc: 'React-Bibliothek inkl. Hooks und modernes Ökosystem' },
    { name: 'TypeScript',     cats: ['Frontend'],    desc: 'Typisiertes JavaScript' },
    { name: 'Node.js',        cats: ['Backend'],     desc: 'Server-seitige JavaScript-Entwicklung' },
    { name: 'PostgreSQL',     cats: ['Datenbank'],   desc: 'Relationale Datenbankentwicklung' },
    { name: 'Docker',         cats: ['DevOps'],      desc: 'Containerisierung von Anwendungen' },
    { name: 'Kubernetes',     cats: ['DevOps'],      desc: 'Container-Orchestrierung' },
    { name: 'Jest / Testing', cats: ['Testing'],     desc: 'Unit- und Integrationstests' },
    { name: 'Cypress',        cats: ['Testing'],     desc: 'End-to-End-Tests im Browser' },
    { name: 'Kommunikation',  cats: ['Soft Skills'], desc: 'Klare und effektive Kommunikation im Team' },
    { name: 'Agile / Scrum',  cats: ['Soft Skills'], desc: 'Kenntnisse in agilen Methoden' },
  ]
  const skillIds = skillData.map((sk) => {
    const id = uid()
    dbRun('INSERT INTO skills (id, name, category, description) VALUES (?, ?, ?, ?)', [id, sk.name, JSON.stringify(sk.cats), sk.desc])
    return id
  })

  // ─── Member skills ─────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const msData: [number, number, number][] = [
    [0,0,5],[0,1,5],[0,2,3],[0,6,4],[0,8,4],[0,9,4],
    [1,0,3],[1,1,4],[1,2,5],[1,3,4],[1,6,3],
    [2,4,5],[2,5,4],[2,2,3],[2,3,3],[2,9,3],
    [3,6,5],[3,7,5],[3,0,2],[3,8,5],[3,9,4],
    [4,0,3],[4,1,3],[4,2,2],[4,3,2],[4,6,2],
  ]
  for (const [mi, si, lv] of msData) {
    dbRun('INSERT OR REPLACE INTO member_skills (memberId, skillId, level, updatedAt) VALUES (?, ?, ?, ?)',
      [memberIds[mi], skillIds[si], lv, now])
  }

  // ─── Sprint ────────────────────────────────────────────────────────────────
  const sprintId = uid()
  dbRun(
    'INSERT INTO sprints (id, name, goal, startDate, endDate, status, plannedPoints, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [sprintId, 'Sprint 1', 'Grundlegende Authentifizierung und Dashboard-MVP implementieren',
     fmt(sprintStart), fmt(sprintEnd), 'Aktiv', 65,
     'Fokus auf stabile Infrastruktur und erste sichtbare Features.', new Date().toISOString()],
  )
  const capData: [number, number][] = [[8,18],[7,15],[9,14],[8,10],[6,8]]
  memberIds.forEach((mid, i) => {
    dbRun('INSERT INTO sprint_capacity (sprintId, memberId, availableDays, plannedPoints) VALUES (?, ?, ?, ?)',
      [sprintId, mid, capData[i][0], capData[i][1]])
  })

  // ─── Assignments ───────────────────────────────────────────────────────────
  const aData: [string, number, string, string][] = [
    ['Support-Dienst',   0, fmt(sprintStart), fmt(sprintEnd)],
    ['Code-Review-Lead', 2, fmt(sprintStart), fmt(sprintEnd)],
    ['Demo-Moderator',   1, fmt(sprintStart), fmt(sprintEnd)],
    ['Support-Dienst',   3, fmt(prevStart),   fmt(prevEnd)],
    ['Code-Review-Lead', 4, fmt(prevStart),   fmt(prevEnd)],
    ['Demo-Moderator',   0, fmt(prevStart),   fmt(prevEnd)],
  ]
  for (const [type, mi, s, e] of aData) {
    dbRun('INSERT INTO assignments (id, type, memberId, sprintId, startDate, endDate, notes, isAutoSuggested) VALUES (?, ?, ?, NULL, ?, ?, ?, 0)',
      [uid(), type, memberIds[mi], s, e, ''])
  }

  // ─── Retrospective ─────────────────────────────────────────────────────────
  const retroId = uid()
  dbRun(
    'INSERT INTO retrospectives (id, sprintId, title, date, facilitatorId, isFinalized, createdAt) VALUES (?, NULL, ?, ?, ?, 1, ?)',
    [retroId, 'Sprint 0 Retrospektive', fmt(prevEnd), memberIds[0], new Date().toISOString()],
  )
  const items: [string, string, number][] = [
    ['GutGelaufen', 'Tägliche Stand-ups waren fokussiert und effizient', 3],
    ['GutGelaufen', 'Code-Reviews wurden zeitnah durchgeführt', 2],
    ['GutGelaufen', 'Gute Zusammenarbeit zwischen Frontend und Backend', 4],
    ['Verbesserung', 'Tickets hatten manchmal unklare Akzeptanzkriterien', 5],
    ['Verbesserung', 'Zu viele Unterbrechungen während der Fokuszeit', 3],
    ['Aktionspunkt', 'Definition of Ready für alle Tickets vor Sprint-Start prüfen', 0],
    ['Aktionspunkt', 'Fokuszeiten im Team-Kalender blockieren (09:00–12:00)', 0],
  ]
  for (const [type, text, votes] of items) {
    const iid = uid()
    const assignee = type === 'Aktionspunkt' ? memberIds[0] : null
    dbRun('INSERT INTO retro_items (id, retroId, type, text, votes, assigneeId, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [iid, retroId, type, text, votes, assignee, 'Offen'])
  }

  console.log('Seed data inserted successfully.')
}
