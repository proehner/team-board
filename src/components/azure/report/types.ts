import type { DevStats } from '../shared'

// Mirrors server/src/azureRanking/report.ts

export type ReportArea = 'code' | 'review' | 'work' | 'tickets'
export const REPORT_AREAS: ReportArea[] = ['code', 'review', 'work', 'tickets']

export interface ReportPeriod {
  key:      string
  kind:     'last12' | 'year'
  year?:    number
  from:     string
  to:       string
  fromDate: string
  toDate:   string
  partial:  boolean
}

export interface MetricStat {
  value:      number | null
  median:     number | null
  p25:        number | null
  p75:        number | null
  /** Share of the comparison group with a lower value (0–100) */
  percentile: number | null
}

export interface ReportMonth {
  month: string
  days: number
  points: number
  areas: Record<ReportArea, number>
  prsCompleted: number
  prsReviewed: number
  workItems: number
  groupMedian: number
}

export interface ReportData {
  period: ReportPeriod & { days: number; weeks: number }
  dataAsOf: string
  dev: DevStats
  rank: number
  rankedCount: number
  groupSize: number
  inGroup: boolean
  areas: Record<ReportArea, { points: number; share: number; groupMedianShare: number }>
  metrics: Record<string, MetricStat>
  months: ReportMonth[]
  halves: { firstPerWeek: number; secondPerWeek: number }
  repositories: { name: string; prs: number }[]
  workItemTypes: { type: string; count: number }[]
  collaboration: { reviewedFor: { name: string; count: number }[]; reviewedBy: { name: string; count: number }[] }
}

/** One competency of the developer (from the competency matrix of the current team). */
export interface ReportSkill {
  area:      string
  category:  string | null
  name:      string
  level:     number
  /** Average level of the active team members who rated this skill (> 0) */
  teamAvg:   number | null
  /** Active team members on expert level (4–5), including the developer */
  experts:   number
  /** Only person on expert level in the team */
  knowledgeHolder: boolean
  /** Level 2–3 in a skill the team has at most one expert in */
  growthPotential: boolean
}

export interface ReportCompetencies {
  memberName: string
  skills:     ReportSkill[]
  /** Last change of the developer's competency entries (ISO) */
  lastUpdate: string | null
  teamSize:   number
}

/** Strength or recommendation shown in the report (already localised). */
export interface ReportFinding {
  id:   string
  kind: 'strength' | 'growth'
  text: string
}

export interface ReportOptions {
  collaboration: boolean
  findings:      boolean
  competencies:  boolean
  notes:         string
}

export interface ReportContext {
  data:         ReportData
  competencies: ReportCompetencies | null
  findings:     ReportFinding[]
  options:      ReportOptions
  /** Azure DevOps organisation / project (data source line) */
  source:       string
  createdAt:    Date
}
