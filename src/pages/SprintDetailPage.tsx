import { useRef, useState, useEffect, useId, type ReactNode } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu'
import IconButton from '@/components/ui/IconButton'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SprintCapacitySection from '@/components/sprints/SprintCapacitySection'
import SprintFormModal from '@/components/sprints/SprintFormModal'
import SprintTimeline from '@/components/sprints/SprintTimeline'
import { useSprintStatusActions } from '@/components/sprints/SprintStatusActions'
import { formatSprintRange, SPRINT_STATUS_VARIANTS, completedTimePct } from '@/components/sprints/sprintFormat'
import { countWorkingDays } from '@/utils/date'
import { chronological } from '@/utils/sprint'
import { usePagePermission } from '@/hooks/usePagePermission'
import {
  Calendar, Target, Pencil, TrendingUp, CheckCircle2, Star, AlertTriangle, StickyNote, Flame, Clock,
  ChevronLeft, ChevronRight, ChevronDown, ListChecks, MoreHorizontal, Trash2, Zap, Percent,
  XCircle, CircleDashed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Sprint, SprintGoalMet } from '@/types'

const GOAL_MET_VALUES: SprintGoalMet[] = ['Ja', 'Teilweise', 'Nein']

export default function SprintDetailPage() {
  const { t } = useTranslation()
  const { sprintId } = useParams<{ sprintId: string }>()
  const navigate = useNavigate()
  const sprints = useStore((s) => s.sprints)
  const sprint = sprints.find((s) => s.id === sprintId)

  if (!sprint) {
    return (
      <Page>
        <PageHeader back={{ to: '/sprints', label: t('sprints.title') }} title={t('sprints.title')} />
        <div className="surface">
          <EmptyState
            icon={<Zap />}
            title={t('sprintDetail.notFound')}
            action={<Button variant="secondary" icon={<ChevronLeft />} onClick={() => navigate('/sprints')}>{t('common.back')}</Button>}
          />
        </div>
      </Page>
    )
  }

  // Keyed so that local UI state resets when navigating to the previous / next sprint
  return <SprintDetail key={sprint.id} sprint={sprint} onDeleted={() => navigate('/sprints', { replace: true })} />
}

function SprintDetail({ sprint: sp, onDeleted }: { sprint: Sprint; onDeleted: () => void }) {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('sprints')
  const sprints = useStore((s) => s.sprints)
  const updateSprint = useStore((s) => s.updateSprint)
  const deleteSprint = useStore((s) => s.deleteSprint)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const status = useSprintStatusActions(sp, { reopenAsButton: true })

  const ordered = chronological(sprints)
  const position = ordered.findIndex((s) => s.id === sp.id)
  const prev = ordered[position - 1]
  const next = ordered[position + 1]

  const isFinished = sp.status === 'Abgeschlossen' || sp.status === 'Abgebrochen'
  // Result metrics are only relevant once the sprint has started
  const resultsVisible = sp.status !== 'Geplant' || showResults

  async function update(field: string, value: unknown) {
    try {
      await updateSprint(sp.id, { [field]: value } as Parameters<typeof updateSprint>[1])
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function handleDelete() {
    try {
      await deleteSprint(sp.id)
      toast.success(t('sprints.deletedToast', { name: sp.name }))
      onDeleted()
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const menuItems: DropdownItem[] = [
    ...status.menuItems,
    ...(status.menuItems.length > 0 ? [{ type: 'divider' } as const] : []),
    { label: t('sprints.deleteSprint'), icon: <Trash2 />, onClick: () => setShowDelete(true), danger: true },
  ]

  const metrics = (
    <Card title={t('sprintDetail.metrics')} icon={<ListChecks />}>
      <div className="space-y-6">
        <MetricGroup label={t('sprintDetail.planning')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricBox
              label={t('sprintDetail.plannedPoints')}
              value={sp.plannedPoints || undefined}
              icon={<Target />}
              onSave={(v) => update('plannedPoints', v ?? 0)}
              readOnly={!canWrite}
            />
            <MetricBox
              label={t('sprintDetail.plannedItems')}
              value={sp.plannedItems}
              icon={<CheckCircle2 />}
              onSave={(v) => update('plannedItems', v)}
              readOnly={!canWrite}
            />
            <MetricBox
              label={t('sprintDetail.capacityHours')}
              value={sp.capacityHours}
              icon={<Clock />}
              onSave={(v) => update('capacityHours', v)}
              readOnly={!canWrite}
            />
          </div>
        </MetricGroup>

        {resultsVisible ? (
          <>
            <MetricGroup label={t('sprintDetail.results')}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricBox
                  label={t('sprintDetail.velocity')}
                  value={sp.velocity}
                  icon={<TrendingUp />}
                  onSave={(v) => update('velocity', v)}
                  readOnly={!canWrite}
                />
                <MetricBox
                  label={t('sprintDetail.completedItems')}
                  value={sp.completedItems}
                  icon={<CheckCircle2 />}
                  onSave={(v) => update('completedItems', v)}
                  readOnly={!canWrite}
                />
                <MetricBox
                  label={t('sprintDetail.remainingHours')}
                  value={sp.remainingHours}
                  icon={<Clock />}
                  onSave={(v) => update('remainingHours', v)}
                  readOnly={!canWrite}
                />
                <MetricBox
                  label={t('sprintDetail.averageBurndown')}
                  value={sp.averageBurndown}
                  icon={<Flame />}
                  onSave={(v) => update('averageBurndown', v)}
                  decimal
                  readOnly={!canWrite}
                />
                <CompletedTimeBox
                  capacityHours={sp.capacityHours}
                  remainingHours={sp.remainingHours}
                  label={t('sprintDetail.completedTimePercent')}
                />
              </div>
            </MetricGroup>

            <div className="grid gap-6 sm:grid-cols-2">
              <MetricGroup label={t('sprintDetail.goalMet')}>
                <GoalMetSelector value={sp.goalMet} readOnly={!canWrite} onChange={(v) => update('goalMet', v)} />
              </MetricGroup>
              <MetricGroup label={t('sprintDetail.teamSatisfaction')}>
                <StarRating value={sp.teamSatisfaction} onChange={(v) => update('teamSatisfaction', v)} readOnly={!canWrite} />
              </MetricGroup>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowResults(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400"
          >
            <ChevronDown className="h-4 w-4 shrink-0" /> {t('sprintDetail.showResults')}
          </button>
        )}
      </div>
    </Card>
  )

  const capacity = <SprintCapacitySection sprint={sp} canWrite={canWrite} />

  return (
    <Page size="wide">
      <PageHeader
        back={{ to: '/sprints', label: t('sprints.title') }}
        title={sp.name}
        meta={<Badge label={t(`sprintStatus.${sp.status}`)} variant={SPRINT_STATUS_VARIANTS[sp.status]} dot />}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {formatSprintRange(sp.startDate, sp.endDate)}
            <span className="text-slate-300 dark:text-slate-600">·</span>
            {t('sprints.workingDays', { count: countWorkingDays(sp.startDate, sp.endDate) })}
          </span>
        }
        actions={
          <>
            <SprintPager prev={prev} next={next} />
            {canWrite && (
              <>
                {status.primaryAction}
                <Button variant="secondary" icon={<Pencil />} onClick={() => setShowEditModal(true)} title={t('sprints.editSprint')}>
                  <span className="max-sm:sr-only">{t('common.edit')}</span>
                </Button>
                <DropdownMenu
                  items={menuItems}
                  trigger={(p) => <IconButton {...p} variant="secondary" size="md" icon={<MoreHorizontal />} label={t('common.moreActions')} />}
                />
              </>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {isReadOnly && <ReadOnlyBanner />}

        {/* Goal + time frame */}
        <section className="surface grid gap-x-8 gap-y-5 p-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <p className="section-label mb-2">{t('sprints.sprintGoal')}</p>
            <InlineGoal value={sp.goal} readOnly={!canWrite} onSave={(goal) => update('goal', goal)} />
          </div>
          <div className="min-w-0 md:border-l md:border-slate-100 md:pl-8 dark:md:border-slate-800">
            <p className="section-label mb-2">{t('sprints.timeframe')}</p>
            <SprintTimeline sprint={sp} />
          </div>
        </section>

        {/* Finished sprints are about results, upcoming / running ones about planning */}
        {isFinished ? <>{metrics}{capacity}</> : <>{capacity}{metrics}</>}

        <div className="grid gap-6 lg:grid-cols-2">
          <InlineTextSection
            label={t('sprintDetail.impediments')}
            icon={<AlertTriangle />}
            value={sp.impediments}
            onSave={(v) => update('impediments', v)}
            placeholder={t('sprintDetail.impedimentsPlaceholder')}
            readOnly={!canWrite}
          />
          <InlineTextSection
            label={t('sprints.notesLabel')}
            icon={<StickyNote />}
            value={sp.notes}
            onSave={(v) => update('notes', v)}
            placeholder={t('sprints.notesPlaceholder')}
            readOnly={!canWrite}
          />
        </div>
      </div>

      <SprintFormModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} sprint={sp} />
      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={t('sprints.deleteSprint')}
        message={t('sprints.deleteConfirm', { name: sp.name })}
        confirmLabel={t('common.delete')}
      />
      {status.dialogs}
    </Page>
  )
}

// ─── SprintPager ──────────────────────────────────────────────────────────────

function SprintPager({ prev, next }: { prev?: Sprint; next?: Sprint }) {
  const { t } = useTranslation()
  if (!prev && !next) return null
  const cls = 'inline-flex h-9 items-center gap-1 px-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  const disabledCls = 'inline-flex h-9 items-center px-2.5 text-slate-300 dark:text-slate-600'
  return (
    <nav
      aria-label={t('sprintDetail.navigation')}
      className="inline-flex items-stretch divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/80"
    >
      {prev ? (
        <Link to={`/sprints/${prev.id}`} className={cls} title={`${t('sprintDetail.previous')}: ${prev.name}`} aria-label={`${t('sprintDetail.previous')}: ${prev.name}`}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden max-w-[8rem] truncate xl:inline">{prev.name}</span>
        </Link>
      ) : (
        <span className={disabledCls} aria-hidden><ChevronLeft className="h-4 w-4" /></span>
      )}
      {next ? (
        <Link to={`/sprints/${next.id}`} className={cls} title={`${t('sprintDetail.next')}: ${next.name}`} aria-label={`${t('sprintDetail.next')}: ${next.name}`}>
          <span className="hidden max-w-[8rem] truncate xl:inline">{next.name}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={disabledCls} aria-hidden><ChevronRight className="h-4 w-4" /></span>
      )}
    </nav>
  )
}

// ─── MetricGroup ──────────────────────────────────────────────────────────────

function MetricGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="section-label mb-2.5">{label}</p>
      {children}
    </div>
  )
}

// ─── InlineGoal ───────────────────────────────────────────────────────────────
// Sprint goal shown as text; click to edit, Enter / blur saves, Escape discards.

function InlineGoal({ value, onSave, readOnly }: { value: string; onSave: (v: string) => void; readOnly: boolean }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!editing) setText(value)
  }, [value, editing])

  function commit() {
    setEditing(false)
    if (cancelRef.current) { cancelRef.current = false; setText(value); return }
    if (text.trim() !== value) onSave(text.trim())
  }

  if (editing) {
    return (
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur() }
          }}
          rows={2}
          autoFocus
          aria-label={t('sprints.sprintGoal')}
          placeholder={t('sprints.sprintGoalPlaceholder')}
          className="form-textarea"
        />
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{t('sprintDetail.goalEditHint')}</p>
      </div>
    )
  }

  if (readOnly) {
    return value
      ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{value}</p>
      : <p className="text-sm text-slate-400 dark:text-slate-500">{t('sprints.noGoal')}</p>
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={t('sprintDetail.editGoal')}
      className="group -mx-2 -my-1 flex w-[calc(100%+1rem)] items-start gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
    >
      {value
        ? <span className="flex-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{value}</span>
        : <span className="flex-1 text-sm text-slate-400 dark:text-slate-500">{t('sprintDetail.addGoal')}</span>}
      <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100" />
    </button>
  )
}

// ─── MetricBox ────────────────────────────────────────────────────────────────

const metricBoxCls = 'rounded-xl bg-slate-50/80 p-3.5 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/50'

function MetricLabel({ icon, label, id }: { icon: ReactNode; label: string; id?: string }) {
  return (
    <div id={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
      {icon}
      <span className="leading-tight">{label}</span>
    </div>
  )
}

function MetricBox({
  label, value, icon, onSave, decimal = false, readOnly = false,
}: {
  label: string
  value?: number
  icon: ReactNode
  onSave: (v: number | null) => void
  decimal?: boolean
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const labelId = useId()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const cancelRef = useRef(false)

  function startEdit() {
    if (readOnly) return
    setInput(value?.toString() ?? '')
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (cancelRef.current) { cancelRef.current = false; return }
    const trimmed = input.trim()
    const v = trimmed === '' ? null : (decimal ? parseFloat(trimmed.replace(',', '.')) : parseInt(trimmed, 10))
    if ((trimmed === '' || !isNaN(v as number)) && v !== (value ?? null)) onSave(v)
  }

  const hasValue = value !== undefined && value !== null

  return (
    <div className={metricBoxCls}>
      <MetricLabel icon={icon} label={label} id={labelId} />
      {editing ? (
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur() }
          }}
          aria-labelledby={labelId}
          className="form-input form-sm -my-px text-base font-semibold tabular-nums"
          step={decimal ? 'any' : 1}
          autoFocus
          min={0}
        />
      ) : readOnly ? (
        <p className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {hasValue ? value : <span className="text-base font-normal text-slate-300 dark:text-slate-600">—</span>}
        </p>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          aria-labelledby={labelId}
          title={t('common.edit')}
          className="group -mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 rounded-md px-1 text-left text-xl font-semibold tabular-nums text-slate-900 transition-colors hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
        >
          {hasValue ? value : <span className="text-base font-normal text-slate-300 dark:text-slate-600" aria-label={t('sprintDetail.enterValue')}>—</span>}
          <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>
      )}
    </div>
  )
}

// ─── CompletedTimeBox ─────────────────────────────────────────────────────────

function CompletedTimeBox({ label, capacityHours, remainingHours }: {
  label: string
  capacityHours?: number
  remainingHours?: number
}) {
  const pct = completedTimePct(capacityHours, remainingHours)

  const color =
    pct === null ? ''
    : pct >= 75 ? 'text-emerald-600 dark:text-emerald-400'
    : pct >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400'
  const bar =
    pct === null ? ''
    : pct >= 75 ? 'bg-emerald-500'
    : pct >= 40 ? 'bg-amber-500'
    : 'bg-red-500'

  return (
    <div className={metricBoxCls}>
      <MetricLabel icon={<Percent />} label={label} />
      {pct !== null ? (
        <>
          <p className={`text-xl font-semibold tabular-nums ${color}`}>{pct} %</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
          </div>
        </>
      ) : (
        <p className="text-xl font-semibold"><span className="text-base font-normal text-slate-300 dark:text-slate-600">—</span></p>
      )}
    </div>
  )
}

// ─── GoalMetSelector ──────────────────────────────────────────────────────────

const GOAL_MET_STYLE: Record<SprintGoalMet, { active: string; icon: ReactNode }> = {
  Ja: {
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/40',
    icon: <CheckCircle2 />,
  },
  Teilweise: {
    active: 'bg-amber-50 text-amber-800 ring-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/40',
    icon: <CircleDashed />,
  },
  Nein: {
    active: 'bg-red-50 text-red-700 ring-red-500/40 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/40',
    icon: <XCircle />,
  },
}

function GoalMetSelector({ value, onChange, readOnly }: { value?: SprintGoalMet | null; onChange: (v: SprintGoalMet | null) => void; readOnly: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('sprintDetail.goalMet')}>
      {GOAL_MET_VALUES.map((v) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => !readOnly && onChange(active ? null : v)}
            disabled={readOnly}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium ring-1 ring-inset transition-colors disabled:cursor-not-allowed [&_svg]:h-4 [&_svg]:w-4 ${
              active
                ? GOAL_MET_STYLE[v].active
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            {active && GOAL_MET_STYLE[v].icon}
            {t(`sprintDetail.goalMet_${v}`)}
          </button>
        )
      })}
    </div>
  )
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readOnly = false }: { value?: number; onChange: (v: number | null) => void; readOnly?: boolean }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('sprintDetail.teamSatisfaction')} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange(value === star ? null : star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          disabled={readOnly}
          aria-label={t('sprintDetail.starLabel', { count: star })}
          aria-pressed={value === star}
          className={`rounded-md p-0.5 transition-colors ${
            star <= shown ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'
          } ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
        >
          <Star className="h-7 w-7" fill={star <= shown ? 'currentColor' : 'none'} />
        </button>
      ))}
      {value ? <span className="ml-2 text-sm tabular-nums text-slate-500 dark:text-slate-400">{value} / 5</span> : null}
    </div>
  )
}

// ─── InlineTextSection ────────────────────────────────────────────────────────

function InlineTextSection({
  label, icon, value, onSave, placeholder, readOnly = false,
}: {
  label: string
  icon?: ReactNode
  value: string
  onSave: (v: string) => void
  placeholder?: string
  readOnly?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState(value)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(value)
  }, [value])

  return (
    <Card title={<label htmlFor={id}>{label}</label>} icon={icon}>
      {readOnly ? (
        value
          ? <p id={id} className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">{value}</p>
          : <p id={id} className="text-sm text-slate-400 dark:text-slate-500">{t('sprintDetail.nothingRecorded')}</p>
      ) : (
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => { focusedRef.current = true }}
          onBlur={() => {
            focusedRef.current = false
            if (text !== value) onSave(text)
          }}
          rows={4}
          className="form-textarea"
          placeholder={placeholder}
        />
      )}
    </Card>
  )
}
