import i18n from '@/i18n'
import {
  GitPullRequest, GitMerge, MessageSquareCode, ScanEye, ThumbsUp, CircleCheckBig, ListChecks, FilePlus, ListPlus, MessagesSquare,
  Medal, Award, Gem, Crown, Target, Zap, PartyPopper, ScanSearch, Eye, CheckCheck, Hammer, Dumbbell,
  FileText, Ticket, Lightbulb, Megaphone, Sparkles, Trophy, type LucideIcon,
} from 'lucide-react'
import type { StatTone } from '@/components/ui/StatCard'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AzBadge  { id: string; name: string; icon: string; desc: string }
export interface Level    { name: string; icon: string; color: string; min: number; next: number | null }
export interface LevelDef { name: string; icon: string; color: string; min: number; max: number | null }

/** Scored activities (field names of DevStats). */
export type MetricField =
  | 'prsCreated' | 'prsCompleted' | 'prsReviewed' | 'approvalsGiven' | 'commentsGiven'
  | 'backlogItemsCompleted' | 'tasksCompleted' | 'ticketsCreated' | 'tasksCreated' | 'ticketComments'

/** Uncapped counterparts of capped metrics. */
export type RawField = 'commentsGivenRaw' | 'ticketsCreatedRaw' | 'tasksCreatedRaw' | 'ticketCommentsRaw'

export interface DevStats extends Record<MetricField, number>, Record<RawField, number> {
  id:                 string
  displayName:        string
  uniqueName:         string
  repositories:       string[]
  /** backlogItemsCompleted + tasksCompleted */
  workItemsCompleted: number
  points:             number
  /** Authoritative points per metric (sum = points). Missing in legacy caches. */
  pointsByMetric?:    Partial<Record<MetricField, number>>
  /** Weeks with at least one counted activity (0 = unknown / legacy cache). */
  activeWeeks:        number
  pointsPerWeek:      number
  badges:             AzBadge[]
  level:              Level
  rank:               number
}

export interface PeriodTotals {
  prs: number; prsCompleted: number; reviews: number; approvals: number; workItems: number
  /** raw counts */
  comments: number; ticketsCreated: number; tasksCreated: number; ticketComments: number
}

export type LimitKey = 'prCommentsPerPr' | 'ticketsPerDay' | 'tasksPerDay'

export interface PeriodData {
  developers:  DevStats[]
  totals:      PeriodTotals
  fromDate: string
  toDate:   string
  days:     number
  scoring:  Record<string, number>
  limits:   Partial<Record<LimitKey, number>>
  levels:   LevelDef[]
  scoringVersion?: number
  /** Legacy cache from before the current evaluation logic → needs one refresh. */
  outdated?: boolean
}

export interface CacheStatus {
  loading:    boolean
  lastLoaded: string | null
  hasData:    boolean
  outdated?:  boolean
  error:      string | null
  devCount:   number
  progress:   { step: string; message: string; repo: string; done: number; total: number }
}

export interface ConfigStatus { configured: boolean; organization: string; project: string }

export interface DevHistorySnapshot {
  loadedAt: string
  /** 'load' = real data refresh, 'month' = value computed for a month end */
  kind?: 'load' | 'month'
  periods: Partial<Record<number, { points: number; rank: number }>>
}

type IconType = LucideIcon

// ─── Metric definitions ───────────────────────────────────────────────────────

export type MetricGroup = 'code' | 'review' | 'work' | 'tickets'

export const METRIC_GROUPS: { key: MetricGroup; tKey: string }[] = [
  { key: 'code',    tKey: 'groupCode'    },
  { key: 'review',  tKey: 'groupReview'  },
  { key: 'work',    tKey: 'groupWork'    },
  { key: 'tickets', tKey: 'groupTickets' },
]

export interface MetricDef {
  field:       MetricField
  group:       MetricGroup
  /** Label (azureRanking.*) */
  tKey:        string
  /** Short label for category pills / column headers */
  catTKey:     string
  /** Key in PeriodData.scoring */
  scoringKey:  string
  /** Label in the scoring table ("per action") */
  scoringTKey: string
  /** Uncapped count, if a cap applies */
  rawField?:   RawField
  /** Cap description: limit value from PeriodData.limits (or fixed rule) + label key */
  limit?:      { key?: LimitKey; tKey: string }
  /** Data color (bars / dots) that works on light and dark backgrounds */
  color:       string
  icon:        IconType
  tone:        StatTone
}

/** One entry per scored activity, ordered by group. */
export const BREAKDOWN_DEFS: MetricDef[] = [
  { field: 'prsCreated',            group: 'code',    tKey: 'prsCreated',       catTKey: 'prsCreated',        scoringKey: 'prCreated',            scoringTKey: 'prCreatedScoring',            color: '#6366f1', icon: GitPullRequest, tone: 'indigo'  },
  { field: 'prsCompleted',          group: 'code',    tKey: 'prsMerged',        catTKey: 'prsMerged',         scoringKey: 'prCompleted',          scoringTKey: 'prMergedScoring',             color: '#8b5cf6', icon: GitMerge,       tone: 'violet'  },
  { field: 'prsReviewed',           group: 'review',  tKey: 'prsReviewed',      catTKey: 'catPrReviews',      scoringKey: 'prReviewed',           scoringTKey: 'prReviewedScoring',           color: '#0ea5e9', icon: ScanEye,        tone: 'sky'     },
  { field: 'approvalsGiven',        group: 'review',  tKey: 'prApprovals',      catTKey: 'catApprovals',      scoringKey: 'prApproved',           scoringTKey: 'prApprovedScoring',           color: '#14b8a6', icon: ThumbsUp,       tone: 'sky'     },
  { field: 'commentsGiven',         group: 'review',  tKey: 'reviewComments',   catTKey: 'catReviewComments', scoringKey: 'prComment',            scoringTKey: 'prReviewCommentScoring',      color: '#3b82f6', icon: MessageSquareCode, tone: 'sky',
    rawField: 'commentsGivenRaw',  limit: { key: 'prCommentsPerPr', tKey: 'limitPerPr' } },
  { field: 'backlogItemsCompleted', group: 'work',    tKey: 'backlogItemsDone', catTKey: 'catBacklogDone',    scoringKey: 'backlogItemCompleted', scoringTKey: 'backlogItemCompletedScoring', color: '#10b981', icon: CircleCheckBig, tone: 'emerald' },
  { field: 'tasksCompleted',        group: 'work',    tKey: 'tasksDone',        catTKey: 'catTasksDone',      scoringKey: 'taskCompleted',        scoringTKey: 'taskCompletedScoring',        color: '#84cc16', icon: ListChecks,     tone: 'emerald' },
  { field: 'ticketsCreated',        group: 'tickets', tKey: 'ticketsCreated',   catTKey: 'ticketsCreated',    scoringKey: 'ticketCreated',        scoringTKey: 'ticketCreatedScoring',        color: '#f59e0b', icon: FilePlus,       tone: 'amber',
    rawField: 'ticketsCreatedRaw', limit: { key: 'ticketsPerDay',   tKey: 'limitPerDay' } },
  { field: 'tasksCreated',          group: 'tickets', tKey: 'tasksCreatedFull', catTKey: 'tasksCreated',      scoringKey: 'taskCreated',          scoringTKey: 'taskCreatedScoring2',         color: '#f97316', icon: ListPlus,       tone: 'amber',
    rawField: 'tasksCreatedRaw',   limit: { key: 'tasksPerDay',     tKey: 'limitPerDay' } },
  { field: 'ticketComments',        group: 'tickets', tKey: 'ticketDiscussions', catTKey: 'catDiscussions',   scoringKey: 'ticketComment',        scoringTKey: 'ticketDiscussionScoring',     color: '#ec4899', icon: MessagesSquare, tone: 'rose',
    rawField: 'ticketCommentsRaw', limit: { tKey: 'limitPerTicketDay' } },
]

export const METRIC_FIELDS = BREAKDOWN_DEFS.map((b) => b.field)

export const METRIC_BY_FIELD = Object.fromEntries(BREAKDOWN_DEFS.map((b) => [b.field, b])) as Record<MetricField, MetricDef>

export const CATEGORY_DEFS: { key: 'points' | MetricField; tKey: string; icon: IconType }[] = [
  { key: 'points', tKey: 'overall', icon: Trophy },
  ...BREAKDOWN_DEFS.map((b) => ({ key: b.field, tKey: b.catTKey, icon: b.icon })),
]

export type CategoryKey = 'points' | MetricField | 'custom'

/** Stats shown compactly per developer in the leaderboard. */
export const ROW_STATS: { key: MetricField; tKey: string }[] = [
  { key: 'prsCompleted',          tKey: 'statMerged'    },
  { key: 'prsReviewed',           tKey: 'statReviews'   },
  { key: 'backlogItemsCompleted', tKey: 'statBacklog'   },
  { key: 'tasksCompleted',        tKey: 'statTasks'     },
  { key: 'ticketsCreated',        tKey: 'statTickets'   },
]

export const PERIODS = ['7', '30', '90', '365'] as const
export type PeriodValue = typeof PERIODS[number]

/** Ranking mode: total points or points per active week. */
export type RankMode = 'total' | 'perWeek'

// ─── Levels / ranks / badges ──────────────────────────────────────────────────

export const LEVEL_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']

const LEVEL_STYLES: Record<string, { badge: string; bar: string; icon: IconType }> = {
  Bronze:   { badge: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/25', bar: 'bg-orange-400',  icon: Medal },
  Silver:   { badge: 'bg-slate-100 text-slate-600 ring-slate-400/30 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-500/30',     bar: 'bg-slate-400',   icon: Medal },
  Gold:     { badge: 'bg-amber-50 text-amber-700 ring-amber-500/30 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25',       bar: 'bg-amber-400',   icon: Medal },
  Platinum: { badge: 'bg-violet-50 text-violet-700 ring-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/25', bar: 'bg-violet-400',  icon: Award },
  Diamond:  { badge: 'bg-sky-50 text-sky-700 ring-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/25',                 bar: 'bg-sky-400',     icon: Gem   },
}
const FALLBACK_LEVEL_STYLE = {
  badge: 'bg-slate-100 text-slate-600 ring-slate-400/30 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/40',
  bar: 'bg-indigo-500',
  icon: Award,
}

export function levelStyle(name: string) {
  return LEVEL_STYLES[name] ?? FALLBACK_LEVEL_STYLE
}

export function getNextLevelName(currentName: string) {
  const idx = LEVEL_ORDER.indexOf(currentName)
  return LEVEL_ORDER[idx + 1] ?? ''
}

/** Gold / silver / bronze accents for the top 3. */
export const RANK_STYLES = [
  {
    chip:   'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/30',
    ring:   'ring-amber-400 dark:ring-amber-400/80',
    accent: 'from-amber-300 via-amber-400 to-amber-500',
    value:  'text-amber-600 dark:text-amber-300',
    border: 'border-l-amber-400',
    icon:   Crown,
  },
  {
    chip:   'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-500/40',
    ring:   'ring-slate-300 dark:ring-slate-500',
    accent: 'from-slate-200 via-slate-300 to-slate-400 dark:from-slate-500 dark:via-slate-400 dark:to-slate-500',
    value:  'text-slate-600 dark:text-slate-300',
    border: 'border-l-slate-300 dark:border-l-slate-500',
    icon:   Medal,
  },
  {
    chip:   'bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30',
    ring:   'ring-orange-400 dark:ring-orange-400/80',
    accent: 'from-orange-300 via-orange-400 to-orange-500',
    value:  'text-orange-600 dark:text-orange-300',
    border: 'border-l-orange-400',
    icon:   Medal,
  },
]

const BADGE_ICONS: Record<string, IconType> = {
  first_pr:       Target,
  pr_creator:     GitPullRequest,
  pr_machine:     Zap,
  merger:         PartyPopper,
  reviewer:       ScanSearch,
  senior_rev:     Eye,
  approver:       CheckCheck,
  worker:         Hammer,
  powerworker:    Dumbbell,
  ticket_starter: FileText,
  ticket_master:  Ticket,
  commentator:    Lightbulb,
  disc_king:      Megaphone,
  all_rounder:    Sparkles,
}

export function badgeIcon(id: string): IconType {
  return BADGE_ICONS[id] ?? Award
}

/** Localized badge name/description (the server only sends English texts). */
export function badgeText(b: AzBadge): { name: string; desc: string } {
  return {
    name: i18n.t(`azureRanking.badges.${b.id}.name`, { defaultValue: b.name }),
    desc: i18n.t(`azureRanking.badges.${b.id}.desc`, { defaultValue: b.desc }),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#14b8a6', '#10b981', '#f59e0b',
  '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#a855f7',
  '#06b6d4', '#84cc16', '#e11d48', '#3b82f6', '#d946ef',
]

export function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

/** Name normalized for initials: "Project Collection Build Service (kendox)" → "Project Collection Build Service kendox". */
export function avatarName(name: string) {
  return name.replace(/[._@()[\]{}\\/]+/g, ' ').replace(/\s+/g, ' ').trim() || name
}

export function locale() {
  return i18n.language === 'de' ? 'de-DE' : 'en-US'
}

export function fmt(n: number) { return Number(n).toLocaleString(locale()) }

export function progressPercent(dev: DevStats) {
  const { level } = dev
  if (!level.next) return 100
  return Math.min(100, Math.round(((dev.points - level.min) / (level.next - level.min)) * 100))
}

/** Points a developer earned for one metric — server value (`pointsByMetric`), fallback count × weight. */
export function metricPoints(dev: DevStats, def: MetricDef, scoring: Record<string, number>): number {
  const p = dev.pointsByMetric?.[def.field]
  return typeof p === 'number' ? p : (dev[def.field] || 0) * (scoring[def.scoringKey] || 0)
}

export function computeCustomScore(dev: DevStats, scoring: Record<string, number>, enabled: Set<string>): number {
  return Math.round(BREAKDOWN_DEFS.reduce((sum, b) => (enabled.has(b.field) ? sum + metricPoints(dev, b, scoring) : sum), 0))
}

/** The per-week mode only makes sense for point based rankings. */
export function supportsPerWeek(category: CategoryKey) {
  return category === 'points' || category === 'custom'
}

/** Value a developer is ranked by in the given category / mode (mode must already be resolved by the caller). */
export function rankingValue(
  dev: DevStats, category: CategoryKey, mode: RankMode, scoring: Record<string, number>, enabled: Set<string>,
): number {
  const perWeek = mode === 'perWeek' && supportsPerWeek(category)
  if (category === 'custom') {
    const v = computeCustomScore(dev, scoring, enabled)
    return perWeek ? Math.round(v / Math.max(1, dev.activeWeeks)) : v
  }
  if (category === 'points') return perWeek ? dev.pointsPerWeek : dev.points
  return dev[category] || 0
}

export function sortedDevs(
  devs: DevStats[],
  category: CategoryKey,
  mode: RankMode = 'total',
  scoring: Record<string, number> = {},
  enabled: Set<string> = new Set(),
): DevStats[] {
  const val = new Map(devs.map((d) => [d.id, rankingValue(d, category, mode, scoring, enabled)]))
  return [...devs].sort((a, b) =>
    (val.get(b.id)! - val.get(a.id)!) || (b.points - a.points) || a.displayName.localeCompare(b.displayName),
  )
}

/** Max. number of weeks in a period (= upper bound of activeWeeks). */
export function weeksInPeriod(days: number) {
  return Math.max(1, Math.ceil(days / 7))
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Fills fields that are missing in legacy caches (before the current evaluation logic) with 0,
 * so the UI never has to deal with `undefined` counts.
 */
export function normalizePeriodData(raw: PeriodData): PeriodData {
  const developers = (raw.developers ?? []).map((d) => {
    const out: DevStats = { ...d, repositories: d.repositories ?? [], badges: d.badges ?? [] }
    for (const f of METRIC_FIELDS) out[f] = num(d[f])
    for (const b of BREAKDOWN_DEFS) {
      if (b.rawField) out[b.rawField] = typeof d[b.rawField] === 'number' ? d[b.rawField] : out[b.field]
    }
    out.workItemsCompleted = num(d.workItemsCompleted) || out.backlogItemsCompleted + out.tasksCompleted
    out.points        = num(d.points)
    out.activeWeeks   = num(d.activeWeeks)
    out.pointsPerWeek = num(d.pointsPerWeek)
    return out
  })
  const tt: Partial<PeriodTotals> = raw.totals ?? {}
  // Older caches lack some totals → derive them from the developers (the server sums them the same way).
  const total = (v: number | undefined, field: MetricField) => (typeof v === 'number' ? v : sumField(developers, field))
  return {
    ...raw,
    developers,
    totals: {
      prs: total(tt.prs, 'prsCreated'), prsCompleted: total(tt.prsCompleted, 'prsCompleted'),
      reviews: total(tt.reviews, 'prsReviewed'), approvals: total(tt.approvals, 'approvalsGiven'),
      workItems: num(tt.workItems), comments: num(tt.comments), ticketsCreated: num(tt.ticketsCreated),
      tasksCreated: num(tt.tasksCreated), ticketComments: num(tt.ticketComments),
    },
    scoring: raw.scoring ?? {},
    limits:  raw.limits ?? {},
    levels:  raw.levels ?? [],
  }
}

/** Sum of a metric over all developers (for KPIs the server does not total separately). */
export function sumField(devs: DevStats[], field: MetricField) {
  return devs.reduce((s, d) => s + (d[field] || 0), 0)
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('teamlead_token')
  const res   = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...opts,
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error || `HTTP ${res.status}`), json)
  return json as T
}
