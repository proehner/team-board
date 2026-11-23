import type { ElementType } from 'react'
import {
  Lightbulb, Clock, CircleDot, CheckCircle2, XCircle,
  LayoutTemplate, Server, Cpu, Palette, Database, Layers,
} from 'lucide-react'
import type {
  RoadmapFeature, RoadmapStatus, RoadmapPriority,
  RoadmapTicketType, RoadmapTicketArea, HttpMethod, EndpointComplexity,
} from '@/types'
import type { BadgeVariant } from '@/components/ui/Badge'

// ─── Feature status ───────────────────────────────────────────────────────────

export const ROADMAP_STATUSES: RoadmapStatus[] = ['idea', 'planned', 'in-progress', 'done', 'cancelled']

export interface StatusMeta {
  /** German label — only used for exported Markdown documents (UI uses i18n) */
  exportLabel: string
  icon: ElementType
  badge: BadgeVariant
  /** Accent text color */
  text: string
  /** CSS color for dots (e.g. <Chip dotColor/>) */
  dot: string
  dotCls: string
  /** Soft fill + border (timeline cells, gantt bars) */
  soft: string
  border: string
  /** Left accent stripe for compact cards */
  stripe: string
}

export const STATUS_META: Record<RoadmapStatus, StatusMeta> = {
  idea: {
    exportLabel: 'Idee', icon: Lightbulb, badge: 'warning',
    text: 'text-amber-700 dark:text-amber-300', dot: '#f59e0b', dotCls: 'bg-amber-500',
    soft: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30',
    stripe: 'border-l-amber-400 dark:border-l-amber-500',
  },
  planned: {
    exportLabel: 'Geplant', icon: Clock, badge: 'info',
    text: 'text-sky-700 dark:text-sky-300', dot: '#0ea5e9', dotCls: 'bg-sky-500',
    soft: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/30',
    stripe: 'border-l-sky-400 dark:border-l-sky-500',
  },
  'in-progress': {
    exportLabel: 'In Arbeit', icon: CircleDot, badge: 'indigo',
    text: 'text-indigo-700 dark:text-indigo-300', dot: '#6366f1', dotCls: 'bg-indigo-500',
    soft: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/30',
    stripe: 'border-l-indigo-500 dark:border-l-indigo-400',
  },
  done: {
    exportLabel: 'Fertig', icon: CheckCircle2, badge: 'success',
    text: 'text-emerald-700 dark:text-emerald-300', dot: '#10b981', dotCls: 'bg-emerald-500',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30',
    stripe: 'border-l-emerald-500 dark:border-l-emerald-400',
  },
  cancelled: {
    exportLabel: 'Abgebrochen', icon: XCircle, badge: 'default',
    text: 'text-slate-600 dark:text-slate-400', dot: '#94a3b8', dotCls: 'bg-slate-400',
    soft: 'bg-slate-100 dark:bg-slate-800/70', border: 'border-slate-200 dark:border-slate-700',
    stripe: 'border-l-slate-300 dark:border-l-slate-600',
  },
}

// ─── Priority ─────────────────────────────────────────────────────────────────

export const ROADMAP_PRIORITIES: RoadmapPriority[] = ['low', 'medium', 'high', 'critical']

export const PRIORITY_META: Record<RoadmapPriority, { exportLabel: string; dotCls: string; text: string; order: number }> = {
  low:      { exportLabel: 'Niedrig',  dotCls: 'bg-slate-400',  text: 'text-slate-500 dark:text-slate-400',   order: 3 },
  medium:   { exportLabel: 'Mittel',   dotCls: 'bg-sky-500',    text: 'text-sky-700 dark:text-sky-300',       order: 2 },
  high:     { exportLabel: 'Hoch',     dotCls: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', order: 1 },
  critical: { exportLabel: 'Kritisch', dotCls: 'bg-red-500',    text: 'text-red-700 dark:text-red-300',       order: 0 },
}

// ─── Planning completeness ────────────────────────────────────────────────────

export const PLANNING_KEYS = ['goals', 'acceptanceCriteria', 'uiNotes', 'backendNotes', 'technicalNotes', 'risks'] as const
export type PlanningKey = typeof PLANNING_KEYS[number]

export function planningScore(f: Partial<RoadmapFeature>) {
  const filled = PLANNING_KEYS.filter((k) => ((f[k] as string | undefined) ?? '').trim().length > 0).length
  return { filled, total: PLANNING_KEYS.length }
}

/** Fill color for completeness bars */
export function planningBarCls(filled: number, total: number) {
  const pct = total ? filled / total : 0
  if (pct >= 1)   return 'bg-emerald-500'
  if (pct >= 0.5) return 'bg-indigo-500'
  if (pct > 0)    return 'bg-amber-500'
  return 'bg-slate-300 dark:bg-slate-600'
}

// ─── Roadmap tickets (Azure DevOps drafts) ────────────────────────────────────

export const TICKET_TYPES: RoadmapTicketType[] = ['epic', 'user-story', 'task', 'bug']
export const TICKET_AREAS: RoadmapTicketArea[] = ['frontend', 'backend', 'devops', 'design', 'database', 'other']

export const TICKET_TYPE_META: Record<RoadmapTicketType, { exportLabel: string; badge: BadgeVariant }> = {
  epic:         { exportLabel: 'Epic',       badge: 'purple' },
  'user-story': { exportLabel: 'User Story', badge: 'info' },
  task:         { exportLabel: 'Task',       badge: 'default' },
  bug:          { exportLabel: 'Bug',        badge: 'danger' },
}

export const TICKET_AREA_META: Record<RoadmapTicketArea, { exportLabel: string; icon: ElementType }> = {
  frontend: { exportLabel: 'Frontend',  icon: LayoutTemplate },
  backend:  { exportLabel: 'Backend',   icon: Server },
  devops:   { exportLabel: 'DevOps',    icon: Cpu },
  design:   { exportLabel: 'Design',    icon: Palette },
  database: { exportLabel: 'Datenbank', icon: Database },
  other:    { exportLabel: 'Sonstiges', icon: Layers },
}

// ─── Blueprint ────────────────────────────────────────────────────────────────

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

export const METHOD_CLS: Record<HttpMethod, { badge: string; text: string }> = {
  GET:    { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20', text: 'text-emerald-600 dark:text-emerald-400' },
  POST:   { badge: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',                         text: 'text-sky-600 dark:text-sky-400' },
  PUT:    { badge: 'bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',       text: 'text-orange-600 dark:text-orange-400' },
  PATCH:  { badge: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',             text: 'text-amber-600 dark:text-amber-400' },
  DELETE: { badge: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',                         text: 'text-red-600 dark:text-red-400' },
}

export const COMPLEXITIES: EndpointComplexity[] = ['xs', 's', 'm', 'l', 'xl']

export const COMPLEXITY_META: Record<EndpointComplexity, { label: string; text: string }> = {
  xs: { label: 'XS', text: 'text-slate-500 dark:text-slate-400' },
  s:  { label: 'S',  text: 'text-emerald-600 dark:text-emerald-400' },
  m:  { label: 'M',  text: 'text-sky-600 dark:text-sky-400' },
  l:  { label: 'L',  text: 'text-orange-600 dark:text-orange-400' },
  xl: { label: 'XL', text: 'text-red-600 dark:text-red-400' },
}

/** Locale used for date formatting, derived from the i18n language */
export function dateLocale(lang: string) {
  return lang.startsWith('de') ? 'de-DE' : 'en-US'
}
