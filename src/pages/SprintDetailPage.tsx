import { useRef, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { formatDate, sprintDurationDays } from '@/utils/date'
import { ArrowLeft, Calendar, Target, Edit2, TrendingUp, CheckCircle, Star, AlertTriangle, StickyNote, Flame, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SprintStatus, SprintGoalMet } from '@/types'

const STATUS_VARIANTS: Record<SprintStatus, 'default' | 'info' | 'success' | 'danger'> = {
  Geplant: 'default', Aktiv: 'info', Abgeschlossen: 'success', Abgebrochen: 'danger',
}

const GOAL_MET_VALUES: SprintGoalMet[] = ['Ja', 'Teilweise', 'Nein']

export default function SprintDetailPage() {
  const { t } = useTranslation()
  const { sprintId } = useParams<{ sprintId: string }>()
  const navigate = useNavigate()
  const sprints = useStore((s) => s.sprints)
  const updateSprint = useStore((s) => s.updateSprint)
  const setSprintStatus = useStore((s) => s.setSprintStatus)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', goal: '', startDate: '', endDate: '' })

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

  const sp = sprint
  const duration = sprintDurationDays(sp.startDate, sp.endDate)

  function openEdit() {
    setEditForm({ name: sp.name, goal: sp.goal, startDate: sp.startDate, endDate: sp.endDate })
    setShowEditModal(true)
  }

  async function handleEditSave() {
    try {
      await updateSprint(sp.id, editForm)
      setShowEditModal(false)
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  async function update(field: string, value: unknown) {
    try {
      await updateSprint(sp.id, { [field]: value } as Parameters<typeof updateSprint>[1])
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      <Link to="/sprints" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('sprints.title')}
      </Link>

      {/* Sprint header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{sp.name}</h1>
              <Badge label={t(`sprintStatus.${sp.status}`)} variant={STATUS_VARIANTS[sp.status]} dot />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              {formatDate(sp.startDate)} – {formatDate(sp.endDate)}
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{duration} {t('sprintDetail.days')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sp.status}
              onChange={(e) => setSprintStatus(sp.id, e.target.value as SprintStatus)}
              className="form-input w-auto text-sm"
            >
              {(['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgebrochen'] as SprintStatus[]).map((s) => (
                <option key={s} value={s}>{t(`sprintStatus.${s}`)}</option>
              ))}
            </select>
            <button
              onClick={openEdit}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <Target className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
          {sp.goal
            ? <p className="text-sm italic text-slate-600 dark:text-slate-400">{sp.goal}</p>
            : <p className="text-sm italic text-slate-300 dark:text-slate-600">{t('sprints.sprintGoalPlaceholder')}</p>
          }
        </div>
      </div>

      {/* Metrics */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('sprintDetail.metrics')}</h2>

        {/* Goal met */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t('sprintDetail.goalMet')}
          </p>
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
                  onClick={() => update('goalMet', sp.goalMet === v ? null : v)}
                  className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
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
        </div>

        {/* Metric boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox
            label={t('sprintDetail.plannedPoints')}
            value={sp.plannedPoints || undefined}
            icon={<Target className="w-4 h-4" />}
            onSave={(v) => update('plannedPoints', v ?? 0)}
          />
          <MetricBox
            label={t('sprintDetail.velocity')}
            value={sp.velocity}
            icon={<TrendingUp className="w-4 h-4" />}
            onSave={(v) => update('velocity', v)}
          />
          <MetricBox
            label={t('sprintDetail.plannedItems')}
            value={sp.plannedItems}
            icon={<CheckCircle className="w-4 h-4" />}
            onSave={(v) => update('plannedItems', v)}
          />
          <MetricBox
            label={t('sprintDetail.completedItems')}
            value={sp.completedItems}
            icon={<CheckCircle className="w-4 h-4" />}
            onSave={(v) => update('completedItems', v)}
          />
        </div>

        {/* Burndown metrics */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t('sprintDetail.burndown')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricBox
              label={t('sprintDetail.capacityHours')}
              value={sp.capacityHours}
              icon={<Clock className="w-4 h-4" />}
              onSave={(v) => update('capacityHours', v)}
            />
            <MetricBox
              label={t('sprintDetail.remainingHours')}
              value={sp.remainingHours}
              icon={<Clock className="w-4 h-4" />}
              onSave={(v) => update('remainingHours', v)}
            />
            <MetricBox
              label={t('sprintDetail.averageBurndown')}
              value={sp.averageBurndown}
              icon={<Flame className="w-4 h-4" />}
              onSave={(v) => update('averageBurndown', v)}
              decimal
            />
            <CompletedTimeBox
              capacityHours={sp.capacityHours}
              remainingHours={sp.remainingHours}
              label={t('sprintDetail.completedTimePercent')}
            />
          </div>
        </div>

        {/* Team Satisfaction */}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            {t('sprintDetail.teamSatisfaction')}
          </p>
          <StarRating value={sp.teamSatisfaction} onChange={(v) => update('teamSatisfaction', v)} />
        </div>
      </div>

      {/* Impediments */}
      <InlineTextSection
        label={t('sprintDetail.impediments')}
        icon={<AlertTriangle className="w-4 h-4" />}
        value={sp.impediments}
        onSave={(v) => update('impediments', v)}
        placeholder={t('sprintDetail.impedimentsPlaceholder')}
      />

      {/* Notes */}
      <InlineTextSection
        label={t('sprints.notes')}
        icon={<StickyNote className="w-4 h-4" />}
        value={sp.notes}
        onSave={(v) => update('notes', v)}
        placeholder={t('sprints.notesPlaceholder')}
      />

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('sprints.editSprint')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleEditSave}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('common.name')}>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="form-input"
            />
          </FormField>
          <FormField label={t('sprints.sprintGoal')}>
            <textarea
              value={editForm.goal}
              onChange={(e) => setEditForm((f) => ({ ...f, goal: e.target.value }))}
              rows={2}
              className="form-textarea"
              placeholder={t('sprints.sprintGoalPlaceholder')}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('sprints.startDate')}>
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                className="form-input"
              />
            </FormField>
            <FormField label={t('sprints.endDate')}>
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                className="form-input"
              />
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── MetricBox ────────────────────────────────────────────────────────────────

function MetricBox({
  label, value, icon, onSave, decimal = false,
}: {
  label: string
  value?: number
  icon: React.ReactNode
  onSave: (v: number | null) => void
  decimal?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  function startEdit() {
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
          className="text-2xl font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left w-full"
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

function StarRating({ value, onChange }: { value?: number; onChange: (v: number | null) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(value === star ? null : star)}
          className={`transition-colors ${
            star <= (value ?? 0)
              ? 'text-amber-400'
              : 'text-slate-200 dark:text-slate-700 hover:text-amber-300'
          }`}
        >
          <Star className="w-7 h-7" fill={star <= (value ?? 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

// ─── InlineTextSection ────────────────────────────────────────────────────────

function InlineTextSection({
  label, icon, value, onSave, placeholder,
}: {
  label: string
  icon?: React.ReactNode
  value: string
  onSave: (v: string) => void
  placeholder?: string
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
        onChange={(e) => setText(e.target.value)}
        onFocus={() => { focusedRef.current = true }}
        onBlur={() => {
          focusedRef.current = false
          if (text !== value) onSave(text)
        }}
        rows={3}
        className="form-textarea w-full"
        placeholder={placeholder}
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

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  )
}
