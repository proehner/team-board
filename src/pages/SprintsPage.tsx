import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Chip from '@/components/ui/Chip'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SprintLineChart from '@/components/ui/SprintLineChart'
import CapacityOverview from '@/components/sprints/CapacityOverview'
import SprintFormModal from '@/components/sprints/SprintFormModal'
import SprintTimeline from '@/components/sprints/SprintTimeline'
import SprintTimingInfo from '@/components/sprints/SprintTimingInfo'
import { useSprintStatusActions } from '@/components/sprints/SprintStatusActions'
import {
  formatSprintRange, SPRINT_STATUS_VARIANTS, GOAL_MET_VARIANTS, completedTimePct,
} from '@/components/sprints/sprintFormat'
import type { SprintChartSeries } from '@/components/ui/SprintLineChart'
import { countWorkingDays } from '@/utils/date'
import { sprintCapacityHours, sprintWorkingDays, formatNumber } from '@/utils/capacity'
import { suggestNextSprintDates, suggestSprintName } from '@/utils/sprint'
import { usePagePermission } from '@/hooks/usePagePermission'
import {
  Plus, Zap, Calendar, Target, ChevronRight, Pencil, Trash2, TrendingUp, BarChart3, Gauge, Clock, CalendarPlus,
  MoreHorizontal, ListFilter, CheckCircle2, CircleDashed, XCircle, LineChart, Table2,
} from 'lucide-react'
import type { Sprint, SprintStatus, SprintGoalMet } from '@/types'

type View = 'list' | 'analysis' | 'capacity'
type StatusFilter = SprintStatus | 'Alle'

const VIEWS: View[] = ['list', 'analysis', 'capacity']
const STATUS_FILTERS: StatusFilter[] = ['Alle', 'Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

// Order of the groups in the "Alle" filter: what's running first, then what's next, then history
const STATUS_GROUPS: SprintStatus[] = ['Aktiv', 'Geplant', 'Abgeschlossen', 'Abgebrochen']

// Number of finished sprints shown per group in the "Alle" overview
const HISTORY_PREVIEW = 6

/** Running and upcoming sprints in chronological order, history newest first. */
function sortForStatus(list: Sprint[], status: SprintStatus): Sprint[] {
  const ascending = status === 'Aktiv' || status === 'Geplant'
  return [...list].sort((a, b) => ascending ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate))
}

// ─── Chart series definitions ─────────────────────────────────────────────────
const CHART_SERIES: (Omit<SprintChartSeries, 'label'> & { labelKey: string })[] = [
  { key: 'capacityHours',    labelKey: 'sprints.tableCapacityH',        color: '#6366f1' },
  { key: 'remainingHours',   labelKey: 'sprints.tableRemainingH',       color: '#f59e0b' },
  { key: 'averageBurndown',  labelKey: 'sprints.tableAvgBurndown',      color: '#10b981', dashed: true },
  { key: 'completedTimePct', labelKey: 'sprints.chartCompletedTimePct', color: '#8b5cf6' },
  { key: 'completedItems',   labelKey: 'sprints.tableCompletedItems',   color: '#ec4899' },
  { key: 'velocity',         labelKey: 'sprints.tableVelocity',         color: '#0ea5e9' },
]

export default function SprintsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { canWrite, isReadOnly } = usePagePermission('sprints')
  const sprints = useStore((s) => s.sprints)
  const deleteSprint = useStore((s) => s.deleteSprint)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Sprint | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)

  // View + status filter live in the URL so that "back" from a sprint restores them
  const viewParam = searchParams.get('view') as View | null
  const view: View = viewParam && VIEWS.includes(viewParam) ? viewParam : 'list'
  const statusParam = searchParams.get('status') as StatusFilter | null
  const status: StatusFilter = statusParam && STATUS_FILTERS.includes(statusParam) ? statusParam : 'Alle'

  function setParam(key: 'view' | 'status', value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const countByStatus = (s: SprintStatus) => sprints.filter((sp) => sp.status === s).length

  const groups = (status === 'Alle' ? STATUS_GROUPS : [status])
    .map((st) => ({ status: st, sprints: sortForStatus(sprints.filter((s) => s.status === st), st) }))
    // The "Geplant" group always shows the suggestion for the next sprint
    .filter((g) => g.sprints.length > 0 || (g.status === 'Geplant' && canWrite))

  function openAdd() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEdit(sp: Sprint) {
    setEditTarget(sp)
    setShowModal(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteSprint(deleteTarget.id)
      toast.success(t('sprints.deletedToast', { name: deleteTarget.name }))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const cardProps = (sp: Sprint) => ({
    sprint: sp,
    canWrite,
    onEdit: () => openEdit(sp),
    onDelete: () => setDeleteTarget(sp),
  })

  return (
    <Page>
      <PageHeader
        icon={Zap}
        title={t('sprints.title')}
        subtitle={t('sprints.count', { count: sprints.length })}
        actions={canWrite && (
          <Button variant="primary" icon={<Plus />} onClick={openAdd}>
            {t('sprints.newSprint')}
          </Button>
        )}
      >
        <Tabs<View>
          aria-label={t('sprints.views')}
          value={view}
          onChange={(v) => setParam('view', v === 'list' ? null : v)}
          items={[
            { value: 'list', label: t('sprints.title'), icon: Zap, count: sprints.length },
            { value: 'analysis', label: t('sprints.analysis'), icon: BarChart3 },
            { value: 'capacity', label: t('capacity.tab'), icon: Gauge },
          ]}
        />
      </PageHeader>

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      {/* ── Capacity view ── */}
      {view === 'capacity' && <CapacityOverview />}

      {/* ── Analysis view ── */}
      {view === 'analysis' && <AnalysisView sprints={sprints} />}

      {/* ── Sprint list ── */}
      {view === 'list' && (
        <div className="space-y-8">
          {sprints.length > 0 && (
            <Tabs<StatusFilter>
              variant="pills"
              size="sm"
              aria-label={t('sprints.statusFilter')}
              value={status}
              onChange={(v) => setParam('status', v === 'Alle' ? null : v)}
              items={STATUS_FILTERS.map((s) => ({
                value: s,
                label: s === 'Alle' ? t('common.all') : t(`sprintStatus.${s}`),
                count: s === 'Alle' ? sprints.length : countByStatus(s),
              }))}
            />
          )}

          {sprints.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon={<Zap />}
                title={t('sprints.noSprints')}
                description={t('sprints.noSprintsSubtitle')}
                action={canWrite ? <Button variant="primary" icon={<Plus />} onClick={openAdd}>{t('sprints.newSprint')}</Button> : undefined}
              />
            </div>
          ) : groups.length === 0 ? (
            <div className="surface">
              <EmptyState
                compact
                icon={<ListFilter />}
                title={t('sprints.noSprintsInTab')}
                action={<Button variant="secondary" size="sm" onClick={() => setParam('status', null)}>{t('common.resetFilters')}</Button>}
              />
            </div>
          ) : (
            groups.map(({ status: groupStatus, sprints: list }) => (
              <section key={groupStatus} aria-label={t(`sprintStatus.${groupStatus}`)}>
                {status === 'Alle' && <SectionHeader title={t(`sprintStatus.${groupStatus}`)} count={list.length} />}

                {groupStatus === 'Aktiv' && (
                  <div className="space-y-3">
                    {list.map((sp) => <ActiveSprintCard key={sp.id} {...cardProps(sp)} />)}
                  </div>
                )}

                {groupStatus === 'Geplant' && (
                  <div className="space-y-3">
                    {list.map((sp) => <PlannedSprintCard key={sp.id} {...cardProps(sp)} />)}
                    {canWrite && <NextSprintSuggestion sprints={sprints} onClick={openAdd} />}
                  </div>
                )}

                {(groupStatus === 'Abgeschlossen' || groupStatus === 'Abgebrochen') && (
                  <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
                    {(status === 'Alle' ? list.slice(0, HISTORY_PREVIEW) : list).map((sp) => (
                      <HistoryRow key={sp.id} {...cardProps(sp)} />
                    ))}
                    {status === 'Alle' && list.length > HISTORY_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setParam('status', groupStatus)}
                        className="flex w-full items-center justify-center gap-1 rounded-b-xl px-4 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800/40"
                      >
                        {t('sprints.showAll', { count: list.length })}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
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
        onConfirm={confirmDelete}
        title={t('sprints.deleteSprint')}
        message={t('sprints.deleteConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('common.delete')}
      />
    </Page>
  )
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

interface SprintItemProps {
  sprint: Sprint
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
}

/** Title link that stretches over the whole card (actions placed after it stay clickable). */
function SprintLink({ sprint, className = '' }: { sprint: Sprint; className?: string }) {
  return (
    <Link
      to={`/sprints/${sprint.id}`}
      className={`rounded-sm text-slate-900 transition-colors after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300 ${className}`}
    >
      {sprint.name}
    </Link>
  )
}

function SprintMenu({ statusItems, onEdit, onDelete, className = '' }: {
  statusItems: DropdownItem[]
  onEdit: () => void
  onDelete: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const items: DropdownItem[] = [
    { label: t('sprints.editSprint'), icon: <Pencil />, onClick: onEdit },
    ...statusItems,
    { type: 'divider' },
    { label: t('sprints.deleteSprint'), icon: <Trash2 />, onClick: onDelete, danger: true },
  ]
  return (
    <DropdownMenu
      className={className}
      items={items}
      trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('common.moreActions')} />}
    />
  )
}

function SprintGoal({ goal, clamp = true, className = '' }: { goal: string; clamp?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={`flex items-start gap-2 text-sm ${className}`}>
      <Target className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      {goal
        ? <p className={`min-w-0 text-slate-700 dark:text-slate-300 ${clamp ? 'line-clamp-2' : ''}`} title={goal}>{goal}</p>
        : <p className="text-slate-400 dark:text-slate-500">{t('sprints.noGoal')}</p>}
    </div>
  )
}

const GOAL_MET_ICONS: Record<SprintGoalMet, ReactNode> = {
  Ja: <CheckCircle2 />,
  Teilweise: <CircleDashed />,
  Nein: <XCircle />,
}

function GoalMetBadge({ value, short = false }: { value: SprintGoalMet; short?: boolean }) {
  const { t } = useTranslation()
  return (
    <Badge
      label={short ? t(`sprintDetail.goalMet_${value}`) : t(`sprints.goalMetBadge_${value}`)}
      variant={GOAL_MET_VARIANTS[value]}
      icon={GOAL_MET_ICONS[value]}
    />
  )
}

function useCapacityHours(sprint: Sprint): number | null {
  const activities = useStore((s) => s.capacityActivities)
  const members = useStore((s) => s.members)
  return sprint.capacity.length > 0
    ? sprintCapacityHours(sprint, activities, new Set(members.map((m) => m.id)))
    : null
}

function MetaItem({ icon, children, title }: { icon: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 [&_svg]:text-slate-400 dark:[&_svg]:text-slate-500" title={title}>
      {icon}
      {children}
    </span>
  )
}

// ─── Active sprint (highlighted) ──────────────────────────────────────────────

function ActiveSprintCard({ sprint, canWrite, onEdit, onDelete }: SprintItemProps) {
  const { t } = useTranslation()
  const capacityHours = useCapacityHours(sprint)
  const { primaryAction, menuItems, dialogs } = useSprintStatusActions(sprint, { size: 'sm' })

  const facts: { label: string; value: ReactNode }[] = [
    { label: t('capacity.sprintCapacity'), value: capacityHours !== null ? `${formatNumber(capacityHours)} h` : '—' },
    { label: t('sprints.members'), value: sprint.capacity.length || '—' },
    { label: t('sprintDetail.plannedPoints'), value: sprint.plannedPoints || '—' },
    { label: t('capacity.workingDays'), value: formatNumber(sprintWorkingDays(sprint)) },
  ]

  return (
    <article className="surface-interactive group relative border-indigo-200/80 bg-gradient-to-b from-indigo-50/70 via-white to-white p-5 hover:border-indigo-300 sm:p-6 dark:border-indigo-500/25 dark:from-indigo-500/[0.08] dark:via-slate-900 dark:to-slate-900 dark:hover:border-indigo-400/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SprintLink sprint={sprint} className="text-lg font-semibold tracking-tight" />
            <Badge label={t('sprintStatus.Aktiv')} variant="indigo" dot />
            {sprint.goalMet && <GoalMetBadge value={sprint.goalMet} />}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {formatSprintRange(sprint.startDate, sprint.endDate)}
          </p>
        </div>
        {canWrite && (
          <div className="relative flex items-center gap-1.5">
            {primaryAction}
            <SprintMenu statusItems={menuItems} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>

      <SprintGoal goal={sprint.goal} className="mt-4" />

      <SprintTimeline sprint={sprint} className="mt-5" />

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-slate-200/70 ring-1 ring-slate-200/70 sm:grid-cols-4 dark:bg-slate-800 dark:ring-slate-800">
        {facts.map((f) => (
          <div key={f.label} className="bg-white/90 px-3.5 py-2.5 dark:bg-slate-900">
            <dt className="truncate text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{f.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{f.value}</dd>
          </div>
        ))}
      </dl>
      {dialogs}
    </article>
  )
}

// ─── Planned sprint ───────────────────────────────────────────────────────────

function PlannedSprintCard({ sprint, canWrite, onEdit, onDelete }: SprintItemProps) {
  const { t } = useTranslation()
  const capacityHours = useCapacityHours(sprint)
  const { primaryAction, menuItems, dialogs } = useSprintStatusActions(sprint, { size: 'sm', startVariant: 'secondary' })

  return (
    <article className="surface-interactive group relative px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SprintLink sprint={sprint} className="font-semibold" />
            <Badge label={t(`sprintStatus.${sprint.status}`)} variant={SPRINT_STATUS_VARIANTS[sprint.status]} dot />
          </div>
          <SprintGoal goal={sprint.goal} className="mt-1.5" />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <MetaItem icon={<Calendar />}>
              {formatSprintRange(sprint.startDate, sprint.endDate)}
              <span className="text-slate-400 dark:text-slate-500">· {t('sprints.workingDays', { count: countWorkingDays(sprint.startDate, sprint.endDate) })}</span>
            </MetaItem>
            {capacityHours !== null && (
              <MetaItem icon={<Clock />} title={t('capacity.sprintCapacity')}>
                {t('sprints.capacityShort', { hours: formatNumber(capacityHours) })}
              </MetaItem>
            )}
            {sprint.plannedPoints > 0 && (
              <MetaItem icon={<Target />}>{t('sprints.plannedPointsShort', { count: sprint.plannedPoints })}</MetaItem>
            )}
            <SprintTimingInfo sprint={sprint} />
          </div>
        </div>
        {canWrite && (
          <div className="relative flex items-center gap-1.5">
            {primaryAction}
            <SprintMenu statusItems={menuItems} onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>
      {dialogs}
    </article>
  )
}

// ─── Finished sprint (compact row) ────────────────────────────────────────────

function HistoryRow({ sprint, canWrite, onEdit, onDelete }: SprintItemProps) {
  const { t } = useTranslation()
  const capacityHours = useCapacityHours(sprint)
  const { menuItems, dialogs } = useSprintStatusActions(sprint, { size: 'sm' })

  const meta = (
    <>
      {capacityHours !== null && (
        <MetaItem icon={<Clock />} title={t('capacity.sprintCapacity')}>{formatNumber(capacityHours)} h</MetaItem>
      )}
      {sprint.velocity != null && (
        <MetaItem icon={<TrendingUp />} title={t('sprintDetail.velocity')}>{t('sprints.velocityShort', { count: sprint.velocity })}</MetaItem>
      )}
    </>
  )

  return (
    <div className="group relative flex items-center gap-4 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/80 sm:px-5 dark:hover:bg-slate-800/30">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SprintLink sprint={sprint} className="text-sm font-semibold" />
          {sprint.goalMet && <GoalMetBadge value={sprint.goalMet} />}
        </div>
        <p className={`mt-0.5 truncate text-sm ${sprint.goal ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`} title={sprint.goal || undefined}>
          {sprint.goal || t('sprints.noGoal')}
        </p>
        {/* Mobile: meta below the goal */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:hidden dark:text-slate-400">
          <span className="tabular-nums">{formatSprintRange(sprint.startDate, sprint.endDate)}</span>
          {meta}
        </div>
      </div>
      <div className="hidden shrink-0 text-right text-xs text-slate-500 sm:block dark:text-slate-400">
        <p className="tabular-nums">{formatSprintRange(sprint.startDate, sprint.endDate)}</p>
        <div className="mt-1 flex justify-end gap-3">{meta}</div>
      </div>
      <div className="relative flex shrink-0 items-center gap-1">
        {canWrite && (
          <SprintMenu
            statusItems={menuItems}
            onEdit={onEdit}
            onDelete={onDelete}
            className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          />
        )}
        <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" aria-hidden />
      </div>
      {dialogs}
    </div>
  )
}

// ─── Next sprint suggestion ───────────────────────────────────────────────────

function NextSprintSuggestion({ sprints, onClick }: { sprints: Sprint[]; onClick: () => void }) {
  const { t } = useTranslation()
  const { startDate, endDate } = suggestNextSprintDates(sprints)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 px-5 py-4 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/[0.06]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-indigo-500/15 dark:group-hover:text-indigo-300">
        <CalendarPlus className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-700 transition-colors group-hover:text-indigo-700 dark:text-slate-200 dark:group-hover:text-indigo-300">
          {t('sprints.planNext', { name: suggestSprintName(sprints) })}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
          {formatSprintRange(startDate, endDate)} · {t('sprints.workingDays', { count: countWorkingDays(startDate, endDate) })}
        </span>
      </span>
      <Plus className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-500" />
    </button>
  )
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function average(values: (number | null | undefined)[]): number | undefined {
  const vals = values.filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
}

function AnalysisView({ sprints }: { sprints: Sprint[] }) {
  const { t } = useTranslation()
  const [activeSeriesKeys, setActiveSeriesKeys] = useState<Set<string>>(new Set(CHART_SERIES.map((s) => s.key)))

  // Completed sprints in chronological order
  const chartSprints = sprints
    .filter((s) => s.status === 'Abgeschlossen')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  if (chartSprints.length < 2) {
    return (
      <div className="surface">
        <EmptyState icon={<BarChart3 />} title={t('sprints.analysisEmpty')} description={t('sprints.analysisEmptySubtitle')} />
      </div>
    )
  }

  const chartData = chartSprints.map((sp) => ({
    sprintName: sp.name,
    capacityHours:    sp.capacityHours,
    remainingHours:   sp.remainingHours,
    averageBurndown:  sp.averageBurndown,
    completedTimePct: completedTimePct(sp.capacityHours, sp.remainingHours) ?? undefined,
    completedItems:   sp.completedItems,
    velocity:         sp.velocity,
  }))

  const allSeries: SprintChartSeries[] = CHART_SERIES.map(({ labelKey, ...s }) => ({ ...s, label: t(labelKey) }))
  const activeSeries = allSeries.filter((s) => activeSeriesKeys.has(s.key))

  function toggleSeries(key: string) {
    setActiveSeriesKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) }
      else next.add(key)
      return next
    })
  }

  const avgVelocity = average(chartSprints.map((sp) => sp.velocity))
  const avgPct = average(chartSprints.map((sp) => completedTimePct(sp.capacityHours, sp.remainingHours)))
  const rated = chartSprints.filter((sp) => sp.goalMet)
  const goalMet = rated.filter((sp) => sp.goalMet === 'Ja').length

  const avgOf = (key: (sp: Sprint) => number | undefined) => average(chartSprints.map(key))
  const thBase = 'px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap'
  const thCls = `${thBase} text-right`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('sprints.kpiCompleted')} value={chartSprints.length} icon={CheckCircle2} tone="emerald" />
        <StatCard
          label={t('sprints.kpiAvgVelocity')}
          value={avgVelocity !== undefined ? formatNumber(avgVelocity) : '—'}
          hint={t('sprints.kpiStoryPoints')}
          icon={TrendingUp}
          tone="sky"
        />
        <StatCard
          label={t('sprints.kpiAvgCompletedTime')}
          value={avgPct !== undefined ? `${Math.round(avgPct)} %` : '—'}
          hint={t('sprints.kpiOfCapacity')}
          icon={Clock}
          tone="violet"
        />
        <StatCard
          label={t('sprints.kpiGoalMet')}
          value={rated.length > 0 ? `${goalMet} / ${rated.length}` : '—'}
          hint={rated.length > 0 ? t('sprints.kpiGoalMetHint', { pct: Math.round((goalMet / rated.length) * 100) }) : undefined}
          icon={Target}
          tone="indigo"
        />
      </div>

      <Card title={t('sprints.trend')} subtitle={t('sprints.trendHint')} icon={<LineChart />}>
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={t('sprints.series')}>
          {allSeries.map((s) => (
            <Chip key={s.key} active={activeSeriesKeys.has(s.key)} dotColor={s.color} onClick={() => toggleSeries(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>
        <SprintLineChart series={activeSeries} data={chartData} height={280} />
      </Card>

      <Card title={t('sprints.tableTitle')} icon={<Table2 />} padding={false}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
                <th className={`${thBase} text-left`}>{t('sprints.tableSprint')}</th>
                <th className={thCls}>{t('sprints.tableCapacityH')}</th>
                <th className={thCls}>{t('sprints.tableRemainingH')}</th>
                <th className={thCls}>{t('sprints.tableAvgBurndown')}</th>
                <th className={thCls}>{t('sprints.tableCompletedTimePct')}</th>
                <th className={thCls}>{t('sprints.tableCompletedItems')}</th>
                <th className={thCls}>{t('sprints.tableVelocity')}</th>
                <th className={thCls}>{t('sprints.tableGoalMet')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {chartSprints.map((sp) => {
                const pct = completedTimePct(sp.capacityHours, sp.remainingHours)
                return (
                  <tr key={sp.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link to={`/sprints/${sp.id}`} className="font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                        {sp.name}
                      </Link>
                    </td>
                    <Num val={sp.capacityHours} />
                    <Num val={sp.remainingHours} />
                    <Num val={sp.averageBurndown} decimal />
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {pct !== null ? `${pct} %` : <Dash />}
                    </td>
                    <Num val={sp.completedItems} />
                    <Num val={sp.velocity} />
                    <td className="px-4 py-2.5 text-right">
                      {sp.goalMet ? <GoalMetBadge value={sp.goalMet} short /> : <Dash />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                <td className="px-4 py-2.5"><span className="section-label">{t('common.average')}</span></td>
                <AvgNum val={avgOf((sp) => sp.capacityHours)} />
                <AvgNum val={avgOf((sp) => sp.remainingHours)} />
                <AvgNum val={avgOf((sp) => sp.averageBurndown)} decimal />
                <td className="px-4 py-2.5 text-right tabular-nums">{avgPct !== undefined ? `${Math.round(avgPct)} %` : '—'}</td>
                <AvgNum val={avgOf((sp) => sp.completedItems)} />
                <AvgNum val={avgOf((sp) => sp.velocity)} />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ─── Table helpers ────────────────────────────────────────────────────────────

function Dash() {
  return <span className="text-slate-300 dark:text-slate-600">—</span>
}

function Num({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
      {val !== undefined && val !== null ? (decimal ? val.toFixed(1) : val) : <Dash />}
    </td>
  )
}

function AvgNum({ val, decimal }: { val?: number; decimal?: boolean }) {
  return (
    <td className="px-4 py-2.5 text-right tabular-nums">
      {val !== undefined ? (decimal ? val.toFixed(1) : Math.round(val)) : '—'}
    </td>
  )
}
