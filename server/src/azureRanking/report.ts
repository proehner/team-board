import { computePeriod, type PreparedEvents } from './scoring'
import { berlinDate, berlinMonthStart, berlinYearMonth } from './time'
import type { DevStats } from './types'

// ─── Annual report data ───────────────────────────────────────────────────────
//
// Everything a per-developer annual report needs, computed from the same events
// and scoring as the ranking: totals, team comparison, monthly activity, way of
// working (cycle / response times) and collaboration. Texts and recommendations
// are composed in the frontend (localised).

const DAY  = 86_400_000
const HOUR = 3_600_000

export const REPORT_AREAS = {
  code:    ['prsCreated', 'prsCompleted', 'prsPorted'],
  review:  ['prsReviewed', 'approvalsGiven', 'commentsGiven', 'commentReplies'],
  work:    ['backlogItemsCompleted', 'tasksCompleted'],
  tickets: ['ticketsCreated', 'tasksCreated', 'ticketComments'],
} as const
export type ReportArea = keyof typeof REPORT_AREAS
const AREA_KEYS = Object.keys(REPORT_AREAS) as ReportArea[]

const COUNT_FIELDS = [
  'prsCreated', 'prsCompleted', 'prsPorted', 'prsReviewed', 'approvalsGiven', 'commentsGiven', 'commentReplies',
  'workItemsCompleted', 'backlogItemsCompleted', 'tasksCompleted', 'ticketsCreated', 'tasksCreated', 'ticketComments',
] as const

export interface ReportPeriod {
  key:      string
  kind:     'last12' | 'year'
  year?:    number
  from:     string
  to:       string
  /** First / last calendar day (yyyy-MM-dd, Europe/Berlin) */
  fromDate: string
  toDate:   string
  /** Current calendar year that is not over yet */
  partial:  boolean
}

export interface MetricStat {
  value:      number | null
  median:     number | null
  p25:        number | null
  p75:        number | null
  /** Share of the comparison group with a lower value (0–100, ties count half) */
  percentile: number | null
}

export interface ReportData {
  period: ReportPeriod & { days: number; weeks: number }
  dataAsOf: string
  dev: DevStats
  /** Position in the overall ranking of the period */
  rank: number
  rankedCount: number
  /** Comparison group: PR or review activity and active in at least a quarter of the weeks */
  groupSize: number
  inGroup: boolean
  areas: Record<ReportArea, { points: number; share: number; groupMedianShare: number }>
  metrics: Record<string, MetricStat>
  months: {
    month: string
    days: number
    points: number
    areas: Record<ReportArea, number>
    prsCompleted: number
    prsReviewed: number
    workItems: number
    groupMedian: number
  }[]
  halves: { firstPerWeek: number; secondPerWeek: number }
  repositories: { name: string; prs: number }[]
  workItemTypes: { type: string; count: number }[]
  collaboration: { reviewedFor: { name: string; count: number }[]; reviewedBy: { name: string; count: number }[] }
}

const iso = (t: number) => new Date(t).toISOString()

// ─── Periods ──────────────────────────────────────────────────────────────────

/**
 * Selectable report periods: the last 12 complete calendar months and every calendar year
 * whose start is covered by the stored events (the current year up to the data state).
 */
export function reportPeriods(prep: PreparedEvents, dataAsOf: number): ReportPeriod[] {
  const list: ReportPeriod[] = []
  const { year: curYear, month: curMonth } = berlinYearMonth(dataAsOf)

  const lastEnd   = berlinMonthStart(curYear, curMonth)        // = end of the last complete month
  const lastStart = berlinMonthStart(curYear, curMonth - 12)
  if (lastStart >= prep.storeStart - DAY) {
    list.push({ key: 'last12', kind: 'last12', from: iso(lastStart), to: iso(lastEnd), fromDate: berlinDate(lastStart), toDate: berlinDate(lastEnd - 1), partial: false })
  }
  for (let y = curYear; y >= curYear - 5; y--) {
    const start = berlinMonthStart(y, 0)
    const end   = berlinMonthStart(y + 1, 0)
    if (start < prep.storeStart - DAY) break
    const to = Math.min(end, dataAsOf)
    if (to - start < 28 * DAY) continue
    list.push({ key: String(y), kind: 'year', year: y, from: iso(start), to: iso(to), fromDate: berlinDate(start), toDate: berlinDate(to - 1), partial: to < end })
  }
  return list
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function stat(group: (number | null)[], value: number | null): MetricStat {
  const vals = group.filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b)
  const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100)
  let percentile: number | null = null
  if (value !== null && vals.length > 0) {
    const lower = vals.filter((v) => v < value).length
    const equal = vals.filter((v) => v === value).length
    percentile = Math.round((100 * (lower + equal / 2)) / vals.length)
  }
  return { value: round(value), median: round(quantile(vals, 0.5)), p25: round(quantile(vals, 0.25)), p75: round(quantile(vals, 0.75)), percentile }
}

const median = (vals: number[]) => quantile([...vals].sort((a, b) => a - b), 0.5)

const areaPoints = (d: DevStats): Record<ReportArea, number> =>
  Object.fromEntries(AREA_KEYS.map((k) => [k, REPORT_AREAS[k].reduce((s, f) => s + (d.pointsByMetric[f] || 0), 0)])) as Record<ReportArea, number>

/** PR or review activity — prerequisite for the comparison group. */
const developsCode = (d: DevStats) => d.prsCreated + d.prsCompleted + d.prsPorted + d.prsReviewed > 0

/**
 * Comparison group: everyone with PR or review activity who was active in at least a quarter
 * of the weeks of the period (occasional contributors would distort the medians).
 */
const comparableIn = (weeks: number) => (d: DevStats) => developsCode(d) && d.activeWeeks >= Math.max(1, Math.round(weeks / 4))

function addTo<K>(map: Map<K, number[]>, key: K, v: number) {
  const list = map.get(key)
  if (list) list.push(v)
  else map.set(key, [v])
}

// ─── Report ───────────────────────────────────────────────────────────────────

export function buildReport(prep: PreparedEvents, devId: string, period: ReportPeriod, dataAsOf: number): ReportData | null {
  const from = Date.parse(period.from)
  const to   = Date.parse(period.to)
  const days = (to - from) / DAY

  const result = computePeriod(prep, to, days)
  const dev = result.developers.find((d) => d.id === devId)
  if (!dev) return null
  const weekCount  = Math.max(1, Math.round(days / 7))
  const comparable = comparableIn(weekCount)
  const group      = result.developers.filter(comparable)
  const groupIds   = new Set(group.map((d) => d.id))

  // Way of working & collaboration (one pass over the events of the window)
  const created = new Map<string, { u: string; t: number }>()
  for (const e of prep.events) if (e.k === 'prCreated') created.set(e.ref, { u: e.u, t: e.t })
  const cycle    = new Map<string, number[]>()           // author   → hours from creation to merge
  const response = new Map<string, number[]>()           // reviewer → hours from creation to first review
  const authors  = new Map<string, Map<string, number>>() // reviewer → author → reviewed PRs
  const repos    = new Map<string, number>()
  const wiTypes  = new Map<string, number>()
  for (const e of prep.events) {
    if (e.t <= from) continue
    if (e.t > to) break
    if (e.k === 'prCompleted' || e.k === 'prPorted') {
      if (e.u === devId && e.x) repos.set(e.x, (repos.get(e.x) || 0) + 1)
      const c = e.k === 'prCompleted' ? created.get(e.ref) : undefined
      if (c) addTo(cycle, e.u, (e.t - c.t) / HOUR)
    } else if (e.k === 'prReviewed') {
      const c = created.get(e.ref)
      if (!c || c.u === e.u) continue
      addTo(response, e.u, Math.max(0, (e.t - c.t) / HOUR))
      const m = authors.get(e.u) ?? new Map<string, number>()
      m.set(c.u, (m.get(c.u) || 0) + 1)
      authors.set(e.u, m)
    } else if (e.k === 'wiCompleted' && e.u === devId && e.x) {
      wiTypes.set(e.x, (wiTypes.get(e.x) || 0) + 1)
    }
  }

  // Metrics with comparison values
  const weeks = (d: DevStats) => Math.max(1, d.activeWeeks)
  const perWeekArea = (area: ReportArea) => (d: DevStats) => Math.round(areaPoints(d)[area] / weeks(d))
  const derived: Record<string, (d: DevStats) => number | null> = {
    points:              (d) => d.points,
    pointsPerWeek:       (d) => d.pointsPerWeek,
    activeWeeks:         (d) => d.activeWeeks,
    codePerWeek:         perWeekArea('code'),
    reviewPerWeek:       perWeekArea('review'),
    workPerWeek:         perWeekArea('work'),
    ticketsPerWeek:      perWeekArea('tickets'),
    findingsPerReview:   (d) => (d.prsReviewed >= 5 ? d.commentsGiven / d.prsReviewed : null),
    reviewsPerOwnPr:     (d) => (d.prsCompleted + d.prsPorted >= 3 ? d.prsReviewed / (d.prsCompleted + d.prsPorted) : null),
    workItemsPerPr:      (d) => (d.prsCompleted >= 5 ? d.workItemsCompleted / d.prsCompleted : null),
    prCycleHours:        (d) => ((cycle.get(d.id)?.length ?? 0) >= 3 ? median(cycle.get(d.id)!) : null),
    reviewResponseHours: (d) => ((response.get(d.id)?.length ?? 0) >= 5 ? median(response.get(d.id)!) : null),
    distinctAuthors:     (d) => authors.get(d.id)?.size ?? 0,
  }
  for (const f of COUNT_FIELDS) derived[f] = (d) => d[f]
  const metrics: Record<string, MetricStat> = {}
  for (const [key, fn] of Object.entries(derived)) metrics[key] = stat(group.map(fn), fn(dev))

  // Areas: points and share of own points, compared with the group's median share
  const devAreas = areaPoints(dev)
  const areas = Object.fromEntries(AREA_KEYS.map((k) => {
    const shares = group.filter((d) => d.points > 0).map((d) => areaPoints(d)[k] / d.points)
    return [k, {
      points: devAreas[k],
      share: dev.points > 0 ? Math.round((1000 * devAreas[k]) / dev.points) / 10 : 0,
      groupMedianShare: Math.round(1000 * (median(shares) ?? 0)) / 10,
    }]
  })) as ReportData['areas']

  // Calendar months (Europe/Berlin)
  const months: ReportData['months'] = []
  let { year, month } = berlinYearMonth(from + HOUR)
  for (let guard = 0; guard < 24; guard++, month++) {
    const mStart = Math.max(from, berlinMonthStart(year, month))
    const mEnd   = Math.min(to, berlinMonthStart(year, month + 1))
    if (mStart >= to) break
    if (mEnd - mStart < DAY) continue
    const r = computePeriod(prep, mEnd, (mEnd - mStart) / DAY)
    const d = r.developers.find((x) => x.id === devId)
    // Median of the comparison group in this month (members without activity count as 0)
    const byId = new Map(r.developers.map((x) => [x.id, x.points]))
    const mGroup = [...groupIds].map((id) => byId.get(id) ?? 0)
    const ym = berlinYearMonth(mStart + HOUR)
    months.push({
      month: `${ym.year}-${String(ym.month + 1).padStart(2, '0')}`,
      days: Math.round((mEnd - mStart) / DAY),
      points: d?.points ?? 0,
      areas: d ? areaPoints(d) : { code: 0, review: 0, work: 0, tickets: 0 },
      prsCompleted: d?.prsCompleted ?? 0,
      prsReviewed: d?.prsReviewed ?? 0,
      workItems: d?.workItemsCompleted ?? 0,
      groupMedian: Math.round(median(mGroup) ?? 0),
    })
  }

  // Trend: points per active week in the first vs. the second half
  const half = days / 2
  const firstHalf  = computePeriod(prep, from + half * DAY, half).developers.find((d) => d.id === devId)
  const secondHalf = computePeriod(prep, to, half).developers.find((d) => d.id === devId)

  const name = (u: string) => prep.identities[u]?.n || u
  const top = (entries: [string, number][]) => entries.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([u, count]) => ({ name: name(u), count }))
  const reviewedBy = new Map<string, number>()
  for (const [reviewer, m] of authors) {
    const n = m.get(devId)
    if (n && reviewer !== devId) reviewedBy.set(reviewer, n)
  }

  return {
    period: { ...period, days: Math.round(days), weeks: weekCount },
    dataAsOf: iso(dataAsOf),
    dev,
    rank: dev.rank,
    rankedCount: result.developers.length,
    groupSize: group.length,
    inGroup: comparable(dev),
    areas,
    metrics,
    months,
    halves: { firstPerWeek: firstHalf?.pointsPerWeek ?? 0, secondPerWeek: secondHalf?.pointsPerWeek ?? 0 },
    repositories: [...repos].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, prs]) => ({ name, prs })),
    workItemTypes: [...wiTypes].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count })),
    collaboration: { reviewedFor: top([...(authors.get(devId) ?? new Map())]), reviewedBy: top([...reviewedBy]) },
  }
}
