import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SprintLineChart from '@/components/ui/SprintLineChart'
import CapacityOverview from '@/components/sprints/CapacityOverview'
import SprintFormModal from '@/components/sprints/SprintFormModal'
import SprintStatusActions from '@/components/sprints/SprintStatusActions'
import SprintTimingInfo from '@/components/sprints/SprintTimingInfo'
import type { SprintChartSeries } from '@/components/ui/SprintLineChart'
import { countWorkingDays, formatDate, formatDateShort } from '@/utils/date'
import { sprintCapacityHours, formatNumber } from '@/utils/capacity'
import { suggestNextSprintDates, suggestSprintName } from '@/utils/sprint'
import { usePagePermission } from '@/hooks/usePagePermission'
import { Plus, Zap, Calendar, Target, ChevronRight, Edit2, Trash2, TrendingUp, BarChart2, Gauge, Clock, CalendarPlus } from 'lucide-react'
import type { Sprint, SprintStatus, SprintGoalMet } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default',
  Aktiv: 'info',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

type MainTab = SprintStatus | 'Alle' | 'Auswertung' | 'Kapazitaet'

const STATUS_TABS: (SprintStatus | 'Alle')[] = ['Alle', 'Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

// Order of the groups in the "Alle" tab: what's running first, then what's next, then history
const STATUS_GROUPS: SprintStatus[] = ['Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

/** Running and upcoming sprints in chronological order, history newest first. */
function sortForStatus(list: Sprint[], status: SprintStatus): Sprint[] {
  const ascending = status === 'Aktiv' || status === 'Geplant'
  return [...list].sort((a, b) => ascending ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate))
}

// ─── Chart series definitions ─────────────────────────────────────────────────
const CHART_SERIES_ALL: SprintChartSeries[] = [
  { key: 'capacityHours',   label: 'Kapazität (h)',       color: '#6366f1' },
  { key: 'remainingHours',  label: 'Remaining (h)',       color: '#f59e0b' },
  { key: 'averageBurndown', label: 'Avg. Burndown',       color: '#10b981', dashed: true },
  { key: 'completedTimePct',label: 'Abgeschl. Zeit (%)',  color: '#8b5cf6' },
  { key: 'completedItems',  label: 'Abgeschl. Items',     color: '#ec4899' },
  { key: 'velocity',        label: 'Velocity (SP)',       color: '#0ea5e9' },
]

export default function SprintsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { canWrite, isReadOnly } = usePagePermission('sprints')
  const sprints = useStore((s) => s.sprints)
  const deleteSprint = useStore((s) => s.deleteSprint)

  const [tab, setTab] = useState<MainTab>('Alle')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Sprint | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)
  const [activeSeriesKeys, setActiveSeriesKeys] = useState<Set<string>>(
    new Set(CHART_SERIES_ALL.map((s) => s.key)),
  )

  const isAuswertung = tab === 'Auswertung'
  const isKapazitaet = tab === 'Kapazitaet'
  const isListTab = !isAuswertung && !isKapazitaet
  const groups = !isListTab
    ? []
    : (tab === 'Alle' ? STATUS_GROUPS : [tab as SprintStatus])
        .map((status) => ({ status, sprints: sortForStatus(sprints.filter((s) => s.status === status), status) }))
        // The "Geplant" group always shows the suggestion for the next sprint
        .filter((g) => g.sprints.length > 0 || (g.status === 'Geplant' && canWrite))

  // Chart data: abgeschlossene Sprints chronologisch
  const chartSprints = [...sprints]
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const chartData = chartSprints.map((sp) => {
    const pct =
      sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined
        ? Math.round(((sp.capacityHours - sp.remainingHours) / sp.capacityHours) * 100)
        : undefined
    return {
      sprintName: sp.name,
      capacityHours:    sp.capacityHours,
      remainingHours:   sp.remainingHours,
      averageBurndown:  sp.averageBurndown,
      completedTimePct: pct,
      completedItems:   sp.completedItems,
      velocity:         sp.velocity,
    }
  })

  const activeSeries = CHART_SERIES_ALL.filter((s) => activeSeriesKeys.has(s.key))

  function toggleSeries(key: string) {
    setActiveSeriesKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  function openAdd() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(sp: Sprint) {
    setEditTarget(sp)
    setShowModal(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('sprints.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('sprints.count', { count: sprints.length })}</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd} disabled={!canWrite}>
          {t('sprints.newSprint')}
        </Button>
      </div>
      {isReadOnly && <ReadOnlyBanner />}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tabKey) => {
          const count = tabKey === 'Alle' ? sprints.length : sprints.filter((s) => s.status === tabKey).length
          const label = tabKey === 'Alle' ? t('common.all') : t(`sprintStatus.${tabKey}`)
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === tabKey
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === tabKey ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        {/* Auswertungs-Tab */}
        <button
          onClick={() => setTab('Auswertung')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'Auswertung'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          {t('sprints.analysis')}
        </button>
        {/* Kapazitäts-Tab */}
        <button
          onClick={() => setTab('Kapazitaet')}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'Kapazitaet'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          {t('capacity.tab')}
        </button>
      </div>

      {/* ── Kapazitäts-View ── */}
      {isKapazitaet && <CapacityOverview />}

      {/* ── Auswertungs-View ── */}
      {isAuswertung && (
        <div className="space-y-5">
          {chartSprints.length < 2 ? (
            <EmptyState
              icon={<BarChart2 className="w-12 h-12" />}
              title={t('sprints.analysisEmpty')}
              description={t('sprints.analysisEmptySubtitle')}
            />
          ) : (
            <>
              {/* Series toggle */}
              <div className="flex flex-wrap gap-2">
                {CHART_SERIES_ALL.map((s) => {
                  const active = activeSeriesKeys.has(s.key)
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSeries(s.key)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900'
                      }`}
                      style={active ? { backgroundColor: s.color, borderColor: s.color } : {}}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: active ? 'white' : s.color }}
                      />
                      {s.label}
                    </button>
                  )
                })}
              </div>

              {/* Chart */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
                <SprintLineChart
                  series={activeSeries}
                  data={chartData}
                  height={280}
                />
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableSprint')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCapacityH')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableRemainingH')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableAvgBurndown')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCompletedTimePct')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableCompletedItems')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableVelocity')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('sprints.tableGoalMet')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartSprints.map((sp) => {
                      const pct =
                        sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined
                          ? Math.round(((sp.capacityHours - sp.remainingHours) / sp.capacityHours) * 100)
                          : null
                      return (
                        <tr key={sp.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{sp.name}</td>
                          <Num val={sp.capacityHours} />
                          <Num val={sp.remainingHours} />
                          <Num val={sp.averageBurndown} decimal />
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {pct !== null ? `${pct}%` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                          <Num val={sp.completedItems} />
                          <Num val={sp.velocity} />
                          <td className="px-4 py-3 text-right">
                            {sp.goalMet
                              ? <GoalMetBadge value={sp.goalMet} />
                              : <span className="text-slate-300 dark:text-slate-600">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {chartSprints.length > 1 && (() => {
                    const avg = (key: (sp: typeof chartSprints[0]) => number | undefined) => {
                      const vals = chartSprints.map(key).filter((v): v is number => v !== undefined)
                      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
                    }
                    const avgPct = (() => {
                      const vals = chartSprints
                        .filter((sp) => sp.capacityHours && sp.capacityHours > 0 && sp.remainingHours !== undefined)
                        .map((sp) => Math.round(((sp.capacityHours! - sp.remainingHours!) / sp.capacityHours!) * 100))
                      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : undefined
                    })()
                    return (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                          <td className="px-4 py-3 text-xs uppercase tracking-wide">{t('common.average')}</td>
                          <AvgNum val={avg((sp) => sp.capacityHours)} />
                          <AvgNum val={avg((sp) => sp.remainingHours)} />
                          <AvgNum val={avg((sp) => sp.averageBurndown)} decimal />
                          <td className="px-4 py-3 text-right text-xs">{avgPct !== undefined ? `${avgPct}%` : '—'}</td>
                          <AvgNum val={avg((sp) => sp.completedItems)} />
                          <AvgNum val={avg((sp) => sp.velocity)} />
                          <td />
                        </tr>
                      </tfoot>
                    )
                  })()}
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Sprint list ── */}
      {isListTab && (
        sprints.length === 0 ? (
          <EmptyState
            icon={<Zap className="w-12 h-12" />}
            title={t('sprints.noSprints')}
            description={t('sprints.noSprintsSubtitle')}
            action={canWrite ? <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openAdd}>{t('sprints.newSprint')}</Button> : undefined}
          />
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">{t('sprints.noSprintsInTab')}</p>
        ) : (
          <div className="space-y-6">
            {groups.map(({ status, sprints: list }) => (
              <section key={status} className="space-y-3">
                {tab === 'Alle' && (
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t(`sprintStatus.${status}`)}
                    {list.length > 0 && <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">{list.length}</span>}
                  </h2>
                )}
                {list.map((sp) => (
                  <SprintCard
                    key={sp.id}
                    sprint={sp}
                    canWrite={canWrite}
                    onEdit={() => openEdit(sp)}
                    onDelete={() => setDeleteTarget(sp)}
                    onClick={() => navigate(`/sprints/${sp.id}`)}
                  />
                ))}
                {status === 'Geplant' && canWrite && <NextSprintSuggestion sprints={sprints} onClick={openAdd} />}
              </section>
            ))}
          </div>
        )
      )}

      <SprintFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        sprint={editTarget ?? undefined}
        onCreated={(id) => navigate(`/sprints/${id}`)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteSprint(deleteTarget.id) }}
        title={t('sprints.deleteSprint')}
        message={t('sprints.deleteConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function Num({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
      {val !== undefined && val !== null
        ? decimal ? val.toFixed(1) : val
        : <span className="text-slate-300 dark:text-slate-600">—</span>}
    </td>
  )
}

function AvgNum({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-3 text-right text-xs">
      {val !== undefined ? (decimal ? val.toFixed(1) : Math.round(val)) : '—'}
    </td>
  )
}

const GOAL_MET_BADGE: Record<SprintGoalMet, string> = {
  Ja:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Teilweise:'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Nein:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function GoalMetBadge({ value }: { value: SprintGoalMet }) {
  const { t } = useTranslation()
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GOAL_MET_BADGE[value]}`}>
      {t(`sprintDetail.goalMet_${value}`)}
    </span>
  )
}

// ─── Sprint Card ──────────────────────────────────────────────────────────────

interface SprintCardProps {
  sprint: Sprint
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
  onClick: () => void
}

function SprintCard({ sprint, canWrite, onEdit, onDelete, onClick }: SprintCardProps) {
  const { t } = useTranslation()
  const activities = useStore((s) => s.capacityActivities)
  const members = useStore((s) => s.members)
  const capacityHours = sprint.capacity.length > 0
    ? sprintCapacityHours(sprint, activities, new Set(members.map((m) => m.id)))
    : null
  const highlight = sprint.status === 'Aktiv'

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-start sm:gap-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group ${
      highlight ? 'border-indigo-200 dark:border-indigo-900' : 'border-slate-200 dark:border-slate-700'
    }`}>
      <button className="flex-1 min-w-0 text-left p-4 space-y-2" onClick={onClick}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{sprint.name}</span>
          <Badge label={t(`sprintStatus.${sprint.status}`)} variant={STATUS_VARIANTS[sprint.status]} dot />
          {sprint.goalMet && <GoalMetBadge value={sprint.goalMet} />}
        </div>
        <div className="flex items-start gap-1.5 text-sm">
          <Target className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          {sprint.goal
            ? <span className="line-clamp-2 text-slate-600 dark:text-slate-400">{sprint.goal}</span>
            : <span className="italic text-slate-300 dark:text-slate-600">{t('sprints.noGoal')}</span>}
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
            <span className="text-slate-400 dark:text-slate-500">· {t('sprints.workingDays', { count: countWorkingDays(sprint.startDate, sprint.endDate) })}</span>
          </span>
          {capacityHours !== null && (
            <span className="flex items-center gap-1" title={t('capacity.sprintCapacity')}>
              <Clock className="w-3.5 h-3.5" />{t('sprints.capacityShort', { hours: formatNumber(capacityHours) })}
            </span>
          )}
          {sprint.plannedPoints > 0 && (
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />{t('sprints.plannedPointsShort', { count: sprint.plannedPoints })}
            </span>
          )}
          {sprint.velocity != null && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />{t('sprints.velocityShort', { count: sprint.velocity })}
            </span>
          )}
        </div>
        <SprintTimingInfo sprint={sprint} />
      </button>

      <div className="flex items-center justify-end gap-1 shrink-0 px-3 pb-3 sm:p-3" onClick={(e) => e.stopPropagation()}>
        {canWrite && (
          <>
            <SprintStatusActions sprint={sprint} compact />
            <button onClick={onEdit} title={t('sprints.editSprint')} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title={t('sprints.deleteSprint')} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={onClick} className="p-1.5 text-slate-400 group-hover:text-indigo-500 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Next sprint suggestion ───────────────────────────────────────────────────

function NextSprintSuggestion({ sprints, onClick }: { sprints: Sprint[]; onClick: () => void }) {
  const { t } = useTranslation()
  const { startDate, endDate } = suggestNextSprintDates(sprints)
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors"
    >
      <CalendarPlus className="w-5 h-5 shrink-0" />
      <span className="text-sm font-medium">{t('sprints.planNext', { name: suggestSprintName(sprints) })}</span>
      <span className="text-xs text-slate-400 dark:text-slate-500">
        {formatDateShort(startDate)} – {formatDateShort(endDate)} · {t('sprints.workingDays', { count: countWorkingDays(startDate, endDate) })}
      </span>
    </button>
  )
}
