import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import SprintCapacitySection from '@/components/sprints/SprintCapacitySection'
import SprintFormModal from '@/components/sprints/SprintFormModal'
import SprintStatusActions from '@/components/sprints/SprintStatusActions'
import SprintTimingInfo from '@/components/sprints/SprintTimingInfo'
import { countWorkingDays, formatDate } from '@/utils/date'
import { chronological } from '@/utils/sprint'
import { usePagePermission } from '@/hooks/usePagePermission'
import {
  ArrowLeft, Calendar, Target, Edit2, TrendingUp, CheckCircle, Star, AlertTriangle, StickyNote, Flame, Clock,
  ChevronLeft, ChevronRight, ChevronDown, ListChecks,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Sprint, SprintStatus, SprintGoalMet } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default', Aktiv: 'info', Abgeschlossen: 'success', Abgebrochen: 'danger',
}

const GOAL_MET_VALUES: SprintGoalMet[] = ['Ja', 'Teilweise', 'Nein']

export default function SprintDetailPage() {
  const { t } = useTranslation()
  const { sprintId } = useParams<{ sprintId: string }>()
  const navigate = useNavigate()
  const sprints = useStore((s) => s.sprints)
  const sprint = sprints.find((s) => s.id === sprintId)

  if (!sprint) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-slate-500">{t('sprintDetail.notFound')}</p>
        <Button variant="ghost" onClick={() => navigate('/sprints')} icon={<ArrowLeft className="w-4 h-4" />} className="mt-3">
          {t('common.back')}
        </Button>
      </div>
    )
  }

  // Keyed so that local UI state resets when navigating to the previous / next sprint
  return <SprintDetail key={sprint.id} sprint={sprint} />
}

function SprintDetail({ sprint: sp }: { sprint: Sprint }) {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('sprints')
  const sprints = useStore((s) => s.sprints)
  const updateSprint = useStore((s) => s.updateSprint)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showResults, setShowResults] = useState(false)

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
    } catch { /* silent – UI shows stale value */ }
  }

  const metrics = (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <ListChecks className="w-4 h-4" /> {t('sprintDetail.metrics')}
      </h2>

      <MetricGroup label={t('sprintDetail.planning')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricBox
            label={t('sprintDetail.plannedPoints')}
            value={sp.plannedPoints || undefined}
            icon={<Target className="w-4 h-4" />}
            onSave={(v) => update('plannedPoints', v ?? 0)}
            readOnly={!canWrite}
          />
          <MetricBox
            label={t('sprintDetail.plannedItems')}
            value={sp.plannedItems}
            icon={<CheckCircle className="w-4 h-4" />}
            onSave={(v) => update('plannedItems', v)}
            readOnly={!canWrite}
          />
          <MetricBox
            label={t('sprintDetail.capacityHours')}
            value={sp.capacityHours}
            icon={<Clock className="w-4 h-4" />}
            onSave={(v) => update('capacityHours', v)}
            readOnly={!canWrite}
          />
        </div>
      </MetricGroup>

      {resultsVisible ? (
        <>
          <MetricGroup label={t('sprintDetail.results')}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricBox
                label={t('sprintDetail.velocity')}
                value={sp.velocity}
                icon={<TrendingUp className="w-4 h-4" />}
                onSave={(v) => update('velocity', v)}
                readOnly={!canWrite}
              />
              <MetricBox
                label={t('sprintDetail.completedItems')}
                value={sp.completedItems}
                icon={<CheckCircle className="w-4 h-4" />}
                onSave={(v) => update('completedItems', v)}
                readOnly={!canWrite}
              />
              <MetricBox
                label={t('sprintDetail.remainingHours')}
                value={sp.remainingHours}
                icon={<Clock className="w-4 h-4" />}
                onSave={(v) => update('remainingHours', v)}
                readOnly={!canWrite}
              />
              <MetricBox
                label={t('sprintDetail.averageBurndown')}
                value={sp.averageBurndown}
                icon={<Flame className="w-4 h-4" />}
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

          <div className="grid gap-5 sm:grid-cols-2">
            <MetricGroup label={t('sprintDetail.goalMet')}>
              <div className="flex gap-2 flex-wrap">
                {GOAL_MET_VALUES.map((v) => {
                  const active = sp.goalMet === v
                  const activeClass =
                    v === 'Ja'
                      ? 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-400'
                      : v === 'Teilweise'
                      ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400'
                      : 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400'
                  return (
                    <button
                      key={v}
                      onClick={() => canWrite && update('goalMet', sp.goalMet === v ? null : v)}
                      disabled={!canWrite}
                      className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        active
                          ? activeClass
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t(`sprintDetail.goalMet_${v}`)}
                    </button>
                  )
                })}
              </div>
            </MetricGroup>
            <MetricGroup label={t('sprintDetail.teamSatisfaction')}>
              <StarRating value={sp.teamSatisfaction} onChange={(v) => canWrite && update('teamSatisfaction', v)} readOnly={!canWrite} />
            </MetricGroup>
          </div>
        </>
      ) : (
        <button
          onClick={() => setShowResults(true)}
          className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ChevronDown className="w-4 h-4" /> {t('sprintDetail.showResults')}
        </button>
      )}
    </div>
  )

  const capacity = <SprintCapacitySection sprint={sp} canWrite={canWrite} />

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/sprints" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('sprints.title')}
        </Link>
        <div className="flex items-center gap-1">
          {prev && (
            <Link
              to={`/sprints/${prev.id}`}
              title={t('sprintDetail.previous')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> {prev.name}
            </Link>
          )}
          {next && (
            <Link
              to={`/sprints/${next.id}`}
              title={t('sprintDetail.next')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {next.name} <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
      {isReadOnly && <ReadOnlyBanner />}

      {/* Sprint header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{sp.name}</h1>
              <Badge label={t(`sprintStatus.${sp.status}`)} variant={STATUS_VARIANTS[sp.status]} dot />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
              <Calendar className="w-4 h-4" />
              {formatDate(sp.startDate)} – {formatDate(sp.endDate)}
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{t('sprints.workingDays', { count: countWorkingDays(sp.startDate, sp.endDate) })}</span>
            </div>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2 shrink-0">
              <SprintStatusActions sprint={sp} />
              <button
                onClick={() => setShowEditModal(true)}
                title={t('sprints.editSprint')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <SprintTimingInfo sprint={sp} />
        <InlineGoal value={sp.goal} readOnly={!canWrite} onSave={(goal) => update('goal', goal)} />
      </div>

      {/* Finished sprints are about results, upcoming / running ones about planning */}
      {isFinished ? <>{metrics}{capacity}</> : <>{capacity}{metrics}</>}

      <div className="grid gap-5 lg:grid-cols-2">
        <InlineTextSection
          label={t('sprintDetail.impediments')}
          icon={<AlertTriangle className="w-4 h-4" />}
          value={sp.impediments}
          onSave={(v) => update('impediments', v)}
          placeholder={t('sprintDetail.impedimentsPlaceholder')}
          readOnly={!canWrite}
        />
        <InlineTextSection
          label={t('sprints.notesLabel')}
          icon={<StickyNote className="w-4 h-4" />}
          value={sp.notes}
          onSave={(v) => update('notes', v)}
          placeholder={t('sprints.notesPlaceholder')}
          readOnly={!canWrite}
        />
      </div>

      <SprintFormModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} sprint={sp} />
    </div>
  )
}

// ─── MetricGroup ──────────────────────────────────────────────────────────────

function MetricGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{label}</p>
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
      <div className="flex items-start gap-2">
        <Target className="w-4 h-4 mt-2.5 shrink-0 text-slate-400" />
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
          placeholder={t('sprints.sprintGoalPlaceholder')}
          className="form-textarea flex-1"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => !readOnly && setEditing(true)}
      disabled={readOnly}
      title={readOnly ? undefined : t('sprintDetail.editGoal')}
      className={`group flex items-start gap-2 w-full text-left rounded-lg -mx-2 px-2 py-1 transition-colors ${readOnly ? 'cursor-default' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
    >
      <Target className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
      {value
        ? <span className="flex-1 text-sm italic text-slate-600 dark:text-slate-400 whitespace-pre-line">{value}</span>
        : <span className="flex-1 text-sm italic text-slate-300 dark:text-slate-600">{readOnly ? t('sprints.noGoal') : t('sprintDetail.addGoal')}</span>}
      {!readOnly && <Edit2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </button>
  )
}

// ─── MetricBox ────────────────────────────────────────────────────────────────

function MetricBox({
  label, value, icon, onSave, decimal = false, readOnly = false,
}: {
  label: string
  value?: number
  icon: React.ReactNode
  onSave: (v: number | null) => void
  decimal?: boolean
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function startEdit() {
    if (readOnly) return
    setInput(value?.toString() ?? '')
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const trimmed = input.trim()
    const v = trimmed === '' ? null : (decimal ? parseFloat(trimmed) : parseInt(trimmed, 10))
    if (trimmed === '' || !isNaN(v as number)) onSave(v)
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-2">
        {icon}
        <span className="text-xs font-medium leading-tight">{label}</span>
      </div>
      {editing ? (
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="form-input py-1 text-lg font-bold w-full"
          autoFocus
          min={0}
        />
      ) : (
        <button
          onClick={startEdit}
          title={label}
          disabled={readOnly}
          className={`text-2xl font-bold text-slate-900 dark:text-slate-100 transition-colors text-left w-full ${readOnly ? 'cursor-default' : 'hover:text-indigo-600 dark:hover:text-indigo-400'}`}
        >
          {value !== undefined && value !== null
            ? value
            : <span className="text-slate-300 dark:text-slate-600 text-lg">—</span>
          }
        </button>
      )}
    </div>
  )
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readOnly = false }: { value?: number; onChange: (v: number | null) => void; readOnly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readOnly && onChange(value === star ? null : star)}
          disabled={readOnly}
          className={`transition-colors ${
            star <= (value ?? 0)
              ? 'text-amber-400'
              : readOnly
                ? 'text-slate-200 dark:text-slate-700'
                : 'text-slate-200 dark:text-slate-700 hover:text-amber-300'
          } ${readOnly ? 'cursor-default' : ''}`}
        >
          <Star className="w-7 h-7" fill={star <= (value ?? 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

// ─── InlineTextSection ────────────────────────────────────────────────────────

function InlineTextSection({
  label, icon, value, onSave, placeholder, readOnly = false,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  onSave: (v: string) => void
  placeholder?: string
  readOnly?: boolean
}) {
  const [text, setText] = useState(value)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(value)
  }, [value])

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <textarea
        value={text}
        onChange={(e) => !readOnly && setText(e.target.value)}
        onFocus={() => { focusedRef.current = true }}
        onBlur={() => {
          focusedRef.current = false
          if (!readOnly && text !== value) onSave(text)
        }}
        rows={3}
        readOnly={readOnly}
        className={`form-textarea w-full ${readOnly ? 'opacity-70 cursor-default' : ''}`}
        placeholder={readOnly ? undefined : placeholder}
      />
    </div>
  )
}

// ─── CompletedTimeBox ─────────────────────────────────────────────────────────

function CompletedTimeBox({ label, capacityHours, remainingHours }: {
  label: string
  capacityHours?: number
  remainingHours?: number
}) {
  const pct =
    capacityHours && capacityHours > 0 && remainingHours !== undefined
      ? Math.round(((capacityHours - remainingHours) / capacityHours) * 100)
      : null

  const color =
    pct === null ? ''
    : pct >= 75 ? 'text-green-600 dark:text-green-400'
    : pct >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500 dark:text-red-400'

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-2">
        <TrendingUp className="w-4 h-4" />
        <span className="text-xs font-medium leading-tight">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${pct !== null ? color : ''}`}>
        {pct !== null
          ? `${pct}%`
          : <span className="text-slate-300 dark:text-slate-600 text-lg">—</span>
        }
      </p>
    </div>
  )
}
