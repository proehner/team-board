import fs from 'fs'
import path from 'path'
import type { EventStore, PeriodData } from './types'

export const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const FILES = {
  config:  path.join(DATA_DIR, 'azure-ranking.config.json'),
  cache:   path.join(DATA_DIR, 'azure-ranking.cache.json'),
  history: path.join(DATA_DIR, 'azure-ranking.history.json'),
  events:  path.join(DATA_DIR, 'azure-ranking.events.json'),
}

/**
 * 1 → 2: review comments carry thread role + text length, PRs carry title hash + target branch.
 * 2 → 3: acknowledgement-only comments ("ok", "done", "LGTM") are stored with length 0.
 * Older stores are migrated in place: work item data is kept, PR threads are re-fetched on the next refresh.
 */
export const STORE_VERSION = 3

/** Writes JSON atomically (temp file + rename) so a crash can never leave a truncated file. */
export function writeJsonAtomic(file: string, data: unknown) {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, file)
}

export function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch (e) {
    console.warn(`Could not read ${path.basename(file)}:`, (e as Error).message)
    return null
  }
}

export function newStore(storeStart: string): EventStore {
  return { version: STORE_VERSION, storeStart, revisionsToken: null, lastRunAt: null, identities: {}, wi: {}, prs: {} }
}

export function loadStore(): EventStore | null {
  const s = readJson<EventStore>(FILES.events)
  if (!s) return null
  if (s.version >= 1 && s.version < STORE_VERSION) {
    for (const pr of Object.values(s.prs)) pr.f = 0 // → threads are loaded again (comment details)
    s.version = STORE_VERSION
    s.needsRefresh = true
  }
  return s.version === STORE_VERSION ? s : null
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheFile {
  data: { periods: Record<number, PeriodData> } | null
  lastLoaded: string | null
  scoringVersion?: number
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryDevPoint {
  displayName: string
  periods: Partial<Record<number, { points: number; rank: number }>>
}

export interface HistorySnapshot {
  loadedAt: string
  devStats: Record<string, HistoryDevPoint>
}

export interface HistoryFile {
  scoringVersion?: number
  snapshots: HistorySnapshot[]
}

/**
 * Reads the history; if the file is damaged (e.g. truncated by an interrupted write)
 * the load timestamps are recovered — the values are recomputed from the events anyway.
 */
export function loadHistoryTolerant(): HistoryFile {
  if (!fs.existsSync(FILES.history)) return { snapshots: [] }
  const raw = fs.readFileSync(FILES.history, 'utf8')
  try {
    const parsed = JSON.parse(raw) as HistoryFile
    return { scoringVersion: parsed.scoringVersion, snapshots: parsed.snapshots || [] }
  } catch {
    const dates = [...raw.matchAll(/"loadedAt"\s*:\s*"([^"]+)"/g)].map((m) => m[1]).filter((d) => !Number.isNaN(Date.parse(d)))
    console.warn(`Azure ranking history was damaged — recovered ${dates.length} snapshot dates, values will be recomputed.`)
    return { snapshots: [...new Set(dates)].sort().map((loadedAt) => ({ loadedAt, devStats: {} })) }
  }
}
