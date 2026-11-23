import { createHash } from 'crypto'
import { AzureClient, mapLimit } from './azureClient'
import { IdentityRegistry, type AzureIdentity } from './identities'
import type { EventStore, PrRecord, Progress, StoredEvent } from './types'

const DAY = 86_400_000
const ts = (d: unknown): number | null => {
  if (!d || typeof d !== 'string') return null
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : null
}

type ProgressFn = (p: Partial<Progress> & { step: string; message: string }) => void

// ─── Work items: reporting revision stream ────────────────────────────────────
//
// One paged stream of all work item revisions of the project (≈1000 per request).
// From it we derive exactly:
//   • creation (Rev 1)                        → wiCreated
//   • state change into a "Completed" state   → wiCompleted (assignee at that revision)
//   • discussion comment (System.History)     → wiComment
// Edits that don't change the state (board moves, tags, area path …) are ignored —
// this fixes items being counted as "completed" again after unrelated changes.
// The continuation token is persisted, so later refreshes only fetch new revisions.

const REVISION_FIELDS = [
  'System.Id', 'System.Rev', 'System.WorkItemType', 'System.State', 'System.AssignedTo',
  'System.ChangedBy', 'System.ChangedDate', 'System.CreatedBy', 'System.CreatedDate',
  'System.History', 'Microsoft.VSTS.Common.StateChangeDate',
].join(',')

async function loadCompletedStates(client: AzureClient): Promise<Map<string, Set<string>>> {
  const types = await client.get<{ value: { name: string }[] }>(`${client.base}/_apis/wit/workitemtypes?api-version=7.0`)
  const map = new Map<string, Set<string>>()
  await mapLimit(types.value || [], 6, async (t) => {
    try {
      const states = await client.get<{ value: { name: string; category: string }[] }>(
        `${client.base}/_apis/wit/workitemtypes/${encodeURIComponent(t.name)}/states?api-version=7.0`,
      )
      map.set(t.name, new Set((states.value || []).filter((s) => s.category === 'Completed').map((s) => s.name)))
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 401) throw e
      console.warn(`   States of work item type "${t.name}" could not be loaded — using defaults`)
    }
  })
  return map
}

interface RevisionPage {
  values: { fields: Record<string, unknown> }[]
  nextLink?: string
  continuationToken?: string
  isLastBatch?: boolean
}

export async function collectWorkItems(client: AzureClient, store: EventStore, reg: IdentityRegistry, progress: ProgressFn) {
  progress({ step: 'workitems', message: 'Loading work item states…', done: 0, total: 0, repo: '' })
  const completed = await loadCompletedStates(client)
  const isCompleted = (type: string, state: string) =>
    completed.get(type)?.has(state) ?? ['Done', 'Closed', 'Completed'].includes(state)

  const startTs = Date.parse(store.storeStart)
  const span = Math.max(1, Date.now() - startTs)
  let url = `${client.base}/_apis/wit/reporting/workitemrevisions?fields=${REVISION_FIELDS}&$maxPageSize=1000&api-version=7.0` +
    (store.revisionsToken
      ? `&continuationToken=${encodeURIComponent(store.revisionsToken)}`
      : `&startDateTime=${encodeURIComponent(store.storeStart)}`)

  let count = 0
  while (true) {
    const page = await client.get<RevisionPage>(url)
    let lastTs = 0
    for (const { fields: f } of page.values || []) {
      count++
      const id = String(f['System.Id'])
      const rev = Number(f['System.Rev'])
      const type = String(f['System.WorkItemType'] || '')
      const state = String(f['System.State'] || '')
      const changed = ts(f['System.ChangedDate'])
      if (!changed) continue
      lastTs = Math.max(lastTs, changed)

      if (rev === 1) {
        const creator = reg.fromString(f['System.CreatedBy'])
        const created = ts(f['System.CreatedDate']) ?? changed
        if (creator) store.wi[`n:${id}`] = ['wiCreated', creator, created, id, type]
      }

      const stateChanged = f['Microsoft.VSTS.Common.StateChangeDate'] === f['System.ChangedDate']
      if (stateChanged && isCompleted(type, state)) {
        const who = reg.fromString(f['System.AssignedTo']) ?? reg.fromString(f['System.ChangedBy'])
        const key = `c:${id}`
        const prev = store.wi[key]
        // An item counts once: keep its first completion (reopen + close again ≠ new work)
        if (who && (!prev || prev[2] > changed)) store.wi[key] = ['wiCompleted', who, changed, id, type]
      }

      if (f['System.History']) {
        const author = reg.fromString(f['System.ChangedBy'])
        if (author) store.wi[`m:${id}:${rev}`] = ['wiComment', author, changed, id]
      }
    }
    if (page.continuationToken) store.revisionsToken = page.continuationToken
    const pct = lastTs ? Math.min(99, Math.round(((lastTs - startTs) / span) * 100)) : 0
    progress({
      step: 'workitems',
      message: `Work item changes: ${count.toLocaleString('en-US')} processed${lastTs ? ` (up to ${new Date(lastTs).toISOString().slice(0, 10)})` : ''}`,
      done: pct, total: 100, repo: '',
    })
    if (page.isLastBatch || !page.nextLink) break
    url = page.nextLink
  }
  return count
}

// ─── Pull requests ────────────────────────────────────────────────────────────

interface GitPr {
  pullRequestId: number
  status: string
  title?: string
  targetRefName?: string
  creationDate: string
  closedDate?: string
  createdBy?: AzureIdentity
  reviewers?: (AzureIdentity & { vote?: number })[]
}

interface PrThread {
  isDeleted?: boolean
  properties?: Record<string, { $value?: string }>
  comments?: { commentType?: string; isDeleted?: boolean; author?: AzureIdentity; publishedDate?: string; content?: string }[]
}

/** Comments consisting only of these phrases are acknowledgements, not review findings. */
const ACK_PHRASES = [
  'ok', 'okay', 'oki', 'done', 'erledigt', 'fixed', 'gefixt', 'behoben', 'angepasst', 'geändert', 'korrigiert', 'umgesetzt',
  'danke', 'vielen dank', 'danke schön', 'dankeschön', 'merci', 'thanks', 'thank you', 'thx', 'ty',
  'lgtm', 'looks good', 'looks good to me', 'sieht gut aus', 'passt', 'passt so', 'alles klar', 'perfekt', 'super', 'top',
  'nice', 'cool', 'prima', 'great', 'good job', 'well done', 'works', 'works as expected', 'funktioniert', 'funktioniert nun',
  'code review ok', 'review ok', 'approved', 'ja', 'nein', 'yes', 'no', 'stimmt', 'genau', 'richtig', 'gerne', 'sorry',
  'wrong pr', 'falscher pr', 'd', 'img', 'url',
]
const ACK_RE = new RegExp(`^(?:(?:${[...ACK_PHRASES].sort((a, b) => b.length - a.length).join('|')})\\s*)+$`)

/**
 * Length of a comment's own text — mentions (@<GUID>), image/link targets and whitespace don't
 * count. Pure acknowledgements ("ok", "Done. Vielen Dank!", "LGTM 👍") return 0.
 */
export function commentLength(content: string | undefined): number {
  if (!content) return 0
  const text = content
    .replace(/@<[^>]+>/g, '')                        // mentions
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' [img] ')      // images → short placeholder
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')          // links → label
    .replace(/https?:\/\/\S+/g, ' [url] ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (!words || ACK_RE.test(words)) return 0
  return Math.min(text.length, 9999)
}

/**
 * Short hash of the normalised PR title — backports of the same change into other branches
 * carry the same title. Ticket references ("(DevOps-123)"), tags ("[5.18]") and words like
 * "backport"/"cherry-pick" are ignored.
 */
export function titleKey(title: string | undefined): string | undefined {
  if (!title) return undefined
  const norm = title.toLowerCase()
    .replace(/\((dev-?ops)[^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(backport(ed)?|cherry[- ]?pick(ed)?|ported?)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return norm ? createHash('sha1').update(norm).digest('hex').slice(0, 12) : undefined
}

const branch = (ref: string | undefined) => ref?.replace(/^refs\/heads\//, '')

/** Derives author, review and comment events for one PR. */
export function buildPrEvents(pr: GitPr, repo: string, threads: PrThread[] | null, reg: IdentityRegistry): StoredEvent[] {
  const id = String(pr.pullRequestId)
  const author = reg.fromAzure(pr.createdBy)
  const created = ts(pr.creationDate)
  const closed = ts(pr.closedDate)
  if (!author || !created) return []
  const ev: StoredEvent[] = [['prCreated', author, created, id, repo]]
  if (pr.status === 'completed' && closed) ev.push(['prCompleted', author, closed, id, repo])

  const firstReview = new Map<string, number>()
  const firstApproval = new Map<string, number>()
  const earliest = (m: Map<string, number>, u: string, t: number) => { const p = m.get(u); if (p === undefined || t < p) m.set(u, t) }

  for (const th of threads || []) {
    if (th.isDeleted) continue
    const kind = th.properties?.CodeReviewThreadType?.$value
    if (kind === 'VoteUpdate') {
      const vote = Number(th.properties?.CodeReviewVoteResult?.$value)
      const c = th.comments?.[0]
      const voter = reg.fromAzure(c?.author)
      const t = ts(c?.publishedDate)
      if (voter && voter !== author && t && Number.isFinite(vote) && vote !== 0) {
        earliest(firstReview, voter, t)
        if (vote >= 5) earliest(firstApproval, voter, t)
      }
      continue
    }
    // The first text comment opens the thread (a finding), the others are replies in the discussion
    let first = true
    for (const c of th.comments || []) {
      if (c.isDeleted || c.commentType !== 'text') continue
      const starter = first
      first = false
      const u = reg.fromAzure(c.author)
      const t = ts(c.publishedDate)
      if (!u || !t || u === author) continue
      ev.push(['prComment', u, t, id, `${starter ? 's' : 'r'}${commentLength(c.content)}`])
      earliest(firstReview, u, t)
    }
  }

  // Fallback / completion from the final reviewer votes (e.g. when no vote thread exists)
  const fallbackTs = closed ?? created
  for (const rv of pr.reviewers || []) {
    if (rv.isContainer) continue
    const u = reg.fromAzure(rv)
    if (!u || u === author) continue
    const vote = rv.vote ?? 0
    if (vote !== 0 && !firstReview.has(u)) firstReview.set(u, fallbackTs)
    if (vote >= 5 && !firstApproval.has(u)) firstApproval.set(u, fallbackTs)
  }

  for (const [u, t] of firstReview) ev.push(['prReviewed', u, t, id])
  for (const [u, t] of firstApproval) ev.push(['prApproved', u, t, id])
  return ev
}

export async function collectPullRequests(client: AzureClient, store: EventStore, reg: IdentityRegistry, progress: ProgressFn) {
  progress({ step: 'prs', message: 'Loading repositories…', done: 0, total: 0, repo: '' })
  const repos = (await client.get<{ value: { id: string; name: string; isDisabled?: boolean }[] }>(
    `${client.base}/_apis/git/repositories?api-version=7.0`,
  )).value?.filter((r) => !r.isDisabled) || []

  // 1. PR lists (cheap: up to 1000 PRs per request, repositories in parallel)
  const minTime = encodeURIComponent(store.storeStart)
  const listed: { pr: GitPr; repo: string; repoId: string }[] = []
  let reposDone = 0
  await mapLimit(repos, 6, async (repo) => {
    try {
      for (let skip = 0; ; skip += 1000) {
        const page = await client.get<{ value: GitPr[] }>(
          `${client.base}/_apis/git/repositories/${repo.id}/pullrequests?searchCriteria.status=all&searchCriteria.minTime=${minTime}&$top=1000&$skip=${skip}&api-version=7.0`,
        )
        for (const pr of page.value || []) listed.push({ pr, repo: repo.name, repoId: repo.id })
        if ((page.value || []).length < 1000) break
      }
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status === 401) throw e
      console.warn(`   Pull requests of repository "${repo.name}" could not be loaded — skipped`)
    }
    reposDone++
    progress({ step: 'prs', message: `Pull requests: ${reposDone}/${repos.length} repositories`, repo: repo.name, done: reposDone, total: repos.length })
  })

  // 2. Threads only for PRs that are new or may still change (incremental)
  const now = Date.now()
  const needThreads = listed.filter(({ pr }) => {
    const rec = store.prs[String(pr.pullRequestId)]
    const closed = ts(pr.closedDate)
    if (!rec || !rec.f) return true
    if (pr.status === 'active' || rec.s !== pr.status) return true
    // Late comments after closing: keep refreshing for two weeks
    return !!closed && rec.f < closed + 14 * DAY && now - closed < 30 * DAY
  })

  let threadsDone = 0
  await mapLimit(needThreads, 8, async ({ pr, repo, repoId }) => {
    const key = String(pr.pullRequestId)
    let threads: PrThread[] | null = null
    try {
      threads = (await client.get<{ value: PrThread[] }>(
        `${client.base}/_apis/git/repositories/${repoId}/pullRequests/${pr.pullRequestId}/threads?api-version=7.0`,
      )).value || []
    } catch { /* keep previous data, retry next time */ }
    const prev = store.prs[key]
    const meta = { t: titleKey(pr.title), b: branch(pr.targetRefName) }
    const rec: PrRecord = threads
      ? { s: pr.status, c: pr.closedDate, f: Date.now(), repo, ...meta, e: buildPrEvents(pr, repo, threads, reg) }
      : prev && prev.f
        ? { ...prev, s: pr.status, c: pr.closedDate, ...meta }
        : { s: pr.status, c: pr.closedDate, f: 0, repo, ...meta, e: buildPrEvents(pr, repo, null, reg) }
    store.prs[key] = rec
    threadsDone++
    if (threadsDone % 25 === 0 || threadsDone === needThreads.length) {
      progress({ step: 'threads', message: `PR reviews & comments: ${threadsDone}/${needThreads.length}`, repo, done: threadsDone, total: needThreads.length })
    }
  })

  // 3. PRs that didn't need threads: refresh status-derived events cheaply (votes may change)
  //    and keep title/branch up to date (backport detection)
  for (const { pr, repo } of listed) {
    const key = String(pr.pullRequestId)
    const rec = store.prs[key]
    const meta = { t: titleKey(pr.title), b: branch(pr.targetRefName) }
    if (!rec) store.prs[key] = { s: pr.status, c: pr.closedDate, f: 0, repo, ...meta, e: buildPrEvents(pr, repo, null, reg) }
    else Object.assign(rec, meta)
  }
  return { repos: repos.length, prs: listed.length, threadsFetched: needThreads.length }
}
