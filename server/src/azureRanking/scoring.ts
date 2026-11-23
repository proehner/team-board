import type { Badge, DevStats, Ev, EventStore, IdentityInfo, Level, PeriodData, StoredEvent } from './types'
import { buildAliasMap } from './identities'

// ─── Scoring model ────────────────────────────────────────────────────────────
//
// Goals: count only real contributions, credit the right person, and make the
// score hard to inflate with volume that carries little value.
//
//  • Work items count once — when they actually move into a "Completed" state,
//    credited to the assignee at that moment. Later edits (board moves, tags…)
//    never count again.
//  • Backlog items (PBI/Bug) weigh more than tasks, so teams that slice work into
//    many small tasks don't get an advantage. Features/Epics/test artefacts are
//    organisational containers and don't count as completed work.
//  • Reviewing a PR (vote or comment) is valued close to authoring one. Review depth
//    counts: every new review thread (a finding) earns points, replies in the
//    discussion a little. Acknowledgements ("ok", "done", "LGTM") and very short comments
//    don't count; findings
//    and replies are capped per PR so that volume alone can't dominate.
//  • Backports — the same change merged into further branches (same author, repo and
//    title, other target branch, within PORT_WINDOW_DAYS) — count as a small extra,
//    not as a new PR.
//  • Created tickets are capped per day, ticket comments count once per ticket and day.
//  • Bots, service accounts and team groups are excluded; accounts with the same
//    display name are merged.
//
// Bump SCORING_VERSION whenever the model changes — cache and history are then
// recomputed from the stored events automatically.

export const SCORING_VERSION = 4

// Weights calibrated on one year of real data so that the four areas contribute
// roughly: writing code ~1/3, reviewing ~1/3, delivering work items ~1/5, tickets &
// discussion ~1/7 of all points.
export const SCORING = {
  prCreated:            5,
  prCompleted:         20,
  prPorted:             5,
  prReviewed:           6,
  prApproved:           2,
  prComment:            3,
  prReply:              1,
  backlogItemCompleted: 15,
  taskCompleted:        5,
  ticketCreated:        5,
  taskCreated:          1,
  ticketComment:        3,
} as const

export const LIMITS = {
  /** New review threads (findings) per reviewer and PR that count */
  prCommentsPerPr: 25,
  /** Replies in review discussions per reviewer and PR that count */
  prRepliesPerPr:  10,
  /** Review comments need at least this many characters of own text (acknowledgements never count) */
  minCommentLength: 10,
  /** A PR with the same title as an earlier PR (other target branch) within this many days is a backport */
  portWindowDays: 60,
  /** Created tickets (PBI/Bug/Feature/…) per person and day that count */
  ticketsPerDay:  10,
  /** Created tasks / test cases per person and day that count */
  tasksPerDay:    10,
} as const

/** Metric field on DevStats → scoring key */
export const METRIC_SCORING: Record<string, keyof typeof SCORING> = {
  prsCreated:            'prCreated',
  prsCompleted:          'prCompleted',
  prsPorted:             'prPorted',
  prsReviewed:           'prReviewed',
  approvalsGiven:        'prApproved',
  commentsGiven:         'prComment',
  commentReplies:        'prReply',
  backlogItemsCompleted: 'backlogItemCompleted',
  tasksCompleted:        'taskCompleted',
  ticketsCreated:        'ticketCreated',
  tasksCreated:          'taskCreated',
  ticketComments:        'ticketComment',
}

export const BACKLOG_TYPES = new Set(['Product Backlog Item', 'Bug', 'User Story', 'Requirement', 'Issue'])
export const TASK_TYPES    = new Set(['Task'])
const TICKET_CREATE_TYPES  = new Set([...BACKLOG_TYPES, 'Feature', 'Epic', 'Impediment'])
const TASK_CREATE_TYPES    = new Set(['Task', 'Test Case'])

/** Work item types whose completion counts */
export const COUNTED_COMPLETION_TYPES = new Set([...BACKLOG_TYPES, ...TASK_TYPES])

// ─── Levels & badges ──────────────────────────────────────────────────────────

// Thresholds per period [Diamond, Platinum, Gold, Silver, Bronze], calibrated on rolling
// windows over one year of real data (active developers): Diamond ≈ top 5 %,
// Platinum ≈ top 20 %, Gold ≈ upper half, Silver ≈ regular contributor.
const PERIOD_THRESHOLDS: Record<number, readonly [number, number, number, number, number]> = {
  7:   [470,   280,   150,  60,   0],
  30:  [1600,  1000,  600,  250,  0],
  90:  [4600,  2800,  1700, 700,  0],
  365: [18500, 10500, 6000, 2500, 0],
}

const LEVEL_DEFS = [
  { name: 'Diamond',  icon: '💎', color: '#00BFFF' },
  { name: 'Platinum', icon: '🏆', color: '#E5E4E2' },
  { name: 'Gold',     icon: '🥇', color: '#FFD700' },
  { name: 'Silver',   icon: '🥈', color: '#C0C0C0' },
  { name: 'Bronze',   icon: '🥉', color: '#CD7F32' },
] as const

export function getLevel(points: number, days = 365): Level {
  const thr = PERIOD_THRESHOLDS[days] ?? PERIOD_THRESHOLDS[365]
  for (let i = 0; i < LEVEL_DEFS.length; i++) {
    if (points >= thr[i]) {
      return { ...LEVEL_DEFS[i], min: thr[i], next: i > 0 ? thr[i - 1] : null }
    }
  }
  return { ...LEVEL_DEFS[4], min: 0, next: thr[3] }
}

export function buildLevelsForPeriod(days: number): PeriodData['levels'] {
  const thr = PERIOD_THRESHOLDS[days] ?? PERIOD_THRESHOLDS[365]
  return [...LEVEL_DEFS].reverse().map((def, i) => {
    const idx = LEVEL_DEFS.length - 1 - i
    return { name: def.name, icon: def.icon, color: def.color, min: thr[idx], max: idx > 0 ? thr[idx - 1] - 1 : null }
  })
}

type Counts = Pick<DevStats,
  'prsCreated' | 'prsCompleted' | 'prsPorted' | 'prsReviewed' | 'approvalsGiven' | 'commentsGiven' | 'commentReplies' |
  'workItemsCompleted' | 'backlogItemsCompleted' | 'tasksCompleted' | 'ticketsCreated' | 'tasksCreated' | 'ticketComments'>

interface BadgeDef extends Badge { cond: (s: Counts) => boolean }

const BADGES: BadgeDef[] = [
  { id: 'first_pr',       name: 'First Step',      icon: '🎯', desc: 'Created first PR',               cond: (s) => s.prsCreated >= 1 },
  { id: 'pr_creator',     name: 'PR Creator',      icon: '🔀', desc: '5+ PRs created',                 cond: (s) => s.prsCreated >= 5 },
  { id: 'pr_machine',     name: 'PR Machine',      icon: '⚡', desc: '20+ PRs created',                cond: (s) => s.prsCreated >= 20 },
  { id: 'merger',         name: 'Merger',          icon: '🎊', desc: '10+ PRs merged',                 cond: (s) => s.prsCompleted >= 10 },
  { id: 'reviewer',       name: 'Code Reviewer',   icon: '🔍', desc: '10+ PRs reviewed',               cond: (s) => s.prsReviewed >= 10 },
  { id: 'senior_rev',     name: 'Senior Reviewer', icon: '👁️', desc: '40+ PRs reviewed',               cond: (s) => s.prsReviewed >= 40 },
  { id: 'approver',       name: 'Approver',        icon: '✅', desc: '10+ PRs approved',               cond: (s) => s.approvalsGiven >= 10 },
  { id: 'worker',         name: 'Work Horse',      icon: '🐴', desc: '10+ work items completed',       cond: (s) => s.workItemsCompleted >= 10 },
  { id: 'powerworker',    name: 'Power Worker',    icon: '💪', desc: '30+ work items completed',       cond: (s) => s.workItemsCompleted >= 30 },
  { id: 'ticket_starter', name: 'Ticket Creator',  icon: '📝', desc: '5+ tickets created',             cond: (s) => s.ticketsCreated >= 5 },
  { id: 'ticket_master',  name: 'Ticket Master',   icon: '🎫', desc: '20+ tickets created',            cond: (s) => s.ticketsCreated >= 20 },
  { id: 'commentator',    name: 'Commentator',     icon: '💡', desc: '20+ ticket discussions',         cond: (s) => s.ticketComments >= 20 },
  { id: 'disc_king',      name: 'Discussion King', icon: '🗣️', desc: '50+ ticket discussions',         cond: (s) => s.ticketComments >= 50 },
  { id: 'all_rounder',    name: 'All-Rounder',     icon: '🌟', desc: 'Authored, reviewed and completed work', cond: (s) => s.prsCreated > 0 && s.prsReviewed > 0 && s.workItemsCompleted > 0 },
]

// ─── Event preparation ────────────────────────────────────────────────────────

export interface PreparedEvents {
  events:     Ev[]
  identities: Record<string, IdentityInfo>
  storeStart: number
}

const toEv = ([k, u, t, ref, x]: StoredEvent): Ev => ({ k, u, t, ref, x })

/**
 * PR ids that are backports: the same author already opened a (not abandoned) PR with the same
 * normalised title in the same repository for another target branch within the port window.
 */
export function findPorts(store: EventStore, alias: Map<string, string> = new Map()): Set<string> {
  const groups = new Map<string, { id: string; t: number; b: string }[]>()
  for (const [id, pr] of Object.entries(store.prs)) {
    if (!pr.t || !pr.b || pr.s === 'abandoned') continue
    const created = pr.e.find((e) => e[0] === 'prCreated')
    if (!created) continue
    const author = alias.get(created[1]) ?? created[1]
    const key = `${author}|${pr.repo}|${pr.t}`
    const list = groups.get(key) ?? []
    list.push({ id, t: created[2], b: pr.b })
    groups.set(key, list)
  }
  const window = LIMITS.portWindowDays * DAY
  const ports = new Set<string>()
  for (const list of groups.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => a.t - b.t)
    list.forEach((p, i) => {
      if (list.slice(0, i).some((o) => o.b !== p.b && p.t - o.t <= window)) ports.add(p.id)
    })
  }
  return ports
}

/** Flattens the store, drops bots, merges aliases, marks backports and sorts chronologically. */
export function prepareEvents(store: EventStore): PreparedEvents {
  const raw: Ev[] = []
  for (const e of Object.values(store.wi)) raw.push(toEv(e))
  for (const pr of Object.values(store.prs)) for (const e of pr.e) raw.push(toEv(e))

  const activity = new Map<string, number>()
  for (const e of raw) activity.set(e.u, (activity.get(e.u) || 0) + 1)
  const alias = buildAliasMap(store.identities, activity)

  // Backports: no "PR created" points, completion counts as "backport" instead of "PR merged"
  const ports = findPorts(store, alias)
  for (let i = raw.length - 1; i >= 0; i--) {
    const e = raw[i]
    if (!ports.has(e.ref) || (e.k !== 'prCreated' && e.k !== 'prCompleted')) continue
    if (e.k === 'prCreated') raw.splice(i, 1)
    else raw[i] = { ...e, k: 'prPorted' }
  }

  const events: Ev[] = []
  for (const e of raw) {
    const info = store.identities[e.u]
    if (!info || info.bot) continue
    events.push(alias.has(e.u) ? { ...e, u: alias.get(e.u)! } : e)
  }
  events.sort((a, b) => a.t - b.t)
  return { events, identities: store.identities, storeStart: new Date(store.storeStart).getTime() }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

const DAY  = 86_400_000
const WEEK = 7 * DAY
/** Day bucket in Central European time (good enough for daily caps) */
const dayOf = (t: number) => Math.floor((t + 3_600_000) / DAY)

interface Acc extends Counts {
  commentsGivenRaw: number
  commentRepliesRaw: number
  ticketsCreatedRaw: number
  tasksCreatedRaw: number
  ticketCommentsRaw: number
  repos: Set<string>
  weeks: Set<number>
  prComments: Map<string, number>
  prReplies: Map<string, number>
  ticketDays: Map<number, number>
  taskDays: Map<number, number>
  commentKeys: Set<string>
  reviewed: Set<string>
  approved: Set<string>
}

const newAcc = (): Acc => ({
  prsCreated: 0, prsCompleted: 0, prsPorted: 0, prsReviewed: 0, approvalsGiven: 0,
  commentsGiven: 0, commentsGivenRaw: 0, commentReplies: 0, commentRepliesRaw: 0,
  workItemsCompleted: 0, backlogItemsCompleted: 0, tasksCompleted: 0,
  ticketsCreated: 0, ticketsCreatedRaw: 0, tasksCreated: 0, tasksCreatedRaw: 0, ticketComments: 0, ticketCommentsRaw: 0,
  repos: new Set(), weeks: new Set(), prComments: new Map(), prReplies: new Map(), ticketDays: new Map(), taskDays: new Map(),
  commentKeys: new Set(), reviewed: new Set(), approved: new Set(),
})

/** Computes the ranking for the window (at - days, at]. Events must be prepared (no bots, aliases merged). */
export function computePeriod(prep: PreparedEvents, at: number, days: number): PeriodData {
  const fromTs = at - days * DAY
  // The window is split into round(days / 7) weeks; the remaining days belong to the oldest week,
  // so a 30-day window has 4 weeks (not 4 + a 2-day "week").
  const weekCount = Math.max(1, Math.round(days / 7))
  const weekOf = (t: number) => Math.min(Math.floor((at - t) / WEEK), weekCount - 1)
  const accs = new Map<string, Acc>()
  const acc = (u: string) => { let a = accs.get(u); if (!a) { a = newAcc(); accs.set(u, a) } return a }

  for (const e of prep.events) {
    if (e.t <= fromTs) continue
    if (e.t > at) break
    const a = acc(e.u)
    let counted = true
    switch (e.k) {
      case 'prCreated':   a.prsCreated++;   if (e.x) a.repos.add(e.x); break
      case 'prCompleted': a.prsCompleted++; if (e.x) a.repos.add(e.x); break
      case 'prPorted':    a.prsPorted++;    if (e.x) a.repos.add(e.x); break
      case 'prReviewed':
        if (a.reviewed.has(e.ref)) { counted = false; break }
        a.reviewed.add(e.ref); a.prsReviewed++; break
      case 'prApproved':
        if (a.approved.has(e.ref)) { counted = false; break }
        a.approved.add(e.ref); a.approvalsGiven++; break
      case 'prComment': {
        // x = 's'|'r' + text length (events without details count as a finding)
        const reply  = e.x?.[0] === 'r'
        const length = e.x ? Number(e.x.slice(1)) : Infinity
        if (reply) a.commentRepliesRaw++
        else       a.commentsGivenRaw++
        if (!(length >= LIMITS.minCommentLength)) { counted = false; break }
        const per = reply ? a.prReplies : a.prComments
        const n = (per.get(e.ref) || 0) + 1
        per.set(e.ref, n)
        if (n > (reply ? LIMITS.prRepliesPerPr : LIMITS.prCommentsPerPr)) { counted = false; break }
        if (reply) a.commentReplies++
        else       a.commentsGiven++
        break
      }
      case 'wiCompleted':
        if (e.x && BACKLOG_TYPES.has(e.x))   { a.backlogItemsCompleted++; a.workItemsCompleted++ }
        else if (e.x && TASK_TYPES.has(e.x)) { a.tasksCompleted++;        a.workItemsCompleted++ }
        else counted = false
        break
      case 'wiCreated': {
        const d = dayOf(e.t)
        if (e.x && TICKET_CREATE_TYPES.has(e.x)) {
          a.ticketsCreatedRaw++
          const n = (a.ticketDays.get(d) || 0) + 1
          a.ticketDays.set(d, n)
          if (n <= LIMITS.ticketsPerDay) a.ticketsCreated++
        } else if (e.x && TASK_CREATE_TYPES.has(e.x)) {
          a.tasksCreatedRaw++
          const n = (a.taskDays.get(d) || 0) + 1
          a.taskDays.set(d, n)
          if (n <= LIMITS.tasksPerDay) a.tasksCreated++
        } else counted = false
        break
      }
      case 'wiComment': {
        a.ticketCommentsRaw++
        const key = `${e.ref}:${dayOf(e.t)}`
        if (!a.commentKeys.has(key)) { a.commentKeys.add(key); a.ticketComments++ }
        break
      }
    }
    if (counted) a.weeks.add(weekOf(e.t))
  }

  const developers: DevStats[] = []
  for (const [u, a] of accs) {
    const pointsByMetric: Record<string, number> = {}
    let points = 0
    for (const [field, key] of Object.entries(METRIC_SCORING)) {
      const p = (a[field as keyof Counts] as number) * SCORING[key]
      pointsByMetric[field] = p
      points += p
    }
    if (points <= 0) continue
    const info = prep.identities[u]
    const counts: Counts = {
      prsCreated: a.prsCreated, prsCompleted: a.prsCompleted, prsPorted: a.prsPorted, prsReviewed: a.prsReviewed,
      approvalsGiven: a.approvalsGiven, commentsGiven: a.commentsGiven, commentReplies: a.commentReplies, workItemsCompleted: a.workItemsCompleted, backlogItemsCompleted: a.backlogItemsCompleted,
      tasksCompleted: a.tasksCompleted, ticketsCreated: a.ticketsCreated, tasksCreated: a.tasksCreated, ticketComments: a.ticketComments,
    }
    const activeWeeks = Math.max(1, a.weeks.size)
    developers.push({
      id: u,
      displayName: info?.n || u,
      uniqueName:  info?.e || u,
      repositories: [...a.repos].sort(),
      ...counts,
      commentsGivenRaw:  a.commentsGivenRaw,
      commentRepliesRaw: a.commentRepliesRaw,
      ticketsCreatedRaw: a.ticketsCreatedRaw,
      tasksCreatedRaw:   a.tasksCreatedRaw,
      ticketCommentsRaw: a.ticketCommentsRaw,
      points,
      pointsByMetric,
      activeWeeks,
      pointsPerWeek: Math.round(points / activeWeeks),
      badges: BADGES.filter((b) => b.cond(counts)).map(({ id, name, icon, desc }) => ({ id, name, icon, desc })),
      level:  getLevel(points, days),
      rank:   0,
    })
  }
  developers.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName))
  developers.forEach((d, i) => { d.rank = i + 1 })

  const sum = (f: (d: DevStats) => number) => developers.reduce((s, d) => s + f(d), 0)
  return {
    developers,
    totals: {
      prs:            sum((d) => d.prsCreated),
      prsCompleted:   sum((d) => d.prsCompleted),
      ports:          sum((d) => d.prsPorted),
      reviews:        sum((d) => d.prsReviewed),
      approvals:      sum((d) => d.approvalsGiven),
      workItems:      sum((d) => d.workItemsCompleted),
      comments:       sum((d) => d.commentsGivenRaw + d.commentRepliesRaw),
      ticketsCreated: sum((d) => d.ticketsCreatedRaw),
      tasksCreated:   sum((d) => d.tasksCreatedRaw),
      ticketComments: sum((d) => d.ticketCommentsRaw),
    },
    fromDate: new Date(fromTs).toISOString(),
    toDate:   new Date(at).toISOString(),
    days,
    scoring:  { ...SCORING },
    limits:   { ...LIMITS },
    scoringVersion: SCORING_VERSION,
    levels:   buildLevelsForPeriod(days),
  }
}

export const PERIODS = [7, 30, 90, 365] as const

/** True if the store contains events far enough back to compute the window ending at `at`. */
export function covers(prep: PreparedEvents, at: number, days: number): boolean {
  return at - days * DAY >= prep.storeStart - DAY
}
