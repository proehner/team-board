import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Map, ChevronRight, ChevronLeft, Tag, Calendar, Layers,
  Circle, CheckCircle2, XCircle, Lightbulb, Clock,
  LayoutList, CalendarDays, Users, TrendingUp, GanttChartSquare,
  Loader2, AlertCircle, ArrowUpDown, X, GripVertical,
} from 'lucide-react'
import { useStore } from '@/store'
import type { RoadmapFeature, RoadmapStatus, RoadmapPriority, RoadmapTicketArea, RoadmapQuarter } from '@/types'

// ─── Shared config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RoadmapStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  idea:         { label: 'Idee',        icon: Lightbulb,    color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700' },
  planned:      { label: 'Geplant',     icon: Clock,        color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30',     border: 'border-blue-300 dark:border-blue-700' },
  'in-progress':{ label: 'In Arbeit',   icon: Circle,       color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-300 dark:border-indigo-700' },
  done:         { label: 'Fertig',      icon: CheckCircle2, color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/30',   border: 'border-green-300 dark:border-green-700' },
  cancelled:    { label: 'Abgebrochen', icon: XCircle,      color: 'text-slate-500',                       bg: 'bg-slate-100 dark:bg-slate-800',       border: 'border-slate-300 dark:border-slate-600' },
}

const PRIORITY_CONFIG: Record<RoadmapPriority, { label: string; color: string; dot: string }> = {
  low:      { label: 'Niedrig',  color: 'text-slate-500',                        dot: 'bg-slate-400' },
  medium:   { label: 'Mittel',   color: 'text-blue-600 dark:text-blue-400',      dot: 'bg-blue-500' },
  high:     { label: 'Hoch',     color: 'text-orange-600 dark:text-orange-400',  dot: 'bg-orange-500' },
  critical: { label: 'Kritisch', color: 'text-red-600 dark:text-red-400',        dot: 'bg-red-500' },
}

const PRIORITY_ORDER: Record<RoadmapPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('roadmap.newFeature')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
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
  const pc = PRIORITY_CONFIG[feature.priority]
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
          <span className={`ml-auto text-xs font-medium ${pc.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${pc.dot} mr-0.5`} />
          </span>
        </div>
      </button>
    )
  }
  return (
    <button onClick={onClick}
      className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
              <StatusIcon className="w-3 h-3" />
              {sc.label}
            </span>
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${pc.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
              {pc.label}
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

// ─── Draggable Compact Card (Timeline) ───────────────────────────────────────

interface DraggableCardProps {
  feature: RoadmapFeature
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
}

function DraggableCompactCard({ feature, onOpen, onDragStart, onDragEnd, isDragging }: DraggableCardProps) {
  const sc = STATUS_CONFIG[feature.status]
  const pc = PRIORITY_CONFIG[feature.priority]
  const { filled, total } = planningScore(feature)
  const pct = (filled / total) * 100
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', feature.id)
        // Delay so the drag image is captured before opacity changes
        setTimeout(() => onDragStart(), 0)
      }}
      onDragEnd={onDragEnd}
      title={[feature.title, feature.description].filter(Boolean).join('\n')}
      className={`group rounded-lg border ${sc.border} bg-white dark:bg-slate-900 cursor-grab active:cursor-grabbing select-none transition-all ${
        isDragging ? 'opacity-30 scale-95' : 'hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
        <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className={`w-1.5 h-1.5 rounded-full ${pc.dot} shrink-0`} />
        <button
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className={`flex-1 text-left text-xs font-medium truncate ${sc.color} hover:underline`}
        >
          {feature.title}
        </button>
      </div>
      <div className="px-2 pb-1.5 pt-0.5">
        <div className="h-0.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ features, onFeatureClick }: { features: RoadmapFeature[]; onFeatureClick: (id: string) => void }) {
  const { t } = useTranslation()
  const updateRoadmapFeature = useStore((s) => s.updateRoadmapFeature)
  const roadmapTickets       = useStore((s) => s.roadmapTickets)

  const now          = new Date()
  const todayYear    = now.getFullYear()
  const todayQuarter = Math.ceil((now.getMonth() + 1) / 3)

  const [startYear,    setStartYear]    = useState(todayYear)
  const [draggingId,   setDraggingId]   = useState<string | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  const years    = [startYear, startYear + 1, startYear + 2]
  const quarters = [1, 2, 3, 4] as const

  const unplanned = features.filter((f) => !f.targetYear)

  const isCurrentSlot = (year: number, q: number) => year === todayYear && q === todayQuarter
  const isPastSlot    = (year: number, q: number) =>
    year < todayYear || (year === todayYear && q < todayQuarter)

  const featuresForSlot     = (year: number, q: number) =>
    features.filter((f) => f.targetYear === year && f.targetQuarter === q)
  const featuresForYearOnly = (year: number) =>
    features.filter((f) => f.targetYear === year && !f.targetQuarter)

  // SP sum for a list of features, using already-loaded ticket data (best-effort)
  const spForList = (list: RoadmapFeature[]) =>
    list.reduce((sum, f) =>
      sum + (roadmapTickets[f.id] ?? []).reduce((s, t) => s + (t.storyPoints ?? 0), 0), 0)

  async function dropOnSlot(year: number, quarter: number) {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f || (f.targetYear === year && f.targetQuarter === quarter)) return
    await updateRoadmapFeature(draggingId, {
      targetYear:    year    as unknown as number,
      targetQuarter: quarter as unknown as 1,
    })
    setDraggingId(null)
    setDragOverSlot(null)
  }

  async function dropOnUnplanned() {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f || !f.targetYear) return
    await updateRoadmapFeature(draggingId, {
      targetYear:    null as unknown as number,
      targetQuarter: null as unknown as 1,
    })
    setDraggingId(null)
    setDragOverSlot(null)
  }

  function onCellDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverSlot !== key) setDragOverSlot(key)
  }

  function onCellDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverSlot(null)
  }

  const isDragging = draggingId !== null

  return (
    <div className="space-y-5">

      {/* ── Year navigation ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStartYear((y) => y - 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Vorheriges Jahr"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums min-w-[6rem] text-center">
          {startYear} – {startYear + 2}
        </span>
        <button
          onClick={() => setStartYear((y) => y + 1)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Nächstes Jahr"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {startYear !== todayYear && (
          <button
            onClick={() => setStartYear(todayYear)}
            className="ml-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
          >
            {t('roadmap.timelineJumpToToday')}
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 hidden sm:block italic">
          {t('roadmap.timelineDragHint')}
        </span>
      </div>

      {/* ── Year blocks ── */}
      {years.map((year) => {
        const yearOnly = featuresForYearOnly(year)
        const isPastYear = year < todayYear
        const totalInYear = quarters.reduce((n, q) => n + featuresForSlot(year, q).length, 0) + yearOnly.length

        return (
          <div key={year} className={isPastYear ? 'opacity-55' : ''}>
            {/* Year header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-sm font-bold ${isPastYear ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                {year}
              </span>
              {isPastYear && (
                <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {t('roadmap.timelinePast')}
                </span>
              )}
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              {totalInYear > 0 && (
                <span className="text-xs text-slate-400">{totalInYear}</span>
              )}
            </div>

            {/* Year-only features (no quarter set) */}
            {yearOnly.length > 0 && (
              <div className="mb-2 flex items-start gap-2 flex-wrap px-1">
                <span className="text-xs text-slate-400 italic shrink-0 mt-1.5">
                  {t('roadmap.timelineYearOnly')}:
                </span>
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {yearOnly.map((f) => (
                    <div key={f.id} className="w-40">
                      <DraggableCompactCard
                        feature={f}
                        onOpen={() => onFeatureClick(f.id)}
                        onDragStart={() => setDraggingId(f.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverSlot(null) }}
                        isDragging={draggingId === f.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quarter grid */}
            <div className="grid grid-cols-4 gap-3">
              {quarters.map((q) => {
                const items    = featuresForSlot(year, q)
                const isCurrent = isCurrentSlot(year, q)
                const isPast    = isPastSlot(year, q)
                const slotKey   = `${year}-${q}`
                const isOver    = dragOverSlot === slotKey
                const sp        = spForList(items)

                return (
                  <div
                    key={q}
                    onDragOver={(e) => onCellDragOver(e, slotKey)}
                    onDragLeave={onCellDragLeave}
                    onDrop={(e) => { e.preventDefault(); dropOnSlot(year, q) }}
                    className={`rounded-xl border p-3 min-h-[110px] transition-all ${
                      isOver
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-md ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : isCurrent
                          ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : isPast
                            ? 'border-slate-100 dark:border-slate-800/70 bg-transparent'
                            : isDragging
                              ? 'border-slate-300 dark:border-slate-600 border-dashed bg-slate-50 dark:bg-slate-900'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                    }`}
                  >
                    {/* Cell header */}
                    <div className="flex items-center gap-1 mb-2">
                      <span className={`text-xs font-semibold ${
                        isCurrent ? 'text-indigo-600 dark:text-indigo-400'
                        : isPast   ? 'text-slate-300 dark:text-slate-700'
                        : 'text-slate-400'
                      }`}>Q{q}</span>
                      {isCurrent && (
                        <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full leading-tight font-medium">
                          Jetzt
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1.5">
                        {sp > 0 && (
                          <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 tabular-nums">
                            {sp} SP
                          </span>
                        )}
                        {items.length > 0 && (
                          <span className="text-[10px] text-slate-400 tabular-nums">{items.length}</span>
                        )}
                      </div>
                    </div>

                    {/* Feature cards */}
                    <div className="space-y-1.5">
                      {items.map((f) => (
                        <DraggableCompactCard
                          key={f.id}
                          feature={f}
                          onOpen={() => onFeatureClick(f.id)}
                          onDragStart={() => setDraggingId(f.id)}
                          onDragEnd={() => { setDraggingId(null); setDragOverSlot(null) }}
                          isDragging={draggingId === f.id}
                        />
                      ))}

                      {/* Drop indicator */}
                      {isOver && (
                        <div className="rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-600 py-2 text-center">
                          <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400">
                            {t('roadmap.timelineDropHere')}
                          </p>
                        </div>
                      )}

                      {/* Empty cell drag hint */}
                      {items.length === 0 && !isOver && isDragging && (
                        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-3 flex items-center justify-center">
                          <span className="text-[10px] text-slate-300 dark:text-slate-700">+</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* ── Backlog / Unplanned ── */}
      <div
        onDragOver={(e) => onCellDragOver(e, 'unplanned')}
        onDragLeave={onCellDragLeave}
        onDrop={(e) => { e.preventDefault(); dropOnUnplanned() }}
        className={`rounded-xl border-2 border-dashed p-4 transition-all ${
          dragOverSlot === 'unplanned'
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/20'
            : unplanned.length === 0 && !isDragging
              ? 'border-transparent p-0'
              : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        {/* Backlog header — hide when empty and not dragging */}
        {(unplanned.length > 0 || isDragging) && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-slate-500">{t('roadmap.timelineBacklog')}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            {unplanned.length > 0 && (
              <span className="text-xs text-slate-400">{unplanned.length}</span>
            )}
          </div>
        )}

        {dragOverSlot === 'unplanned' && (
          <div className="mb-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-600 py-3 text-center">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {t('roadmap.timelineDropUnschedule')}
            </p>
          </div>
        )}

        {unplanned.length === 0 && isDragging && dragOverSlot !== 'unplanned' && (
          <p className="text-xs text-slate-400 text-center py-2">{t('roadmap.timelineDropHere')}</p>
        )}

        {unplanned.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unplanned.map((f) => (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', f.id)
                  setTimeout(() => setDraggingId(f.id), 0)
                }}
                onDragEnd={() => { setDraggingId(null); setDragOverSlot(null) }}
                className={`transition-opacity ${draggingId === f.id ? 'opacity-30' : ''}`}
              >
                <FeatureCard feature={f} onClick={() => onFeatureClick(f.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Gantt View ───────────────────────────────────────────────────────────────

const COL_W  = 80   // px per quarter column
const LEFT_W = 220  // sticky left panel width
const ROW_H  = 44   // row height
const BAR_H  = 24   // bar height

function GanttView({ features, onFeatureClick }: { features: RoadmapFeature[]; onFeatureClick: (id: string) => void }) {
  const { t }                = useTranslation()
  const updateRoadmapFeature = useStore((s) => s.updateRoadmapFeature)

  const now          = new Date()
  const todayYear    = now.getFullYear()
  const todayQuarter = Math.ceil((now.getMonth() + 1) / 3)
  // fraction (0..1) through current quarter based on day-in-quarter
  const todayFraction = (now.getMonth() % 3) / 3 + now.getDate() / 91

  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [resizing, setResizing] = useState<{
    id: string
    edge: 'start' | 'end'
    currentIdx: number
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Compute visible year range from all feature dates + ±1 year buffer
  const { minYear, maxYear } = useMemo(() => {
    const years: number[] = [todayYear - 1, todayYear + 1]
    for (const f of features) {
      if (f.startYear)  years.push(f.startYear)
      if (f.targetYear) years.push(f.targetYear)
    }
    return { minYear: Math.min(...years), maxYear: Math.max(...years) }
  }, [features, todayYear])

  const totalCols = (maxYear - minYear + 1) * 4
  const totalW    = totalCols * COL_W

  function colIdxFor(year: number, quarter: number) {
    return (year - minYear) * 4 + (quarter - 1)
  }

  const todayLeft = (colIdxFor(todayYear, todayQuarter) + todayFraction) * COL_W

  // Sort key: earliest known quarter index (start preferred; target as fallback)
  function ganttSortKey(f: RoadmapFeature) {
    if (f.startYear && f.startQuarter)   return f.startYear  * 4 + f.startQuarter
    if (f.targetYear && f.targetQuarter) return f.targetYear * 4 + f.targetQuarter
    if (f.targetYear)                    return f.targetYear * 4 + 5  // year-only → after Q4
    return Infinity
  }

  const scheduled = features
    .filter((f) => f.targetYear || f.startYear)
    .slice()
    .sort((a, b) => {
      const d = ganttSortKey(a) - ganttSortKey(b)
      if (d !== 0) return d
      // Secondary: target end date
      const aEnd = a.targetYear && a.targetQuarter ? a.targetYear * 4 + a.targetQuarter : Infinity
      const bEnd = b.targetYear && b.targetQuarter ? b.targetYear * 4 + b.targetQuarter : Infinity
      if (aEnd !== bEnd) return aEnd - bEnd
      return a.title.localeCompare(b.title)
    })
  const unscheduled = features.filter((f) => !f.targetYear && !f.startYear)

  const groups = ALL_STATUSES
    .map((s) => ({ status: s, items: scheduled.filter((f) => f.status === s) }))
    .filter((g) => g.items.length > 0)

  async function dropOnQuarter(year: number, quarter: number) {
    if (!draggingId) return
    const f = features.find((x) => x.id === draggingId)
    if (!f) return

    // Maintain duration when feature has both start and target
    let patchStartYear: number | null    = f.startYear ?? null
    let patchStartQ: RoadmapQuarter | null = f.startQuarter ?? null

    if (f.startYear && f.startQuarter && f.targetYear && f.targetQuarter) {
      const duration    = colIdxFor(f.targetYear, f.targetQuarter) - colIdxFor(f.startYear, f.startQuarter)
      const newEndIdx   = colIdxFor(year, quarter)
      const newStartIdx = Math.max(0, newEndIdx - duration)
      patchStartYear = minYear + Math.floor(newStartIdx / 4)
      patchStartQ    = ((newStartIdx % 4) + 1) as RoadmapQuarter
    }

    await updateRoadmapFeature(draggingId, {
      targetYear:    year           as unknown as number,
      targetQuarter: quarter        as unknown as 1,
      startYear:     patchStartYear as unknown as number,
      startQuarter:  patchStartQ    as unknown as 1,
    })
    setDraggingId(null)
    setDragOverCol(null)
  }

  function startResize(e: React.MouseEvent, id: string, edge: 'start' | 'end', currentIdx: number) {
    e.preventDefault()
    e.stopPropagation()
    setResizing({ id, edge, currentIdx })
  }

  // Global mouse listeners while a resize is active
  useEffect(() => {
    if (!resizing) return

    function onMouseMove(e: MouseEvent) {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x    = e.clientX - rect.left + containerRef.current.scrollLeft - LEFT_W
      const idx  = Math.max(0, Math.min(totalCols - 1, Math.floor(x / COL_W)))
      setResizing((prev) => prev ? { ...prev, currentIdx: idx } : null)
    }

    async function onMouseUp() {
      if (!resizing) return
      const f = features.find((x) => x.id === resizing.id)
      if (f) {
        const existingStartIdx = f.startYear  && f.startQuarter  ? (f.startYear  - minYear) * 4 + (f.startQuarter  - 1) : null
        const existingEndIdx   = f.targetYear && f.targetQuarter ? (f.targetYear - minYear) * 4 + (f.targetQuarter - 1) : null
        if (resizing.edge === 'start') {
          const clamped = existingEndIdx !== null ? Math.min(resizing.currentIdx, existingEndIdx) : resizing.currentIdx
          const year    = minYear + Math.floor(clamped / 4)
          const quarter = ((clamped % 4) + 1) as RoadmapQuarter
          await updateRoadmapFeature(resizing.id, { startYear: year as unknown as number, startQuarter: quarter as unknown as 1 })
        } else {
          const clamped = existingStartIdx !== null ? Math.max(resizing.currentIdx, existingStartIdx) : resizing.currentIdx
          const year    = minYear + Math.floor(clamped / 4)
          const quarter = ((clamped % 4) + 1) as RoadmapQuarter
          await updateRoadmapFeature(resizing.id, { targetYear: year as unknown as number, targetQuarter: quarter as unknown as 1 })
        }
      }
      setResizing(null)
    }

    document.body.style.cursor     = 'ew-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [resizing, features, totalCols, minYear, updateRoadmapFeature])

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400 italic">{t('roadmap.ganttHint')}</p>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto" ref={containerRef}>
          <div style={{ minWidth: LEFT_W + totalW }}>

            {/* ── Header ── */}
            <div className="flex border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-20">
              <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 px-3 py-2 flex items-end">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Feature</span>
              </div>
              <div className="flex">
                {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map((year) => (
                  <div key={year} style={{ width: 4 * COL_W }}
                    className="border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                    <div className={`px-2 py-0.5 text-[10px] font-bold border-b border-slate-200 dark:border-slate-700 ${
                      year === todayYear ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {year}
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4].map((q) => {
                        const isCurrent = year === todayYear && q === todayQuarter
                        const isPast    = year < todayYear || (year === todayYear && q < todayQuarter)
                        const key       = `${year}-${q}`
                        return (
                          <div key={q} style={{ width: COL_W }}
                            onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== key) setDragOverCol(key) }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
                            onDrop={(e) => { e.preventDefault(); dropOnQuarter(year, q) }}
                            className={`text-center py-1 text-[10px] font-semibold border-r border-slate-100 dark:border-slate-800 last:border-r-0 select-none transition-colors ${
                              dragOverCol === key
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                : isCurrent
                                  ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                                  : isPast
                                    ? 'text-slate-300 dark:text-slate-700'
                                    : 'text-slate-400'
                            }`}
                          >
                            Q{q}
                            {isCurrent && <span className="block text-[8px] leading-none text-indigo-400">▼</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Feature rows (grouped by status) ── */}
            {groups.length === 0 ? (
              <div className="flex">
                <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                  className="sticky left-0 border-r border-slate-200 dark:border-slate-700" />
                <div style={{ width: totalW }} className="py-14 text-center">
                  <p className="text-sm text-slate-400">{t('roadmap.ganttNoScheduled')}</p>
                </div>
              </div>
            ) : groups.map(({ status, items }) => {
              const sc   = STATUS_CONFIG[status]
              const Icon = sc.icon
              return (
                <div key={status}>
                  {/* Status section header */}
                  <div className="flex bg-slate-50/80 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                    <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                      className="sticky left-0 z-10 bg-slate-50/80 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 px-3 py-1.5 flex items-center gap-1.5">
                      <Icon className={`w-3 h-3 ${sc.color}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${sc.color}`}>{sc.label}</span>
                      <span className="text-[10px] text-slate-400">({items.length})</span>
                    </div>
                    <div style={{ width: totalW }} className="relative">
                      <div style={{ left: todayLeft, width: 1 }}
                        className="absolute top-0 bottom-0 bg-indigo-400/25 dark:bg-indigo-500/20 pointer-events-none" />
                    </div>
                  </div>

                  {/* Feature rows */}
                  {items.map((f) => {
                    let barStartIdx: number | null = null
                    let barEndIdx:   number | null = null
                    let isMilestone = false

                    if (f.targetYear && f.targetQuarter) {
                      barEndIdx = colIdxFor(f.targetYear, f.targetQuarter)
                      if (f.startYear && f.startQuarter) {
                        barStartIdx = colIdxFor(f.startYear, f.startQuarter)
                        if (barStartIdx > barEndIdx) barStartIdx = barEndIdx
                      } else {
                        barStartIdx = barEndIdx
                        isMilestone = true
                      }
                    } else if (f.startYear && f.startQuarter) {
                      barStartIdx = colIdxFor(f.startYear, f.startQuarter)
                      barEndIdx   = barStartIdx
                      isMilestone = true
                    }

                    return (
                      <div key={f.id}
                        style={{ height: ROW_H }}
                        className="flex border-b border-slate-100 dark:border-slate-800 last:border-b-0 group hover:bg-slate-50/60 dark:hover:bg-slate-800/20">

                        {/* Left: feature name */}
                        <div style={{ width: LEFT_W, minWidth: LEFT_W }}
                          className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50/60 dark:group-hover:bg-slate-800/20 border-r border-slate-200 dark:border-slate-700 px-3 flex items-center">
                          <button onClick={() => onFeatureClick(f.id)}
                            className={`text-xs font-medium truncate hover:underline text-left w-full ${sc.color}`}>
                            {f.title}
                          </button>
                        </div>

                        {/* Right: bar area */}
                        <div style={{ width: totalW, position: 'relative' }}>
                          {/* Column background stripes */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {Array.from({ length: totalCols }, (_, i) => {
                              const y = minYear + Math.floor(i / 4)
                              const q = (i % 4) + 1
                              const isCurr = y === todayYear && q === todayQuarter
                              const isPast = y < todayYear || (y === todayYear && q < todayQuarter)
                              return (
                                <div key={i} style={{ width: COL_W }}
                                  className={`border-r border-slate-100 dark:border-slate-800 last:border-r-0 ${
                                    isCurr ? 'bg-indigo-50/40 dark:bg-indigo-950/10' :
                                    isPast  ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''
                                  }`} />
                              )
                            })}
                          </div>

                          {/* Today marker line */}
                          <div style={{ left: todayLeft, width: 2 }}
                            className="absolute top-0 bottom-0 bg-indigo-400/50 dark:bg-indigo-500/50 pointer-events-none z-10" />

                          {/* Feature bar */}
                          {barStartIdx !== null && barEndIdx !== null && (() => {
                            const isResizingThis = resizing?.id === f.id
                            let dispStart = barStartIdx
                            let dispEnd   = barEndIdx
                            if (isResizingThis) {
                              if (resizing!.edge === 'start') dispStart = Math.min(resizing!.currentIdx, dispEnd)
                              else                            dispEnd   = Math.max(resizing!.currentIdx, dispStart)
                            }
                            const barLeft  = isMilestone ? dispStart * COL_W + (COL_W - BAR_H) / 2 : dispStart * COL_W + 4
                            const barWidth = isMilestone ? BAR_H : (dispEnd - dispStart + 1) * COL_W - 8
                            return (
                              <div
                                draggable={!resizing}
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text/plain', f.id)
                                  setTimeout(() => setDraggingId(f.id), 0)
                                }}
                                onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                                title={f.title}
                                style={{ left: barLeft, width: barWidth, top: (ROW_H - BAR_H) / 2, height: BAR_H }}
                                className={`absolute z-20 select-none ${
                                  isResizingThis ? 'cursor-ew-resize' : draggingId === f.id ? 'opacity-30 cursor-grabbing' : 'cursor-grab hover:brightness-95'
                                } ${isMilestone
                                  ? 'flex items-center justify-center'
                                  : `rounded-md ${sc.bg} border ${sc.border} flex items-center overflow-hidden`
                                }`}
                              >
                                {isMilestone ? (
                                  <div className={`w-full h-full rotate-45 rounded-sm ${sc.bg} border ${sc.border}`} />
                                ) : (
                                  <>
                                    {/* Left resize handle */}
                                    <div
                                      onMouseDown={(e) => startResize(e, f.id, 'start', dispStart)}
                                      className="absolute left-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize hover:bg-black/10 dark:hover:bg-white/15 rounded-l-md z-10 group/lh"
                                    >
                                      <div className="w-px h-3.5 rounded-full bg-current opacity-30 group-hover/lh:opacity-80 transition-opacity" />
                                    </div>

                                    <span className={`text-[10px] font-medium truncate ${sc.color} px-3`}>{f.title}</span>

                                    {/* Right resize handle */}
                                    <div
                                      onMouseDown={(e) => startResize(e, f.id, 'end', dispEnd)}
                                      className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize hover:bg-black/10 dark:hover:bg-white/15 rounded-r-md z-10 group/rh"
                                    >
                                      <div className="w-px h-3.5 rounded-full bg-current opacity-30 group-hover/rh:opacity-80 transition-opacity" />
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Unscheduled section */}
      {unscheduled.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-bold text-slate-500">{t('roadmap.ganttUnscheduled')}</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">{unscheduled.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unscheduled.map((f) => (
              <FeatureCard key={f.id} feature={f} compact onClick={() => onFeatureClick(f.id)} />
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

type ViewMode = 'list' | 'timeline' | 'gantt' | 'workload'
type SortMode = 'default' | 'priority' | 'completeness' | 'updated'

const selectCls = 'px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500'

export default function RoadmapPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const features = useStore((s) => s.roadmapFeatures)

  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as ViewMode | null) ?? 'list'
  function setView(v: ViewMode) {
    setSearchParams((p) => { p.set('view', v); return p }, { replace: true })
  }
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState<RoadmapStatus | 'all'>('all')
  const [priorityFilter,  setPriorityFilter]  = useState<RoadmapPriority | 'all'>('all')
  const [categoryFilter,  setCategoryFilter]  = useState<string | 'all'>('all')
  const [sortBy,          setSortBy]          = useState<SortMode>('default')
  const [showCreate,      setShowCreate]      = useState(false)

  // Keyboard shortcut: N to create new feature
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        setShowCreate(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Computed categories from all features
  const categories = useMemo(() => {
    const cats = new Set(features.map((f) => f.category).filter(Boolean) as string[])
    return [...cats].sort()
  }, [features])

  // Filtered + sorted features
  const filtered = useMemo(() => {
    let result = features.filter((f) => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.category ?? '').toLowerCase().includes(q) ||
        f.tags.some((tag) => tag.toLowerCase().includes(q))
      const matchStatus   = statusFilter   === 'all' || f.status   === statusFilter
      const matchPriority = priorityFilter === 'all' || f.priority === priorityFilter
      const matchCategory = categoryFilter === 'all' || (f.category ?? '') === categoryFilter
      return matchSearch && matchStatus && matchPriority && matchCategory
    })

    if (sortBy === 'priority') {
      result = [...result].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    } else if (sortBy === 'completeness') {
      result = [...result].sort((a, b) => planningScore(b).filled - planningScore(a).filled)
    } else if (sortBy === 'updated') {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }

    return result
  }, [features, search, statusFilter, priorityFilter, categoryFilter, sortBy])

  const grouped = ALL_STATUSES.reduce<Record<RoadmapStatus, RoadmapFeature[]>>((acc, s) => {
    acc[s] = filtered.filter((f) => f.status === s)
    return acc
  }, {} as Record<RoadmapStatus, RoadmapFeature[]>)

  const totalByStatus = ALL_STATUSES.map((s) => ({
    status: s,
    count: features.filter((f) => f.status === s).length,
  }))

  const completenessStats = useMemo(() => {
    if (features.length === 0) return null
    const scores = features.map((f) => planningScore(f).filled)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const ready = features.filter((f) => planningScore(f).filled === 6).length
    return { avg: Math.round(avg * 10) / 10, ready, total: features.length }
  }, [features])

  const activeFilterCount = [
    statusFilter !== 'all',
    priorityFilter !== 'all',
    categoryFilter !== 'all',
    search !== '',
  ].filter(Boolean).length

  function clearFilters() {
    setSearch('')
    setStatusFilter('all')
    setPriorityFilter('all')
    setCategoryFilter('all')
    setSortBy('default')
  }

  const VIEW_TABS: { id: ViewMode; icon: React.ElementType; label: string }[] = [
    { id: 'list',     icon: LayoutList,        label: t('roadmap.viewList') },
    { id: 'timeline', icon: CalendarDays,       label: t('roadmap.viewTimeline') },
    { id: 'gantt',    icon: GanttChartSquare,   label: t('roadmap.viewGantt') },
    { id: 'workload', icon: Users,              label: t('roadmap.viewWorkload') },
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
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            title="N">
            <Plus className="w-4 h-4" />
            {t('roadmap.newFeature')}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
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

      {/* Toolbar */}
      <div className="px-6 py-3 flex items-center gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-wrap">
        {/* View switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 shrink-0">
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

        {/* Search — always visible */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>

        {/* Filters — visible based on view */}
        {view !== 'workload' && (
          <>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as RoadmapPriority | 'all')} className={selectCls}>
              <option value="all">{t('roadmap.allPriorities')}</option>
              {(['critical', 'high', 'medium', 'low'] as RoadmapPriority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
              ))}
            </select>
          </>
        )}

        {view === 'list' && (
          <>
            {categories.length > 0 && (
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectCls}>
                <option value="all">{t('roadmap.allCategories')}</option>
                {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}

            <div className="relative shrink-0">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}
                className={`${selectCls} pl-8`}>
                <option value="default">{t('roadmap.sortDefault')}</option>
                <option value="priority">{t('roadmap.sortPriority')}</option>
                <option value="completeness">{t('roadmap.sortCompleteness')}</option>
                <option value="updated">{t('roadmap.sortUpdated')}</option>
              </select>
            </div>
          </>
        )}

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-red-300 dark:hover:border-red-700 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
            {t('roadmap.clearFilters')} ({activeFilterCount})
          </button>
        )}
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
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
              <Search className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">{t('roadmap.noFeaturesFiltered')}</p>
              <button onClick={clearFilters}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                {t('roadmap.clearFilters')}
              </button>
            </div>
          ) : statusFilter === 'all' && sortBy === 'default' ? (
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
              <TimelineView features={filtered} onFeatureClick={(id) => navigate(`/roadmap/${id}`)} />
            </>
          )
        )}

        {/* ── Gantt View ── */}
        {view === 'gantt' && (
          features.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-2">
              <GanttChartSquare className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500">{t('roadmap.noFeatures')}</p>
            </div>
          ) : (
            <GanttView features={filtered} onFeatureClick={(id) => navigate(`/roadmap/${id}`)} />
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
