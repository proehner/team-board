import { useEffect, useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Chip from '@/components/ui/Chip'
import { countWorkingDays, formatDateShort, sprintDurationDays } from '@/utils/date'
import {
  capacitySourceFor, endDateForWeeks, overlappingSprints, shiftEndDate, sprintWeeks,
  suggestNextSprintDates, suggestSprintName,
} from '@/utils/sprint'
import { AlertTriangle, CalendarPlus, Pencil, Users, CalendarRange } from 'lucide-react'
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
  const uid = useId()
  const sprints = useStore((s) => s.sprints)
  const members = useStore((s) => s.members)
  const addSprint = useStore((s) => s.addSprint)
  const updateSprint = useStore((s) => s.updateSprint)
  const copySprintCapacity = useStore((s) => s.copySprintCapacity)
  const addMembersToSprint = useStore((s) => s.addMembersToSprint)

  const [form, setForm] = useState<SprintFormData>(() => initialForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  const activeMemberIds = members.filter((m) => m.isActive).map((m) => m.id)
  const capacitySources = sprints
    .filter((s) => s.capacity.length > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  useEffect(() => {
    if (!isOpen) return
    setForm(initialForm())
    setErrors({})
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
    const data = {
      name: form.name.trim(), goal: form.goal.trim(), startDate: form.startDate, endDate: form.endDate, notes: form.notes,
    }
    try {
      if (sprint) {
        await updateSprint(sprint.id, { ...data, status: form.status })
        toast.success(t('sprints.updatedToast', { name: data.name }))
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
      } catch (err) {
        // Sprint exists – capacity can still be planned on the detail page
        toast.warning(t('sprints.capacitySetupFailed'), { description: errorMessage(err) })
      }
      toast.success(t('sprints.createdToast', { name: data.name }))
      onClose()
      onCreated?.(id)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const datesValid = !!form.startDate && !!form.endDate && form.endDate > form.startDate
  const weeks = sprintWeeks(form.startDate, form.endDate)
  const overlaps = datesValid ? overlappingSprints(sprints, form.startDate, form.endDate, sprint?.id) : []
  const id = (name: string) => `${uid}-${name}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!saving}
      icon={sprint ? <Pencil /> : <CalendarPlus />}
      title={sprint ? t('sprints.editSprint') : t('sprints.newSprint')}
      description={sprint ? sprint.name : t('sprints.newSprintDescription')}
      footer={
        <>
          <span className="mr-auto hidden self-center text-xs text-slate-400 sm:inline dark:text-slate-500">
            <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">Enter</kbd>
          </span>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form={id('form')} loading={saving}>
            {sprint ? t('common.save') : t('sprints.createSprint')}
          </Button>
        </>
      }
    >
      <form
        id={id('form')}
        onSubmit={handleSubmit}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
        className="space-y-5"
        noValidate
      >
        <Field label={t('common.name')} htmlFor={id('name')} error={errors.name} required>
          <input
            id={id('name')}
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className="form-input"
            aria-invalid={!!errors.name}
            autoFocus={!!sprint}
          />
        </Field>

        {/* Period */}
        <fieldset className="space-y-3">
          <legend className="sr-only">{t('sprints.period')}</legend>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Field label={t('sprints.startDate')} htmlFor={id('start')} error={errors.startDate} required>
              <input
                id={id('start')}
                type="date"
                value={form.startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input"
                aria-invalid={!!errors.startDate}
              />
            </Field>
            <Field label={t('sprints.endDate')} htmlFor={id('end')} error={errors.endDate} required>
              <input
                id={id('end')}
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => set('endDate', e.target.value)}
                className="form-input"
                aria-invalid={!!errors.endDate}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('sprints.duration')}</span>
            {WEEK_OPTIONS.map((w) => (
              <Chip
                key={w}
                active={weeks === w}
                disabled={!form.startDate}
                onClick={() => set('endDate', endDateForWeeks(form.startDate, w))}
                className="disabled:opacity-50"
              >
                {t('sprints.weeks', { count: w })}
              </Chip>
            ))}
          </div>
          {datesValid && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              {t('sprints.workingDays', { count: countWorkingDays(form.startDate, form.endDate) })}
              {' · '}
              {t('sprints.calendarDays', { count: sprintDurationDays(form.startDate, form.endDate) })}
            </p>
          )}
          {overlaps.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {t('sprints.overlapWarning', {
                sprints: overlaps.map((s) => `${s.name} (${formatDateShort(s.startDate)} – ${formatDateShort(s.endDate)})`).join(', '),
              })}
            </p>
          )}
        </fieldset>

        <Field label={t('sprints.sprintGoal')} htmlFor={id('goal')} optional>
          <textarea
            id={id('goal')}
            value={form.goal}
            onChange={(e) => set('goal', e.target.value)}
            rows={2}
            className="form-textarea"
            placeholder={t('sprints.sprintGoalPlaceholder')}
            autoFocus={!sprint}
          />
        </Field>

        {sprint ? (
          <Field label={t('common.status')} htmlFor={id('status')}>
            <Select id={id('status')} value={form.status} onChange={(e) => set('status', e.target.value as SprintStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`sprintStatus.${s}`)}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label={t('capacity.title')} htmlFor={id('capacity')} hint={t('sprints.capacitySetupHint')}>
            <Select
              id={id('capacity')}
              icon={<Users />}
              value={form.capacitySource}
              onChange={(e) => set('capacitySource', e.target.value)}
            >
              {capacitySources.map((s) => (
                <option key={s.id} value={s.id}>{t('sprints.capacityCopyFrom', { name: s.name })}</option>
              ))}
              {activeMemberIds.length > 0 && (
                <option value={CAPACITY_MEMBERS}>{t('sprints.capacityAllMembers', { count: activeMemberIds.length })}</option>
              )}
              <option value={CAPACITY_NONE}>{t('sprints.capacityLater')}</option>
            </Select>
          </Field>
        )}

        <Field label={t('sprints.notesLabel')} htmlFor={id('notes')} optional>
          <textarea
            id={id('notes')}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="form-textarea"
            placeholder={t('sprints.notesPlaceholder')}
          />
        </Field>
      </form>
    </Modal>
  )
}
