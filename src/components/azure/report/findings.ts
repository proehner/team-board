import type { TFunction } from 'i18next'
import type { ReportCompetencies, ReportData, ReportFinding } from './types'

// ─── Strengths & recommendations ──────────────────────────────────────────────
//
// Rule based and deliberately neutral: every statement names the underlying numbers,
// comparisons use "per active week" values (absences don't count against anyone) and
// need a comparison group of a meaningful size. Texts: azureReport.findings.*

const MIN_GROUP = 5
const MAX_PER_KIND = 5

export function formatNumber(n: number, locale: string, digits = 0) {
  return n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** "19 Std." / "4,3 Tage" */
export function formatDuration(hours: number, t: TFunction, locale: string) {
  return hours < 48
    ? t('azureReport.unit.hours', { value: formatNumber(Math.round(hours), locale) })
    : t('azureReport.unit.days', { value: formatNumber(hours / 24, locale, 1) })
}

const listNames = (names: string[], t: TFunction) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${t('azureReport.and')} ${names[names.length - 1]}`

export function buildFindings(r: ReportData, comp: ReportCompetencies | null, t: TFunction, locale: string): ReportFinding[] {
  const m = r.metrics
  const d = r.dev
  const num = (v: number | null | undefined, digits = 0) => formatNumber(v ?? 0, locale, digits)
  const dur = (v: number | null | undefined) => formatDuration(v ?? 0, t, locale)
  const pct = (key: string) => m[key]?.percentile ?? null
  const compare = r.groupSize >= MIN_GROUP
  const high = (key: string, threshold = 75) => compare && (pct(key) ?? 0) >= threshold && m[key]?.value !== null
  const low  = (key: string, threshold = 25) => compare && pct(key) !== null && pct(key)! <= threshold

  const strengths: { id: string; weight: number; text: string }[] = []
  const growth:    { id: string; weight: number; text: string }[] = []
  const S = (id: string, weight: number, params: Record<string, unknown> = {}) =>
    strengths.push({ id, weight, text: t(`azureReport.findings.${id}`, params) })
  const G = (id: string, weight: number, params: Record<string, unknown> = {}) =>
    growth.push({ id, weight, text: t(`azureReport.findings.${id}`, params) })

  // ── Strengths ──
  if (high('reviewPerWeek')) S('sReviews', pct('reviewPerWeek')!, { reviews: num(d.prsReviewed), pct: pct('reviewPerWeek') })
  if (high('findingsPerReview') && d.prsReviewed >= 10)
    S('sReviewDepth', pct('findingsPerReview')!, { value: num(m.findingsPerReview.value, 1), median: num(m.findingsPerReview.median, 1) })
  if (high('codePerWeek')) S('sCode', pct('codePerWeek')!, { prs: num(d.prsCompleted), pct: pct('codePerWeek') })
  if (high('workPerWeek')) S('sWork', pct('workPerWeek')!, { backlog: num(d.backlogItemsCompleted), tasks: num(d.tasksCompleted) })
  if (high('ticketsPerWeek')) S('sTickets', pct('ticketsPerWeek')! - 5, { tickets: num(d.ticketsCreated), discussions: num(d.ticketComments) })
  if (compare && m.reviewResponseHours?.value !== null && (pct('reviewResponseHours') ?? 100) <= 25)
    S('sResponse', 100 - pct('reviewResponseHours')!, { value: dur(m.reviewResponseHours.value), median: dur(m.reviewResponseHours.median) })
  if (high('distinctAuthors') && d.prsReviewed >= 10) S('sCollaboration', pct('distinctAuthors')! - 10, { n: num(m.distinctAuthors.value) })
  if (d.activeWeeks >= Math.round(r.period.weeks * 0.85))
    S('sContinuity', 60, { active: d.activeWeeks, weeks: r.period.weeks })
  const { firstPerWeek: h1, secondPerWeek: h2 } = r.halves
  if (h1 > 0 && h2 >= h1 * 1.2) S('sTrendUp', 65, { pct: Math.round((h2 / h1 - 1) * 100) })
  const expertSkills = comp?.skills.filter((s) => s.level >= 4).map((s) => s.name) ?? []
  if (expertSkills.length > 0) {
    S(expertSkills.length > 4 ? 'sExpertiseMany' : 'sExpertise', 70, { skills: listNames(expertSkills.slice(0, 4), t), count: expertSkills.length })
  }

  // ── Recommendations ──
  const ownPrs = d.prsCompleted + d.prsPorted
  if (low('reviewsPerOwnPr') && ownPrs >= 5)
    G('gMoreReviews', 100 - pct('reviewsPerOwnPr')!, { reviews: num(d.prsReviewed), prs: num(ownPrs), value: num(m.reviewsPerOwnPr.value, 1), median: num(m.reviewsPerOwnPr.median, 1) })
  if (low('findingsPerReview') && d.prsReviewed >= 10)
    G('gReviewDepth', 100 - pct('findingsPerReview')!, { value: num(m.findingsPerReview.value, 1), median: num(m.findingsPerReview.median, 1) })
  if (low('codePerWeek', 20) && (pct('reviewPerWeek') ?? 0) >= 50)
    G('gMoreCode', 100 - pct('codePerWeek')!, { codeShare: num(r.areas.code.share), reviewShare: num(r.areas.review.share), groupShare: num(r.areas.code.groupMedianShare) })
  if (compare && m.prCycleHours?.value !== null && (pct('prCycleHours') ?? 0) >= 75)
    G('gCycleTime', pct('prCycleHours')!, { value: dur(m.prCycleHours.value), median: dur(m.prCycleHours.median) })
  if (compare && m.reviewResponseHours?.value !== null && (pct('reviewResponseHours') ?? 0) >= 75)
    G('gResponse', pct('reviewResponseHours')!, { value: dur(m.reviewResponseHours.value), median: dur(m.reviewResponseHours.median) })
  if (low('workItemsPerPr', 20) && d.prsCompleted >= 10)
    G('gWorkItems', 100 - pct('workItemsPerPr')!, { items: num(d.workItemsCompleted), prs: num(d.prsCompleted) })
  if (low('ticketsPerWeek', 20)) G('gDiscussion', 60 - pct('ticketsPerWeek')!)
  if (low('distinctAuthors', 20) && d.prsReviewed >= 10)
    G('gReviewBreadth', 100 - pct('distinctAuthors')!, { n: num(m.distinctAuthors.value), median: num(m.distinctAuthors.median) })
  if (h1 > 0 && h2 <= h1 * 0.75) G('gTrendDown', 55, { pct: Math.round((1 - h2 / h1) * 100) })

  if (comp) {
    const holders = comp.skills.filter((s) => s.knowledgeHolder).map((s) => s.name)
    if (holders.length) G('gShareKnowledge', 80, { skills: listNames(holders.slice(0, 4), t) })
    const potential = comp.skills.filter((s) => s.growthPotential).sort((a, b) => b.level - a.level).map((s) => s.name)
    if (potential.length) G('gGrowSkills', 70, { skills: listNames(potential.slice(0, 3), t) })
    const periodEnd = Date.parse(r.period.to)
    if (comp.lastUpdate && periodEnd - Date.parse(comp.lastUpdate) > 365 * 86_400_000)
      G('gUpdateSkills', 40, { date: new Date(comp.lastUpdate).toLocaleDateString(locale) })
  }
  if (growth.length === 0) G('gNone', 0)

  const pick = (list: typeof strengths, kind: ReportFinding['kind']): ReportFinding[] =>
    list.sort((a, b) => b.weight - a.weight).slice(0, MAX_PER_KIND).map(({ id, text }) => ({ id, kind, text }))
  return [...pick(strengths, 'strength'), ...pick(growth, 'growth')]
}
