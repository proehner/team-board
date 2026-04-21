import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Map, ChevronRight, Tag, Calendar, Layers,
  Circle, CheckCircle2, XCircle, Lightbulb, Clock,
  LayoutList, CalendarDays, Users, TrendingUp,
  Loader2, AlertCircle,
} from 'lucide-react'
import { useStore } from '@/store'
import type { RoadmapFeature, RoadmapStatus, RoadmapPriority, RoadmapTicketArea } from '@/types'

// ─── Shared config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  idea:         { label: 'Idee',        icon: Lightbulb,    color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700' },
  planned:      { label: 'Geplant',     icon: Clock,        color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30',     border: 'border-blue-300 dark:border-blue-700' },
  'in-progress':{ label: 'In Arbeit',   icon: Circle,       color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300 dark:border-indigo-700' },
  done:         { label: 'Fertig',      icon: CheckCircle2, color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30',   border: 'border-green-300 dark:border-green-700' },
  cancelled:    { label: 'Abgebrochen', icon: XCircle,      color: 'text-slate-500',                       bg: 'bg-slate-100 dark:bg-slate-800',       border: 'border-slate-300 dark:border-slate-600' },
}

const PRIORITY_CONFIG: Record<RoadmapPriority, { label: string; color: string }> = {
  low:      { label: 'Niedrig',  color: 'text-slate-500' },
  medium:   { label: 'Mittel',   color: 'text-blue-600 dark:text-blue-400' },
  high:     { label: 'Hoch',     color: 'text-orange-600 dark:text-orange-400' },
  critical: { label: 'Kritisch', color: 'text-red-600 dark:text-red-400' },
}

const ALL_STATUSES: RoadmapStatus[] = ['idea', 'planned', 'in-progress', 'done', 'cancelled']
const PLANNING_SECTIONS = ['goals', 'acceptanceCriteria', 'uiNotes', 'backendNotes', 'technicalNotes', 'risks'] as const

// ─── Planning completeness helper ─────────────────────────────────────────────

function planningScore(f: RoadmapFeature) {
  const filled = PLANNING_SECTIONS.filter((k) => (f[k] as string).trim().length > 0).length
  return { filled, total: PLANNING_SECTIONS.length }
}

function CompletenessBar({ feature, size = 'sm' }: { feature: RoadmapFeature; size?: 'sm' | 'lg' }) {
  const { filled, total } = planningScore(feature)
  const pct = (filled / total) * 100
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
  if (size === 'lg') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-medium tabular-nums ${pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
          {filled}/{total}
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5" title={`Planungsfortschritt: ${filled}/${total} Abschnitte ausgefüllt`}>
      {PLANNING_SECTIONS.map((_, i) => (
        <div
          key={i}
          className={`w-1 h-3 rounded-sm ${i < filled ? color : 'bg-slate-200 dark:bg-slate-700'}`}
        />
      ))}
    </div>
  )
}

// ─── Create Feature Modal ─────────────────────────────────────────────────────

interface CreateModalProps { onClose: () => void; onCreated: (id: string) => void }

function CreateFeatureModal({ onClose, onCreated }: CreateModalProps) {
  const { t } = useTranslation()
  const addRoadmapFeature = useStore((s) => s.addRoadmapFeature)
  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [status, setStatus]     = useState<RoadmapStatus>('idea')
  const [priority, setPriority] = useState<RoadmapPriority>('medium')
  const [category, setCategory] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError(t('roadmap.titleRequired')); return }
    setSaving(true)
    try {
      const id = await addRoadmapFeature({ title: title.trim(), description, status, priority, category: category.trim() || undefined })
      onCreated(id)
    } catch (err) { setError(String(err)); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('roadmap.newFeature')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.featureTitle')} *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('roadmap.featureTitlePlaceholder')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.shortDescription')}</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder={t('roadmap.shortDescriptionPlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as RoadmapStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.priority')}</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as RoadmapPriority)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {(['low', 'medium', 'high', 'critical'] as RoadmapPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('roadmap.category')}</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('roadmap.categoryPlaceholder')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? t('common.save') + '…' : t('roadmap.createFeature')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Feature Card (shared between list and timeline) ─────────────────────────

function FeatureCard({ feature, onClick, compact = false }: { feature: RoadmapFeature; onClick: () => void; compact?: boolean }) {
  const sc = STATUS_CONFIG[feature.status]
  const StatusIcon = sc.icon
  if (compact) {
    return (
      <button onClick={onClick}
        className={`w-full text-left px-2.5 py-2 rounded-lg border ${sc.border} ${sc.bg} hover:brightness-95 transition-all group`}>
        <p className={`text-xs font-medium truncate ${sc.color}`}>{feature.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <CompletenessBar feature={feature} />
          {feature.category && (
            <span className="text-xs text-slate-400 truncate">{feature.category}</span>
          )}
        </div>
      </button>
    )
  }
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
              <StatusIcon className="w-3 h-3" />
              {sc.label}
            </span>
            {feature.category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <Layers className="w-3 h-3" />
                {feature.category}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {feature.title}
          </h3>
          {feature.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{feature.description}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className={`text-xs font-medium ${PRIORITY_CONFIG[feature.priority].color}`}>
          ▲ {PRIORITY_CONFIG[feature.priority].label}
        </span>
        {(feature.targetYear || feature.targetVersion) && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            {feature.targetVersion && <span>{feature.targetVersion}</span>}
            {feature.targetYear && (
              <span>{feature.targetYear}{feature.targetQuarter ? ` Q${feature.targetQuarter}` : ''}</span>
            )}
          </span>
        )}
        {feature.tags.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Tag className="w-3 h-3" />
            {feature.tags.slice(0, 2).join(', ')}{feature.tags.length > 2 && ` +${feature.tags.length - 2}`}
          </span>
        )}
        <div className="ml-auto">
          <CompletenessBar feature={feature} />
        </div>
      </div>
    </button>
  )
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ features, onFeatureClick }: { features: RoadmapFeature[]; onFeatureClick: (id: string) => void }) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1, currentYear + 2]
  const quarters = [1, 2, 3, 4] as const

  const unplanned = features.filter((f) => !f.targetYear)

  function featuresForSlot(year: number, quarter: number) {
    return features.filter((f) => f.targetYear === year && (f.targetQuarter === quarter || !f.targetQuarter))
      .filter((f) => f.targetQuarter === quarter || (!f.targetQuarter && quarter === 1))
  }
  // For features with year but no quarter - put them in Q1 with a special mark
  function featuresForYear(year: number) {
    return features.filter((f) => f.targetYear === year && !f.targetQuarter)
  }
  // For features with year+quarter
  function featuresForYearQuarter(year: number, quarter: number) {
    return features.filter((f) => f.targetYear === year && f.targetQuarter === quarter)
  }

  const isCurrentQuarter = (year: number, q: number) => {
    const now = new Date()
    return year === now.getFullYear() && q === Math.ceil((now.getMonth() + 1) / 3)
  }

  return (
    <div className="space-y-6">
      {/* Year columns */}
      {years.map((year) => {
        const yearOnlyFeatures = featuresForYear(year)
        const hasAny = quarters.some((q) => featuresForYearQuarter(year, q).length > 0) || yearOnlyFeatures.length > 0
        return (
          <div key={year}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{year}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {quarters.map((q) => {
                const items = featuresForYearQuarter(year, q)
                const extraItems = q === 1 ? yearOnlyFeatures : []
                const isCurrent = isCurrentQuarter(year, q)
                return (
                  <div key={q} className={`rounded-xl border p-3 min-h-[120px] ${isCurrent ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`text-xs font-semibold ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                        Q{q}
                      </span>
                      {isCurrent && <span className="text-xs bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">Jetzt</span>}
                      {(items.length + extraItems.length) > 0 && (
                        <span className="ml-auto text-xs text-slate-400">{items.length + extraItems.length}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((f) => (
                        <FeatureCard key={f.id} feature={f} onClick={() => onFeatureClick(f.id)} compact />
                      ))}
                      {extraItems.map((f) => (
                        <div key={f.id} className="relative">
                          <FeatureCard feature={f} onClick={() => onFeatureClick(f.id)} compact />
                          <span className="absolute -top-1 -right-1 text-xs bg-slate-400 text-white px-1 rounded" title="Kein Quartal angegeben">?Q</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            {!hasAny && (
              <p className="text-xs text-slate-400 text-center py-2">{year} — Noch keine Features geplant</p>
            )}
          </div>
        )
      })}

      {/* Unplanned */}
      {unplanned.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-sm font-bold text-slate-500">Nicht terminiert</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">{unplanned.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unplanned.map((f) => (
              <FeatureCard key={f.id} feature={f} onClick={() => onFeatureClick(f.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Team Workload View ───────────────────────────────────────────────────────

const AREA_LABELS: Record<RoadmapTicketArea, string> = {
  frontend: 'Frontend', backend: 'Backend', devops: 'DevOps',
  design: 'Design', database: 'Datenbank', other: 'Sonstiges',
}

function TeamWorkloadView() {
  const allTickets          = useStore((s) => s.allRoadmapTickets)
  const features            = useStore((s) => s.roadmapFeatures)
  const loadAllRoadmapTickets = useStore((s) => s.loadAllRoadmapTickets)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (allTickets === null) {
      setLoading(true)
      loadAllRoadmapTickets().finally(() => setLoading(false))
    }
  }, [allTickets, loadAllRoadmapTickets])

  const featureMap = useMemo(() => Object.fromEntries(features.map((f) => [f.id, f])), [features])

  type TeamEntry = { tickets: number; sp: number; areas: RoadmapTicketArea[]; featureIds: string[] }

  // Per-team aggregation
  const teamStats = useMemo(() => {
    if (!allTickets) return [] as (TeamEntry & { team: string })[]
    const map: Record<string, { tickets: number; sp: number; areas: Set<string>; featureIds: Set<string> }> = {}
    for (const t of allTickets) {
      const team = t.assignedTeam || '— Kein Team —'
      if (!map[team]) map[team] = { tickets: 0, sp: 0, areas: new Set(), featureIds: new Set() }
      map[team].tickets++
      map[team].sp += t.storyPoints ?? 0
      map[team].areas.add(t.area)
      map[team].featureIds.add(t.featureId)
    }
    return Object.entries(map)
      .map(([team, s]) => ({ team, tickets: s.tickets, sp: s.sp, areas: [...s.areas] as RoadmapTicketArea[], featureIds: [...s.featureIds] }))
      .sort((a, b) => b.sp - a.sp || b.tickets - a.tickets)
  }, [allTickets])

  // Per-area aggregation
  const areaStats = useMemo(() => {
    if (!allTickets) return [] as { area: RoadmapTicketArea; tickets: number; sp: number }[]
    const map: Partial<Record<RoadmapTicketArea, { tickets: number; sp: number }>> = {}
    for (const t of allTickets) {
      if (!map[t.area]) map[t.area] = { tickets: 0, sp: 0 }
      map[t.area]!.tickets++
      map[t.area]!.sp += t.storyPoints ?? 0
    }
    return (Object.entries(map) as [RoadmapTicketArea, { tickets: number; sp: number }][])
      .map(([area, s]) => ({ area, ...s }))
      .sort((a, b) => b.sp - a.sp)
  }, [allTickets])

  const totalSP = useMemo(() => allTickets?.reduce((s, t) => s + (t.storyPoints ?? 0), 0) ?? 0, [allTickets])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Lade Ticket-Daten…</span>
      </div>
    )
  }

  if (!allTickets || allTickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
        <Users className="w-10 h-10 text-slate-300 dark:text-slate-700" />
        <p className="text-sm">Noch keine Tickets angelegt.</p>
        <p className="text-xs text-slate-400">Füge Tickets in den Feature-Detailseiten hinzu, um hier eine Workload-Übersicht zu sehen.</p>
      </div>
    )
  }

  const maxSP = Math.max(...teamStats.map((t) => t.sp), 1)

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tickets gesamt', value: allTickets.length },
          { label: 'Story Points gesamt', value: totalSP || '–' },
          { label: 'Teams beteiligt', value: teamStats.filter((t) => t.team !== '— Kein Team —').length },
          { label: 'Features mit Tickets', value: new Set(allTickets.map((t) => t.featureId)).size },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-team breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workload pro Team</h3>
          </div>
          <div className="space-y-3">
            {teamStats.map(({ team, tickets, sp, areas, featureIds }) => (
              <div key={team}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium truncate max-w-[60%] ${team === '— Kein Team —' ? 'text-slate-400 italic' : 'text-slate-700 dark:text-slate-200'}`}>
                    {team}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{tickets} Tickets</span>
                    {sp > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sp} SP</span>}
                  </div>
                </div>
                {sp > 0 && (
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(sp / maxSP) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {areas.map((a) => (
                    <span key={a} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                      {AREA_LABELS[a as RoadmapTicketArea]}
                    </span>
                  ))}
                  <span className="text-xs text-slate-400 ml-auto">
                    {featureIds.length} Feature{featureIds.length !== 1 ? 's' : ''}
                    {featureIds.length <= 3 && featureIds.map((id) => featureMap[id]).filter((f): f is RoadmapFeature => !!f).map((f) => (
                      <span key={f.id} className="ml-1 text-indigo-400" title={f.title}>·</span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-area breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aufwand pro Bereich</h3>
          </div>
          <div className="space-y-3">
            {areaStats.map(({ area, tickets, sp }) => {
              const maxAreaSP = Math.max(...areaStats.map((a) => a.sp), 1)
              return (
                <div key={area}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{AREA_LABELS[area as RoadmapTicketArea]}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{tickets} Tickets</span>
                      {sp > 0 && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{sp} SP</span>}
                    </div>
                  </div>
                  {sp > 0 && (
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all"
                        style={{ width: `${(sp / maxAreaSP) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Features without tickets warning */}
          {(() => {
            const withTickets = new Set(allTickets.map((t) => t.featureId))
            const without = features.filter((f) => !withTickets.has(f.id) && f.status !== 'cancelled' && f.status !== 'done')
            if (without.length === 0) return null
            return (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {without.length} Feature{without.length !== 1 ? 's' : ''} ohne Tickets
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{without.map((f) => f.title).join(', ')}</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'timeline' | 'workload'

export default function RoadmapPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const features = useStore((s) => s.roadmapFeatures)

  const [view,         setView]         = useState<ViewMode>('list')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<RoadmapStatus | 'all'>('all')
  const [showCreate,   setShowCreate]   = useState(false)

  const filtered = features.filter((f) => {
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || f.description.toLowerCase().includes(search.toLowerCase()) || (f.category ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || f.status === statusFilter
    return matchSearch && matchStatus
  })

  const grouped = ALL_STATUSES.reduce<Record<RoadmapStatus, RoadmapFeature[]>>((acc, s) => {
    acc[s] = filtered.filter((f) => f.status === s)
    return acc
  }, {} as Record<RoadmapStatus, RoadmapFeature[]>)

  const totalByStatus = ALL_STATUSES.map((s) => ({
    status: s,
    count: features.filter((f) => f.status === s).length,
  }))

  // Planning completeness stats
  const completenessStats = useMemo(() => {
    if (features.length === 0) return null
    const scores = features.map((f) => planningScore(f).filled)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const ready = features.filter((f) => planningScore(f).filled === 6).length
    return { avg: Math.round(avg * 10) / 10, ready, total: features.length }
  }, [features])

  const VIEW_TABS: { id: ViewMode; icon: React.ElementType; label: string }[] = [
    { id: 'list',     icon: LayoutList,  label: t('roadmap.viewList') },
    { id: 'timeline', icon: CalendarDays,label: t('roadmap.viewTimeline') },
    { id: 'workload', icon: Users,        label: t('roadmap.viewWorkload') },
  ]

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Map className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('roadmap.title')}</h1>
              <p className="text-xs text-slate-500">{t('roadmap.subtitle')}</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            {t('roadmap.newFeature')}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {totalByStatus.map(({ status, count }) => {
            if (count === 0) return null
            const sc = STATUS_CONFIG[status]
            const Icon = sc.icon
            return (
              <button key={status} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? `${sc.bg} ${sc.color} ring-2 ring-offset-1 ring-indigo-400`
                    : `${sc.bg} ${sc.color} hover:ring-1 hover:ring-indigo-300`
                }`}>
                <Icon className="w-3 h-3" />
                {sc.label} ({count})
              </button>
            )
          })}
          {completenessStats && (
            <span className="ml-auto text-xs text-slate-400">
              Ø {completenessStats.avg}/6 Abschnitte ·{' '}
              <span className="text-green-600 dark:text-green-400 font-medium">{completenessStats.ready}</span>/{completenessStats.total} vollständig geplant
            </span>
          )}
        </div>
      </div>

      {/* View tabs + search */}
      <div className="px-6 py-3 flex items-center gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        {/* View switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5">
          {VIEW_TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setView(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === id
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search + status filter — always rendered to keep bar height stable */}
        <div className={`relative flex-1 max-w-sm transition-opacity ${view === 'list' ? '' : 'invisible'}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')}
            tabIndex={view === 'list' ? 0 : -1}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RoadmapStatus | 'all')}
          tabIndex={view === 'list' ? 0 : -1}
          className={`px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-opacity ${view === 'list' ? '' : 'invisible'}`}>
          <option value="all">{t('roadmap.allStatuses')}</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── List View ── */}
        {view === 'list' && (
          features.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
              <Map className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <p className="text-base font-medium text-slate-500">{t('roadmap.noFeatures')}</p>
              <p className="text-sm text-slate-400">{t('roadmap.noFeaturesHint')}</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4" />
                {t('roadmap.newFeature')}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">{t('roadmap.noResults')}</p>
            </div>
          ) : statusFilter === 'all' ? (
            <div className="space-y-8">
              {ALL_STATUSES.map((status) => {
                const items = grouped[status]
                if (items.length === 0) return null
                const sc = STATUS_CONFIG[status]
                const Icon = sc.icon
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 ${sc.color}`} />
                      <h2 className={`text-sm font-semibold ${sc.color}`}>{sc.label}</h2>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {items.map((f) => (
                        <FeatureCard key={f.id} feature={f} onClick={() => navigate(`/roadmap/${f.id}`)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((f) => (
                <FeatureCard key={f.id} feature={f} onClick={() => navigate(`/roadmap/${f.id}`)} />
              ))}
            </div>
          )
        )}

        {/* ── Timeline View ── */}
        {view === 'timeline' && (
          features.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
              <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">{t('roadmap.noFeatures')}</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-4">{t('roadmap.timelineHint')}</p>
              <TimelineView features={features} onFeatureClick={(id) => navigate(`/roadmap/${id}`)} />
            </>
          )
        )}

        {/* ── Workload View ── */}
        {view === 'workload' && <TeamWorkloadView />}
      </div>

      {showCreate && (
        <CreateFeatureModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); navigate(`/roadmap/${id}`) }}
        />
      )}
    </div>
  )
}
