import { Router } from 'express'
import axios from 'axios'
import path from 'path'
import fs from 'fs'

const router = Router()

const DATA_DIR   = path.join(__dirname, '..', '..', 'data')
const CONFIG_FILE = path.join(DATA_DIR, 'azure-ranking.config.json')
const CACHE_FILE  = path.join(DATA_DIR, 'azure-ranking.cache.json')

// ─── Types ────────────────────────────────────────────────────────────────────

interface AzureConfig {
  organization: string
  project:      string
  pat:          string
}

interface Badge {
  id:   string
  name: string
  icon: string
  desc: string
}

interface Level {
  name:  string
  icon:  string
  color: string
  min:   number
  next:  number | null
}

interface DevStats {
  id:                 string
  displayName:        string
  uniqueName:         string
  repositories:       string[]
  prsCreated:         number
  prsCompleted:       number
  commentsGiven:      number
  approvalsGiven:     number
  rejectionsGiven:    number
  commits:            number
  workItemsCompleted: number
  ticketsCreated:     number
  ticketComments:     number
  points:             number
  badges:             Badge[]
  level:              Level
  rank:               number
}

interface PeriodData {
  developers:  DevStats[]
  totals: {
    prs:            number
    commits:        number
    workItems:      number
    comments:       number
    ticketsCreated: number
    ticketComments: number
  }
  fromDate: string
  toDate:   string
  days:     number
  scoring:  Record<string, number>
  levels:   Array<{ name: string; icon: string; color: string; min: number; max: number | null }>
}

interface CacheData {
  periods: Record<number, PeriodData>
}

interface CacheState {
  loading:    boolean
  lastLoaded: string | null
  data:       CacheData | null
  error:      string | null
  progress: {
    step:    string
    message: string
    repo:    string
    done:    number
    total:   number
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig(): AzureConfig {
  const defaults: AzureConfig = { organization: '', project: '', pat: '' }
  if (!fs.existsSync(CONFIG_FILE)) return defaults
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
  } catch {
    return defaults
  }
}

let config = loadConfig()

// ─── Cache ────────────────────────────────────────────────────────────────────

const cacheState: CacheState = {
  loading:    false,
  lastLoaded: null,
  data:       null,
  error:      null,
  progress:   { step: '', message: '', repo: '', done: 0, total: 0 },
}

function tryRestoreCache() {
  if (cacheState.data) return // already loaded
  if (!fs.existsSync(CACHE_FILE)) return
  try {
    const saved = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    cacheState.data       = saved.data       || null
    cacheState.lastLoaded = saved.lastLoaded || null
    if (cacheState.data) {
      console.log(`📦 Azure ranking cache restored (as of: ${new Date(cacheState.lastLoaded!).toLocaleString('en-US')})`)
    }
  } catch (e: unknown) {
    console.warn('Azure ranking cache could not be read:', (e as Error).message)
  }
}

// Attempt immediately on server start
tryRestoreCache()

function persistCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ data: cacheState.data, lastLoaded: cacheState.lastLoaded }))
  } catch (e: unknown) {
    console.warn('Azure ranking cache could not be saved:', (e as Error).message)
  }
}

// ─── Azure API Helpers ────────────────────────────────────────────────────────

function authHeader(pat: string) {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
}

let reqCache = new Map<string, unknown>()

const http = axios.create({ timeout: 30000 })

async function azGet<T = unknown>(url: string): Promise<T> {
  if (reqCache.has(url)) return reqCache.get(url) as T
  const res = await http.get<T>(url, { headers: { Authorization: authHeader(config.pat) } })
  reqCache.set(url, res.data)
  return res.data
}

async function azPost<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await http.post<T>(url, body, {
    headers: { Authorization: authHeader(config.pat), 'Content-Type': 'application/json' },
  })
  return res.data
}

const BASE = () =>
  `https://dev.azure.com/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}`

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const toTs  = (d?: string) => (d ? new Date(d).getTime() : null)

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function getRepositories() {
  const data = await azGet<{ value: unknown[] }>(`${BASE()}/_apis/git/repositories?api-version=7.0`)
  return data.value || []
}

async function getPullRequests(repoId: string, fromTs: number) {
  const minTime = new Date(fromTs).toISOString()
  let all: unknown[] = []
  let skip = 0
  const pageSize = 1000
  while (true) {
    const url = `${BASE()}/_apis/git/repositories/${repoId}/pullrequests` +
      `?searchCriteria.status=all&searchCriteria.minTime=${encodeURIComponent(minTime)}` +
      `&$top=${pageSize}&$skip=${skip}&api-version=7.0`
    const data = await azGet<{ value: unknown[] }>(url)
    const page = data.value || []
    all = all.concat(page)
    if (page.length < pageSize) break
    skip += pageSize
  }
  return all.filter((pr: unknown) => {
    const p = pr as Record<string, unknown>
    const ts = toTs(p.creationDate as string)
    return ts !== null && ts >= fromTs
  })
}

async function getPRThreads(repoId: string, prId: number) {
  const url = `${BASE()}/_apis/git/repositories/${repoId}/pullRequests/${prId}/threads?api-version=7.0`
  const data = await azGet<{ value: unknown[] }>(url)
  return data.value || []
}

async function getCommits(repoId: string, fromTs: number) {
  const dateStr = new Date(fromTs).toISOString().split('T')[0]
  const url = `${BASE()}/_apis/git/repositories/${repoId}/commits` +
    `?searchCriteria.fromDate=${dateStr}&$top=10000&api-version=7.0`
  try {
    const data = await azGet<{ value: unknown[] }>(url)
    return data.value || []
  } catch {
    return []
  }
}

async function getClosedWorkItems(fromTs: number) {
  const dateStr = new Date(fromTs).toISOString().split('T')[0]
  const query =
    `SELECT [System.Id],[System.AssignedTo],[System.ChangedDate] ` +
    `FROM WorkItems WHERE [System.TeamProject] = '${config.project}' ` +
    `AND [System.State] IN ('Closed','Done','Resolved') ` +
    `AND [System.ChangedDate] >= '${dateStr}' ORDER BY [System.ChangedDate] DESC`
  try {
    const wiql = await azPost<{ workItems?: { id: number }[] }>(`${BASE()}/_apis/wit/wiql?api-version=7.0`, { query })
    if (!wiql.workItems?.length) return []
    const ids = wiql.workItems.map((w) => w.id)
    let all: unknown[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const batch  = ids.slice(i, i + 200).join(',')
      const fields = 'System.Id,System.AssignedTo,System.ChangedDate'
      const data   = await azGet<{ value: unknown[] }>(`${BASE()}/_apis/wit/workitems?ids=${batch}&fields=${fields}&api-version=7.0`)
      all = all.concat(data.value || [])
    }
    return all
  } catch (e: unknown) {
    console.warn('Closed tickets could not be loaded:', (e as Error).message)
    return []
  }
}

async function getCreatedWorkItems(fromTs: number) {
  const dateStr = new Date(fromTs).toISOString().split('T')[0]
  const query =
    `SELECT [System.Id],[System.CreatedBy],[System.CreatedDate] ` +
    `FROM WorkItems WHERE [System.TeamProject] = '${config.project}' ` +
    `AND [System.CreatedDate] >= '${dateStr}' ` +
    `ORDER BY [System.CreatedDate] DESC`
  try {
    const wiql = await azPost<{ workItems?: { id: number }[] }>(`${BASE()}/_apis/wit/wiql?api-version=7.0`, { query })
    if (!wiql.workItems?.length) return []
    const ids = wiql.workItems.map((w) => w.id)
    let all: unknown[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const batch  = ids.slice(i, i + 200).join(',')
      const fields = 'System.Id,System.CreatedBy,System.CreatedDate'
      const data   = await azGet<{ value: unknown[] }>(`${BASE()}/_apis/wit/workitems?ids=${batch}&fields=${fields}&api-version=7.0`)
      all = all.concat(data.value || [])
    }
    return all
  } catch (e: unknown) {
    console.warn('Created tickets could not be loaded:', (e as Error).message)
    return []
  }
}

async function getActiveWorkItemIds(fromTs: number) {
  const dateStr = new Date(fromTs).toISOString().split('T')[0]
  const query =
    `SELECT [System.Id] FROM WorkItems ` +
    `WHERE [System.TeamProject] = '${config.project}' ` +
    `AND [System.ChangedDate] >= '${dateStr}' ORDER BY [System.ChangedDate] DESC`
  try {
    const wiql = await azPost<{ workItems?: { id: number }[] }>(`${BASE()}/_apis/wit/wiql?api-version=7.0`, { query })
    return (wiql.workItems || []).map((w) => w.id)
  } catch (e: unknown) {
    console.warn('Active work item IDs could not be loaded:', (e as Error).message)
    return []
  }
}

async function getWorkItemComments(wiId: number) {
  try {
    const url  = `${BASE()}/_apis/wit/workitems/${wiId}/comments?api-version=7.0-preview.4`
    const data = await azGet<{ comments?: unknown[] }>(url)
    return data.comments || []
  } catch {
    return []
  }
}

// ─── Gamification Engine ──────────────────────────────────────────────────────

const SCORING = {
  prCreated:         10,
  prCompleted:       25,
  prComment:          5,
  prApproved:        15,
  prRejected:         8,
  commit:             2,
  workItemCompleted: 12,
  ticketCreated:      8,
  ticketComment:      3,
}

interface BadgeDef {
  id:   string
  name: string
  icon: string
  desc: string
  cond: (s: RawDevStats) => boolean
}

interface RawDevStats {
  prsCreated:         number
  prsCompleted:       number
  commentsGiven:      number
  approvalsGiven:     number
  rejectionsGiven:    number
  commits:            number
  workItemsCompleted: number
  ticketsCreated:     number
  ticketComments:     number
}

const BADGES: BadgeDef[] = [
  { id: 'first_pr',       name: 'First Step',        icon: '🎯', desc: 'Created first PR',            cond: (s) => s.prsCreated >= 1 },
  { id: 'pr_creator',     name: 'PR Creator',        icon: '🔀', desc: '5+ PRs created',              cond: (s) => s.prsCreated >= 5 },
  { id: 'pr_machine',     name: 'PR Machine',        icon: '⚡', desc: '20+ PRs created',             cond: (s) => s.prsCreated >= 20 },
  { id: 'merger',         name: 'Merger',            icon: '🎊', desc: '10+ PRs merged',              cond: (s) => s.prsCompleted >= 10 },
  { id: 'reviewer',       name: 'Code Reviewer',     icon: '🔍', desc: '20+ review comments',         cond: (s) => s.commentsGiven >= 20 },
  { id: 'senior_rev',     name: 'Senior Reviewer',   icon: '👁️', desc: '50+ review comments',         cond: (s) => s.commentsGiven >= 50 },
  { id: 'approver',       name: 'Approver',          icon: '✅', desc: '10+ PRs approved',            cond: (s) => s.approvalsGiven >= 10 },
  { id: 'nitpicker',      name: 'Perfectionist',     icon: '🔎', desc: '5+ PRs rejected',             cond: (s) => s.rejectionsGiven >= 5 },
  { id: 'committer',      name: 'Active Coder',      icon: '💻', desc: '20+ commits',                 cond: (s) => s.commits >= 20 },
  { id: 'commit_king',    name: 'Commit King',       icon: '👑', desc: '100+ commits',                cond: (s) => s.commits >= 100 },
  { id: 'worker',         name: 'Work Horse',        icon: '🐴', desc: '10+ tickets completed',       cond: (s) => s.workItemsCompleted >= 10 },
  { id: 'powerworker',    name: 'Power Worker',      icon: '💪', desc: '30+ tickets completed',       cond: (s) => s.workItemsCompleted >= 30 },
  { id: 'ticket_starter', name: 'Ticket Creator',    icon: '📝', desc: '5+ tickets created',          cond: (s) => s.ticketsCreated >= 5 },
  { id: 'ticket_master',  name: 'Ticket Master',     icon: '🎫', desc: '20+ tickets created',         cond: (s) => s.ticketsCreated >= 20 },
  { id: 'commentator',    name: 'Commentator',       icon: '💡', desc: '20+ ticket comments',         cond: (s) => s.ticketComments >= 20 },
  { id: 'disc_king',      name: 'Discussion King',   icon: '🗣️', desc: '50+ ticket comments',         cond: (s) => s.ticketComments >= 50 },
  { id: 'all_rounder',    name: 'All-Rounder',       icon: '🌟', desc: 'Active in all categories',    cond: (s) => s.prsCreated > 0 && s.commits > 0 && s.workItemsCompleted > 0 && s.commentsGiven > 0 },
]

function getLevel(points: number): Level {
  if (points >= 10000) return { name: 'Diamond', icon: '💎', color: '#00BFFF', min: 10000, next: null }
  if (points >= 5000)  return { name: 'Platinum', icon: '🏆', color: '#E5E4E2', min: 5000,  next: 10000 }
  if (points >= 2500)  return { name: 'Gold',    icon: '🥇', color: '#FFD700', min: 2500,  next: 5000 }
  if (points >= 1000)  return { name: 'Silver',  icon: '🥈', color: '#C0C0C0', min: 1000,  next: 2500 }
  return                      { name: 'Bronze',  icon: '🥉', color: '#CD7F32', min: 0,     next: 1000 }
}

// ─── Developer Tracker ────────────────────────────────────────────────────────

interface RawDev {
  id:          string
  displayName: string
  uniqueName:  string
  prCreatedTs:         number[]
  prCompletedTs:       number[]
  prCommentTs:         number[]
  prApprovalTs:        number[]
  prRejectionTs:       number[]
  commitTs:            number[]
  workItemCompletedTs: number[]
  ticketCreatedTs:     number[]
  ticketCommentTs:     number[]
  repositories: Set<string>
}

interface AzureIdentity {
  uniqueName?:  string
  id?:          string
  displayName?: string
}

class DevTracker {
  private byKey    = new Map<string, RawDev>()
  private emailMap = new Map<string, string>()

  private create(key: string, displayName: string): RawDev {
    return {
      id: key, displayName, uniqueName: key,
      prCreatedTs: [], prCompletedTs: [], prCommentTs: [],
      prApprovalTs: [], prRejectionTs: [], commitTs: [],
      workItemCompletedTs: [], ticketCreatedTs: [], ticketCommentTs: [],
      repositories: new Set(),
    }
  }

  fromIdentity(identity?: AzureIdentity | null): RawDev | null {
    if (!identity) return null
    const key = identity.uniqueName || identity.id
    if (!key) return null
    if (!this.byKey.has(key)) {
      this.byKey.set(key, this.create(key, identity.displayName || key))
      if (identity.uniqueName) this.emailMap.set(identity.uniqueName.toLowerCase(), key)
    }
    return this.byKey.get(key)!
  }

  fromEmail(email: string, name?: string): RawDev | null {
    if (!email) return null
    const lower = email.toLowerCase()
    const key   = this.emailMap.get(lower) || lower
    if (!this.byKey.has(key)) {
      this.byKey.set(key, this.create(key, name || email.split('@')[0]))
      this.emailMap.set(lower, key)
    }
    return this.byKey.get(key)!
  }

  getAll(): RawDev[] { return Array.from(this.byKey.values()) }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregateForPeriod(rawDevs: RawDev[], fromTs: number, days: number): PeriodData {
  const count = (arr: number[]) => arr.filter((t) => t >= fromTs).length

  const devStats: DevStats[] = rawDevs
    .map((d) => ({
      id:                 d.id,
      displayName:        d.displayName,
      uniqueName:         d.uniqueName,
      repositories:       [...d.repositories],
      prsCreated:         count(d.prCreatedTs),
      prsCompleted:       count(d.prCompletedTs),
      commentsGiven:      count(d.prCommentTs),
      approvalsGiven:     count(d.prApprovalTs),
      rejectionsGiven:    count(d.prRejectionTs),
      commits:            count(d.commitTs),
      workItemsCompleted: count(d.workItemCompletedTs),
      ticketsCreated:     count(d.ticketCreatedTs),
      ticketComments:     count(d.ticketCommentTs),
    }))
    .filter((d) =>
      d.prsCreated + d.commits + d.workItemsCompleted +
      d.commentsGiven + d.ticketsCreated + d.ticketComments > 0
    )
    .map((d) => {
      const points = Math.round(
        d.prsCreated         * SCORING.prCreated +
        d.prsCompleted       * SCORING.prCompleted +
        d.commentsGiven      * SCORING.prComment +
        d.approvalsGiven     * SCORING.prApproved +
        d.rejectionsGiven    * SCORING.prRejected +
        d.commits            * SCORING.commit +
        d.workItemsCompleted * SCORING.workItemCompleted +
        d.ticketsCreated     * SCORING.ticketCreated +
        d.ticketComments     * SCORING.ticketComment,
      )
      return {
        ...d, points,
        badges: BADGES.filter((b) => b.cond(d)).map(({ id, name, icon, desc }) => ({ id, name, icon, desc })),
        level:  getLevel(points),
        rank:   0,
      }
    })
    .sort((a, b) => b.points - a.points)
    .map((d, i) => ({ ...d, rank: i + 1 }))

  const totals = devStats.reduce(
    (acc, d) => ({
      prs:            acc.prs            + d.prsCreated,
      commits:        acc.commits        + d.commits,
      workItems:      acc.workItems      + d.workItemsCompleted,
      comments:       acc.comments       + d.commentsGiven,
      ticketsCreated: acc.ticketsCreated + d.ticketsCreated,
      ticketComments: acc.ticketComments + d.ticketComments,
    }),
    { prs: 0, commits: 0, workItems: 0, comments: 0, ticketsCreated: 0, ticketComments: 0 },
  )

  return {
    developers: devStats,
    totals,
    fromDate: new Date(fromTs).toISOString(),
    toDate:   new Date().toISOString(),
    days,
    scoring: SCORING,
    levels: [
      { name: 'Bronze',   icon: '🥉', color: '#CD7F32', min: 0,    max: 499  },
      { name: 'Silver',   icon: '🥈', color: '#C0C0C0', min: 500,  max: 999  },
      { name: 'Gold',     icon: '🥇', color: '#FFD700', min: 1000, max: 2499 },
      { name: 'Platinum', icon: '🏆', color: '#E5E4E2', min: 2500, max: 4999 },
      { name: 'Diamond',  icon: '💎', color: '#00BFFF', min: 5000, max: null },
    ],
  }
}

// ─── Background Loader ────────────────────────────────────────────────────────

const PERIODS = [7, 30, 90, 365]

function setProgress(step: string, message: string, extra: Partial<CacheState['progress']> = {}) {
  Object.assign(cacheState.progress, { step, message, ...extra })
}

async function loadDataFromAzure() {
  if (cacheState.loading) return

  cacheState.loading = true
  cacheState.error   = null
  reqCache = new Map()

  const MAX_DAYS  = 365
  const now       = Date.now()
  const fromTs365 = now - MAX_DAYS * 86400000

  console.log(`\n🔄 Starting Azure ranking data load (${MAX_DAYS} days)…`)

  try {
    setProgress('start', 'Establishing connection…')
    const tracker = new DevTracker()

    // 1. Repositories
    setProgress('repos', 'Loading repositories…')
    const repos = await getRepositories() as Array<Record<string, unknown>>
    console.log(`   Repositories: ${repos.length}`)
    setProgress('repos', `${repos.length} repositories found`, { total: repos.length, done: 0 })

    // 2. Per repo: PRs + commits
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]
      setProgress('prs', `Repository ${i + 1}/${repos.length}: ${repo.name}`, {
        repo: String(repo.name), done: i, total: repos.length,
      })
      console.log(`   → ${repo.name}`)

      let prs: Array<Record<string, unknown>> = []
      try { prs = await getPullRequests(String(repo.id), fromTs365) as Array<Record<string, unknown>> } catch { /* skip */ }

      for (const pr of prs) {
        const prCreatedTs = toTs(pr.creationDate as string)
        const prClosedTs  = toTs(pr.closedDate as string) || prCreatedTs
        if (!prCreatedTs) continue
        const creator = tracker.fromIdentity(pr.createdBy as AzureIdentity)
        if (creator) {
          creator.repositories.add(String(repo.name))
          creator.prCreatedTs.push(prCreatedTs)
          if (pr.status === 'completed' && prClosedTs) creator.prCompletedTs.push(prClosedTs)
        }

        for (const rv of (pr.reviewers as AzureIdentity[]) || []) {
          const rDev = tracker.fromIdentity(rv)
          if (rDev && rDev.id !== creator?.id && prClosedTs) {
            const vote = (rv as unknown as Record<string, number>).vote
            if (vote === 10)  rDev.prApprovalTs.push(prClosedTs)
            if (vote === -10) rDev.prRejectionTs.push(prClosedTs)
          }
        }

        try {
          await sleep(60)
          const threads = await getPRThreads(String(repo.id), pr.pullRequestId as number) as Array<Record<string, unknown>>
          for (const thread of threads) {
            if (thread.isDeleted) continue
            for (const comment of (thread.comments as Array<Record<string, unknown>>) || []) {
              if (comment.commentType !== 'text' || comment.isDeleted) continue
              const cDev = tracker.fromIdentity(comment.author as AzureIdentity)
              if (cDev && cDev.id !== creator?.id) {
                const commentTs = toTs(comment.publishedDate as string) || prCreatedTs
                cDev.prCommentTs.push(commentTs)
              }
            }
          }
        } catch { /* skip */ }
      }

      const commits = await getCommits(String(repo.id), fromTs365) as Array<Record<string, unknown>>
      for (const c of commits) {
        const author = c.author as Record<string, string> | undefined
        if (author?.email) {
          const dev = tracker.fromEmail(author.email, author.name)
          if (dev) {
            dev.repositories.add(String(repo.name))
            const commitTs = toTs(author.date)
            if (commitTs) dev.commitTs.push(commitTs)
          }
        }
      }
    }

    // 3. Closed tickets
    setProgress('workitems', 'Loading closed tickets…', { done: repos.length, total: repos.length })
    const closedWI = await getClosedWorkItems(fromTs365) as Array<Record<string, unknown>>
    console.log(`   Closed tickets: ${closedWI.length}`)
    for (const wi of closedWI) {
      const fields     = wi.fields as Record<string, unknown>
      const assignedTo = fields?.['System.AssignedTo'] as AzureIdentity | undefined
      const changedTs  = toTs(fields?.['System.ChangedDate'] as string)
      if (assignedTo && changedTs) {
        const dev = tracker.fromIdentity(assignedTo)
        if (dev) dev.workItemCompletedTs.push(changedTs)
      }
    }

    // 4. Created tickets
    setProgress('tickets-created', 'Loading created tickets…')
    const createdWI = await getCreatedWorkItems(fromTs365) as Array<Record<string, unknown>>
    console.log(`   Created tickets: ${createdWI.length}`)
    for (const wi of createdWI) {
      const fields    = wi.fields as Record<string, unknown>
      const createdBy = fields?.['System.CreatedBy'] as AzureIdentity | undefined
      const createdTs = toTs(fields?.['System.CreatedDate'] as string)
      if (createdBy && createdTs) {
        const dev = tracker.fromIdentity(createdBy)
        if (dev) dev.ticketCreatedTs.push(createdTs)
      }
    }

    // 5. Ticket comments
    setProgress('ticket-comments', 'Loading ticket comments…')
    const activeIds = await getActiveWorkItemIds(fromTs365)
    const fetchIds  = activeIds.slice(0, 1000)
    console.log(`   Ticket comments: ${fetchIds.length} work items`)
    for (let i = 0; i < fetchIds.length; i++) {
      setProgress('ticket-comments', `Ticket comments ${i + 1}/${fetchIds.length}…`, {
        done: i, total: fetchIds.length,
      })
      const comments = await getWorkItemComments(fetchIds[i]) as Array<Record<string, unknown>>
      for (const comment of comments) {
        const commentTs = toTs(comment.createdDate as string)
        if (!commentTs || commentTs < fromTs365) continue
        const dev = tracker.fromIdentity(comment.createdBy as AzureIdentity)
        if (dev) dev.ticketCommentTs.push(commentTs)
      }
      if (i % 10 === 0) await sleep(50)
    }

    // 6. Aggregate
    setProgress('done', 'Calculating results…')
    const rawDevs = tracker.getAll()
    const periods: Record<number, PeriodData> = {}
    for (const days of PERIODS) {
      const fromTs = now - days * 86400000
      periods[days] = aggregateForPeriod(rawDevs, fromTs, days)
      console.log(`   Period ${days}d: ${periods[days].developers.length} developers`)
    }

    cacheState.data       = { periods }
    cacheState.lastLoaded = new Date().toISOString()
    persistCache()

    console.log(`✅ Azure ranking cache updated – as of: ${new Date(cacheState.lastLoaded).toLocaleString('en-US')}\n`)
    setProgress('done', 'Done')

  } catch (err: unknown) {
    const e = err as { response?: { status: number }; message: string }
    cacheState.error = e.response?.status === 401
      ? 'Authentication failed. Please check the PAT token.'
      : e.response?.status === 404
        ? 'Organisation or project not found.'
        : e.message
    console.error('❌ Azure ranking load error:', cacheState.error)
  } finally {
    cacheState.loading = false
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/config/status', (_req, res) => {
  res.json({
    configured:   !!(config.organization && config.project && config.pat),
    organization: config.organization,
    project:      config.project,
  })
})

router.post('/config', (req, res) => {
  const { organization, project, pat } = req.body
  if (!organization || !project || !pat)
    return res.status(400).json({ error: 'All fields are required.' })

  config = { organization, project, pat }
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify({ organization, project, pat })) }
  catch (e: unknown) { console.warn('Config could not be saved:', (e as Error).message) }
  res.json({ success: true })
})

router.get('/cache/status', (_req, res) => {
  tryRestoreCache()
  const hasPeriods = !!(cacheState.data?.periods)
  res.json({
    loading:    cacheState.loading,
    lastLoaded: cacheState.lastLoaded,
    hasData:    hasPeriods,
    error:      cacheState.error,
    devCount:   hasPeriods ? (cacheState.data!.periods[365]?.developers?.length ?? 0) : 0,
    progress:   cacheState.progress,
  })
})

router.post('/cache/refresh', (req, res) => {
  if (!config.organization || !config.project || !config.pat)
    return res.status(400).json({ error: 'Not configured.' })
  if (cacheState.loading)
    return res.json({ started: false, message: 'Load already in progress.' })

  loadDataFromAzure() // fire and forget
  res.json({ started: true, message: 'Data load started.' })
})

router.get('/stats', (req, res) => {
  tryRestoreCache()
  if (!cacheState.data?.periods) {
    return res.status(404).json({
      noCache: true,
      loading: cacheState.loading,
      error:   cacheState.error,
      message: cacheState.loading
        ? 'Data is currently being loaded…'
        : 'No cache available. Please load data from Azure.',
    })
  }

  const days         = parseInt(String(req.query.days)) || 365
  const validPeriods = [7, 30, 90, 365]
  const period       = validPeriods.includes(days) ? days : 365
  const data         = cacheState.data.periods[period]

  if (!data) return res.status(400).json({ error: `Period ${days} not in cache.` })
  res.json(data)
})

export default router
