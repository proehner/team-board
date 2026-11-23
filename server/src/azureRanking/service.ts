import fs from 'fs'
import { AzureClient } from './azureClient'
import { collectPullRequests, collectWorkItems } from './collect'
import { IdentityRegistry } from './identities'
import {
  PERIODS, SCORING_VERSION, buildLevelsForPeriod, computePeriod, covers, getLevel, prepareEvents, type PreparedEvents,
} from './scoring'
import {
  FILES, loadHistoryTolerant, loadStore, newStore, readJson, writeJsonAtomic,
  type CacheFile, type HistoryFile, type HistorySnapshot,
} from './store'
import type { AzureConfig, EventStore, PeriodData, Progress } from './types'

const DAY = 86_400_000
const MAX_SNAPSHOTS = 200
/** Never keep events older than this (bounds file size; older history keeps only covered periods) */
const MAX_STORE_DAYS = 2 * 365 + 7

export interface HistoryPoint {
  loadedAt: string
  /** 'load' = an actual data refresh, 'month' = computed month-end value */
  kind: 'load' | 'month'
  periods: Partial<Record<number, { points: number; rank: number }>>
}

class RankingService {
  config: AzureConfig = { organization: '', project: '', pat: '' }
  private store: EventStore | null = null
  private prep: PreparedEvents | null = null
  private cache: CacheFile = { data: null, lastLoaded: null }
  private history: HistoryFile = { snapshots: [] }
  /** devId → chronological history points (real loads + month ends) */
  private trend = new Map<string, HistoryPoint[]>()

  loading = false
  error: string | null = null
  progress: Progress = { step: '', message: '', repo: '', done: 0, total: 0 }

  init() {
    this.config = { organization: '', project: '', pat: '', ...readJson<Partial<AzureConfig>>(FILES.config) }
    this.cache = readJson<CacheFile>(FILES.cache) ?? { data: null, lastLoaded: null }
    this.history = loadHistoryTolerant()
    this.store = loadStore()
    if (this.store) {
      const stale = this.cache.scoringVersion !== SCORING_VERSION || this.history.scoringVersion !== SCORING_VERSION
      this.rebuild(stale)
      console.log(`📦 Azure ranking: ${Object.keys(this.store.wi).length + Object.values(this.store.prs).reduce((s, p) => s + p.e.length, 0)} events since ${this.store.storeStart.slice(0, 10)}${stale ? ' (recomputed with scoring v' + SCORING_VERSION + ')' : ''}`)
    } else if (this.cache.data) {
      console.log('📦 Azure ranking: legacy cache found — a refresh will rebuild it with the new evaluation.')
    }
  }

  get configured() {
    return !!(this.config.organization && this.config.project && this.config.pat)
  }

  saveConfig(cfg: AzureConfig) {
    const changedTarget = cfg.organization !== this.config.organization || cfg.project !== this.config.project
    this.config = cfg
    try { writeJsonAtomic(FILES.config, cfg) } catch (e) { console.warn('Config could not be saved:', (e as Error).message) }
    // Another organisation/project → stored events don't belong to it any more
    if (changedTarget && this.store) {
      this.store = null
      this.prep = null
      try { fs.rmSync(FILES.events, { force: true }) } catch { /* ignore */ }
    }
  }

  get lastLoaded() { return this.cache.lastLoaded }
  get hasData()    { return !!this.cache.data?.periods }
  /** Results were computed with an older logic or from incomplete (migrated) data → one refresh needed */
  get outdated()   { return this.hasData && (this.cache.scoringVersion !== SCORING_VERSION || !!this.store?.needsRefresh) }

  /** Earliest event date needed: one year (+ buffer) and the 365-day window of the oldest snapshot. */
  private desiredStoreStart(now: number): number {
    const oldestSnap = this.history.snapshots.reduce((m, s) => Math.min(m, Date.parse(s.loadedAt)), now)
    const wanted = Math.min(now - 372 * DAY, oldestSnap - 367 * DAY)
    const start = Math.max(wanted, now - MAX_STORE_DAYS * DAY)
    return Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), new Date(start).getUTCDate())
  }

  private setProgress(p: Partial<Progress> & { step: string; message: string }) {
    this.progress = { ...this.progress, repo: '', ...p }
  }

  async refresh(opts: { full?: boolean } = {}) {
    if (this.loading) return
    this.loading = true
    this.error = null
    const started = Date.now()
    try {
      const now = Date.now()
      const desired = this.desiredStoreStart(now)
      let store = this.store
      if (!store || opts.full || desired < Date.parse(store.storeStart) - DAY) {
        store = newStore(new Date(desired).toISOString())
        console.log(`\n🔄 Azure ranking: full load since ${store.storeStart.slice(0, 10)}`)
      } else {
        console.log(`\n🔄 Azure ranking: incremental load`)
      }
      const client = new AzureClient(this.config)
      const reg = new IdentityRegistry(store.identities)

      this.setProgress({ step: 'start', message: 'Connecting…', done: 0, total: 0 })
      const revs = await collectWorkItems(client, store, reg, (p) => this.setProgress(p))
      writeJsonAtomic(FILES.events, store) // checkpoint
      const pr = await collectPullRequests(client, store, reg, (p) => this.setProgress(p))

      this.setProgress({ step: 'done', message: 'Calculating results…', done: 0, total: 0 })
      this.prune(store, desired)
      delete store.needsRefresh
      store.lastRunAt = new Date().toISOString()
      writeJsonAtomic(FILES.events, store)
      this.store = store

      const loadedAt = new Date().toISOString()
      this.cache.lastLoaded = loadedAt
      // One snapshot per day: a later refresh on the same day replaces the earlier one
      const last = this.history.snapshots[this.history.snapshots.length - 1]
      if (last && last.loadedAt.slice(0, 10) === loadedAt.slice(0, 10)) this.history.snapshots.pop()
      this.history.snapshots.push({ loadedAt, devStats: {} })
      if (this.history.snapshots.length > MAX_SNAPSHOTS) this.history.snapshots = this.history.snapshots.slice(-MAX_SNAPSHOTS)
      this.rebuild(true)

      const secs = ((Date.now() - started) / 1000).toFixed(1)
      console.log(`✅ Azure ranking updated in ${secs}s — ${revs} revisions, ${pr.prs} PRs (${pr.threadsFetched} thread loads), ${client.requests} requests`)
      this.setProgress({ step: 'done', message: 'Done', done: 0, total: 0 })
    } catch (err) {
      const e = err as { response?: { status: number }; message: string }
      this.error = e.response?.status === 401 || e.response?.status === 203
        ? 'Authentication failed. Please check the PAT token.'
        : e.response?.status === 404
          ? 'Organisation or project not found.'
          : e.message
      console.error('❌ Azure ranking load error:', this.error)
    } finally {
      this.loading = false
    }
  }

  /** Drops events that are no longer needed and moves the store start forward. */
  private prune(store: EventStore, desired: number) {
    const start = Date.parse(store.storeStart)
    if (desired - start < 30 * DAY) return
    for (const [k, e] of Object.entries(store.wi)) if (e[2] < desired) delete store.wi[k]
    for (const [k, pr] of Object.entries(store.prs)) {
      pr.e = pr.e.filter((e) => e[2] >= desired)
      if (pr.e.length === 0) delete store.prs[k]
    }
    store.storeStart = new Date(desired).toISOString()
  }

  /** Recomputes cache, history snapshots and trend from the stored events. */
  private rebuild(persist: boolean) {
    if (!this.store) return
    const prep = prepareEvents(this.store)
    this.prep = prep
    const at = this.cache.lastLoaded ? Date.parse(this.cache.lastLoaded) : Date.now()

    const periods: Record<number, PeriodData> = {}
    for (const days of PERIODS) periods[days] = computePeriod(prep, at, days)
    this.cache = { data: { periods }, lastLoaded: this.cache.lastLoaded ?? new Date(at).toISOString(), scoringVersion: SCORING_VERSION }

    // History: every snapshot recomputed with the current evaluation (retroactive correction).
    // Several loads on the same day collapse into the last one.
    const byDay = new Map<string, string>()
    for (const s of [...this.history.snapshots].sort((a, b) => a.loadedAt.localeCompare(b.loadedAt))) byDay.set(s.loadedAt.slice(0, 10), s.loadedAt)
    const snapshots: HistorySnapshot[] = [...byDay.values()].map((loadedAt) => this.snapshotAt(prep, Date.parse(loadedAt), loadedAt))
    this.history = { scoringVersion: SCORING_VERSION, snapshots }

    // Trend: real loads + computed month ends of the last 12 months
    const points: { at: number; kind: HistoryPoint['kind']; snap: HistorySnapshot }[] =
      snapshots.map((s) => ({ at: Date.parse(s.loadedAt), kind: 'load' as const, snap: s }))
    const now = new Date(at)
    for (let i = 1; i <= 12; i++) {
      const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1) - 1
      if (monthEnd < prep.storeStart + 7 * DAY) continue
      if (points.some((p) => Math.abs(p.at - monthEnd) < 5 * DAY)) continue
      points.push({ at: monthEnd, kind: 'month', snap: this.snapshotAt(prep, monthEnd, new Date(monthEnd).toISOString()) })
    }
    points.sort((a, b) => a.at - b.at)
    const trend = new Map<string, HistoryPoint[]>()
    for (const p of points) {
      for (const [devId, d] of Object.entries(p.snap.devStats)) {
        const list = trend.get(devId) ?? []
        list.push({ loadedAt: p.snap.loadedAt, kind: p.kind, periods: d.periods })
        trend.set(devId, list)
      }
    }
    this.trend = trend

    if (persist) {
      try {
        writeJsonAtomic(FILES.cache, this.cache)
        writeJsonAtomic(FILES.history, this.history)
      } catch (e) {
        console.warn('Azure ranking cache/history could not be saved:', (e as Error).message)
      }
    }
  }

  private snapshotAt(prep: PreparedEvents, at: number, loadedAt: string): HistorySnapshot {
    const devStats: HistorySnapshot['devStats'] = {}
    for (const days of PERIODS) {
      if (!covers(prep, at, days)) continue
      for (const d of computePeriod(prep, at, days).developers) {
        devStats[d.id] ??= { displayName: d.displayName, periods: {} }
        devStats[d.id].periods[days] = { points: d.points, rank: d.rank }
      }
    }
    return { loadedAt, devStats }
  }

  stats(days: number): (PeriodData & { outdated?: boolean }) | null {
    const data = this.cache.data?.periods?.[days]
    if (!data) return null
    // Levels always from the current thresholds
    return {
      ...data,
      levels: buildLevelsForPeriod(days),
      developers: data.developers.map((dev) => ({ ...dev, level: getLevel(dev.points, days) })),
      ...(this.outdated ? { outdated: true } : {}),
    }
  }

  devCount() {
    return this.cache.data?.periods?.[365]?.developers?.length ?? 0
  }

  devHistory(devId: string): HistoryPoint[] {
    if (this.trend.size) return this.trend.get(devId) ?? this.trend.get(devId.toLowerCase()) ?? []
    // Legacy history (before the first refresh with the new evaluation)
    return this.history.snapshots
      .filter((s) => s.devStats[devId])
      .map((s) => ({ loadedAt: s.loadedAt, kind: 'load' as const, periods: s.devStats[devId].periods }))
  }
}

export const rankingService = new RankingService()
rankingService.init()
