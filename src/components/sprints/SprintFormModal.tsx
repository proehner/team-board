import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { countWorkingDays, formatDateShort, sprintDurationDays } from '@/utils/date'
import {
  capacitySourceFor, endDateForWeeks, overlappingSprints, shiftEndDate, sprintWeeks,
  suggestNextSprintDates, suggestSprintName,
} from '@/utils/sprint'
import { AlertTriangle } from 'lucide-react'
import type { Sprint, SprintStatus } from '@/types'

const CAPACITY_NONE = ''
const CAPACITY_MEMBERS = '__members__'
const WEEK_OPTIONS = [1, 2, 3, 4]
const STATUSES: SprintStatus[] = ['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgebrochen']

interface SprintFormData {
  name: string
  goal: string
  startDate: string
  endDate: string
  notes: string
  status: SprintStatus
  capacitySource: string  // sprint id to copy capacity from, CAPACITY_MEMBERS or CAPACITY_NONE
}

type FormErrors = Partial<Record<'name' | 'startDate' | 'endDate', string>>

interface SprintFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Sprint to edit; creates a new sprint when omitted. */
  sprint?: Sprint
  onCreated?: (id: string) => void
}

/**
 * Create / edit a sprint. New sprints are prefilled from the latest sprint
 * (next number, following period with the same length) and can take over the
 * capacity plan of a previous sprint right away.
 */
export default function SprintFormModal({ isOpen, onClose, sprint, onCreated }: SprintFormModalProps) {
  const { t } = useTranslation()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members)
  const addSprint = useStore((s) => s.addSprint)
  const updateSprint = useStore((s) => s.updateSprint)
  const copySprintCapacity = useStore((s) => s.copySprintCapacity)
  const addMembersToSprint = useStore((s) => s.addMembersToSprint)

  const [form, setForm] = useState<SprintFormData>(() => initialForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)

  const activeMemberIds = members.filter((m) => m.isActive).map((m) => m.id)
  const capacitySources = sprints
    .filter((s) => s.capacity.length > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  useEffect(() => {
    if (!isOpen) return
    setForm(initialForm())
    setErrors({})
    setSaveError('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function initialForm(): SprintFormData {
    if (sprint) {
      return {
        name: sprint.name, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate,
        notes: sprint.notes, status: sprint.status, capacitySource: CAPACITY_NONE,
      }
    }
    const { startDate, endDate } = suggestNextSprintDates(sprints)
    const source = capacitySourceFor(sprints, startDate)
    const hasActiveMembers = members.some((m) => m.isActive)
    return {
      name: suggestSprintName(sprints), goal: '', startDate, endDate, notes: '', status: 'Geplant',
      capacitySource: source?.id ?? (hasActiveMembers ? CAPACITY_MEMBERS : CAPACITY_NONE),
    }
  }

  const set = <K extends keyof SprintFormData>(key: K, value: SprintFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setStartDate(startDate: string) {
    setForm((f) => ({
      ...f,
      startDate,
      // Keep the sprint length when moving the start date
      endDate: startDate && f.startDate && f.endDate ? shiftEndDate(f.startDate, f.endDate, startDate) : f.endDate,
    }))
    setErrors((e) => ({ ...e, startDate: undefined, endDate: undefined }))
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = t('sprints.nameRequired')
    if (!form.startDate) e.startDate = t('sprints.startDateRequired')
    if (!form.endDate) e.endDate = t('sprints.endDateRequired')
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = t('sprints.endDateAfterStart')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    setSaveError('')
    const data = {
      name: form.name.trim(), goal: form.goal.trim(), startDate: form.startDate, endDate: form.endDate, notes: form.notes,
    }
    try {
      if (sprint) {
        await updateSprint(sprint.id, { ...data, status: form.status })
        onClose()
        return
      }
      const id = await addSprint(data)
      try {
        if (form.capacitySource === CAPACITY_MEMBERS) {
          if (activeMemberIds.length > 0) await addMembersToSprint(id, activeMemberIds)
        } else if (form.capacitySource) {
          await copySprintCapacity(id, form.capacitySource)
        }
      } catch { /* sprint exists – capacity can still be planned on the detail page */ }
      onClose()
      onCreated?.(id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('common.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const datesValid = !!form.startDate && !!form.endDate && form.endDate > form.startDate
  const weeks = sprintWeeks(form.startDate, form.endDate)
  const overlaps = datesValid ? overlappingSprints(sprints, form.startDate, form.endDate, sprint?.id) : []

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={sprint ? t('sprints.editSprint') : t('sprints.newSprint')}
      footer={
        <>
          {saveError && <p className="flex-1 text-sm text-red-600">{saveError}</p>}
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="sprint-form" loading={saving}>
            {sprint ? t('common.save') : t('sprints.createSprint')}
          </Button>
        </>
      }
    >
      <form
        id="sprint-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
        className="space-y-4"
      >
        <FormField label={t('common.name')} error={errors.name}>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className="form-input" />
        </FormField>

        {/* Period */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('sprints.startDate')} error={errors.startDate}>
              <input type="date" value={form.startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" />
            </FormField>
            <FormField label={t('sprints.endDate')} error={errors.endDate}>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className="form-input" />
            </FormField>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                disabled={!form.startDate}
                onClick={() => set('endDate', endDateForWeeks(form.startDate, w))}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:opacity-50 ${
                  weeks === w
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t('sprints.weeks', { count: w })}
              </button>
            ))}
            {datesValid && (
              <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                {t('sprints.workingDays', { count: countWorkingDays(form.startDate, form.endDate) })}
                {' · '}
                {t('sprints.calendarDays', { count: sprintDurationDays(form.startDate, form.endDate) })}
              </span>
            )}
          </div>
          {overlaps.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
              {t('sprints.overlapWarning', {
                sprints: overlaps.map((s) => `${s.name} (${formatDateShort(s.startDate)} – ${formatDateShort(s.endDate)})`).join(', '),
              })}
            </p>
          )}
        </div>

        <FormField label={t('sprints.sprintGoal')} hint={t('common.optional')}>
          <textarea
            value={form.goal}
            onChange={(e) => set('goal', e.target.value)}
            rows={2}
            className="form-textarea"
            placeholder={t('sprints.sprintGoalPlaceholder')}
            autoFocus={!sprint}
          />
        </FormField>

        {sprint ? (
          <FormField label={t('common.status')}>
            <select value={form.status} onChange={(e) => set('status', e.target.value as SprintStatus)} className="form-input">
              {STATUSES.map((s) => <option key={s} value={s}>{t(`sprintStatus.${s}`)}</option>)}
            </select>
          </FormField>
        ) : (
          <FormField label={t('capacity.title')} hint={t('sprints.capacitySetupHint')}>
            <select value={form.capacitySource} onChange={(e) => set('capacitySource', e.target.value)} className="form-input">
              {capacitySources.map((s) => (
                <option key={s.id} value={s.id}>{t('sprints.capacityCopyFrom', { name: s.name })}</option>
              ))}
              {activeMemberIds.length > 0 && (
                <option value={CAPACITY_MEMBERS}>{t('sprints.capacityAllMembers', { count: activeMemberIds.length })}</option>
              )}
              <option value={CAPACITY_NONE}>{t('sprints.capacityLater')}</option>
            </select>
          </FormField>
        )}

        <FormField label={t('sprints.notesLabel')} hint={t('common.optional')}>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="form-textarea" placeholder={t('sprints.notesPlaceholder')} />
        </FormField>
      </form>
    </Modal>
  )
}

function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
