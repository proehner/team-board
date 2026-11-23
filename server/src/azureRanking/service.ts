import fs from 'fs'
import { AzureClient } from './azureClient'
import { collectPullRequests, collectWorkItems } from './collect'
import { IdentityRegistry } from './identities'
import {
  PERIODS, SCORING_VERSION, buildLevelsForPeriod, computePeriod, covers, getLevel, prepareEvents, type PreparedEvents,
} from './scoring'
import {
  FILES, HISTORY_VERSION, loadStore, newStore, readJson, writeJsonAtomic,
  type CacheFile, type HistoryFile, type HistoryMonth,
} from './store'
import { buildReport, reportPeriods, type ReportData, type ReportPeriod } from './report'
import { monthEndsBefore } from './time'
import type { AzureConfig, EventStore, PeriodData, Progress } from './types'

const DAY = 86_400_000
/** Number of month-end points in the history */
const HISTORY_MONTHS = 12
/** Longest ranking period: the oldest month-end point needs this many days of events before it */
const MAX_PERIOD_DAYS = Math.max(...PERIODS)

export interface HistoryPoint {
  /** Last day of the month (yyyy-MM-dd) */
  date: string
  periods: Partial<Record<number, { points: number; rank: number }>>
}

class RankingService {
  config: AzureConfig = { organization: '', project: '', pat: '' }
  private store: EventStore | null = null
  private prep: PreparedEvents | null = null
  private cache: CacheFile = { data: null, lastLoaded: null }
  /** devId → month-end points, oldest first */
  private trend = new Map<string, HistoryPoint[]>()

  loading = false
  error: string | null = null
  progress: Progress = { step: '', message: '', repo: '', done: 0, total: 0 }

  init() {
    this.config = { organization: '', project: '', pat: '', ...readJson<Partial<AzureConfig>>(FILES.config) }
    this.cache = readJson<CacheFile>(FILES.cache) ?? { data: null, lastLoaded: null }
    this.store = loadStore()
    if (this.store) {
      const history = readJson<Partial<HistoryFile>>(FILES.history)
      const stale = this.cache.scoringVersion !== SCORING_VERSION
        || history?.version !== HISTORY_VERSION || history?.scoringVersion !== SCORING_VERSION
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

  /**
   * Earliest event date needed: the longest period (365 days) before the oldest month-end point,
   * so every history point is computed from complete data. Results in roughly two years.
   */
  private desiredStoreStart(now: number): number {
    const oldest = monthEndsBefore(now, HISTORY_MONTHS)[0]?.at ?? now
    const start = Math.min(oldest, now) - (MAX_PERIOD_DAYS + 2) * DAY
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

      this.cache.lastLoaded = new Date().toISOString()
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

    // History: one point per month end of the last HISTORY_MONTHS months before the data state,
    // always computed from the events (periods without complete data are left out).
    const months: HistoryMonth[] = monthEndsBefore(at, HISTORY_MONTHS)
      .map((m) => this.monthAt(prep, m.date, m.at))
    const history: HistoryFile = { version: HISTORY_VERSION, scoringVersion: SCORING_VERSION, dataAsOf: this.cache.lastLoaded, months }

    const trend = new Map<string, HistoryPoint[]>()
    for (const m of months) {
      for (const [devId, d] of Object.entries(m.devStats)) {
        const list = trend.get(devId) ?? []
        list.push({ date: m.date, periods: d.periods })
        trend.set(devId, list)
      }
    }
    this.trend = trend

    if (persist) {
      try {
        writeJsonAtomic(FILES.cache, this.cache)
        writeJsonAtomic(FILES.history, history)
      } catch (e) {
        console.warn('Azure ranking cache/history could not be saved:', (e as Error).message)
      }
    }
  }

  private monthAt(prep: PreparedEvents, date: string, at: number): HistoryMonth {
    const devStats: HistoryMonth['devStats'] = {}
    for (const days of PERIODS) {
      if (!covers(prep, at, days)) continue
      for (const d of computePeriod(prep, at, days).developers) {
        devStats[d.id] ??= { displayName: d.displayName, periods: {} }
        devStats[d.id].periods[days] = { points: d.points, rank: d.rank }
      }
    }
    return { date, at: new Date(at).toISOString(), devStats }
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

  /** Report periods that can be computed from the stored events. */
  reportPeriods(): ReportPeriod[] {
    if (!this.prep || !this.cache.lastLoaded) return []
    return reportPeriods(this.prep, Date.parse(this.cache.lastLoaded))
  }

  /** Annual report data for one developer (null: unknown period or no activity in it). */
  report(devId: string, periodKey: string): ReportData | null {
    const period = this.reportPeriods().find((p) => p.key === periodKey)
    if (!period || !this.prep || !this.cache.lastLoaded) return null
    return buildReport(this.prep, devId, period, Date.parse(this.cache.lastLoaded))
  }

  devHistory(devId: string): HistoryPoint[] {
    return this.trend.get(devId) ?? this.trend.get(devId.toLowerCase()) ?? []
  }
}

export const rankingService = new RankingService()
rankingService.init()
