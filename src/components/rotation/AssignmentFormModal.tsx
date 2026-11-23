import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import { formatDateShort } from '@/utils/date'
import { localTodayISO, toISODate } from '@/utils/sprint'
import {
  assignmentsOverlapping, nextFreePeriod, nextOpenSprint, rankCandidates, suggestedCandidate, type Period,
} from '@/utils/rotation'
import { addDays, parseISO } from 'date-fns'
import { AlertTriangle, CalendarCog, CalendarPlus, Check, Info, Trash2, Wand2 } from 'lucide-react'
import type { ResponsibilityAssignment } from '@/types'

interface AssignmentFormData {
  type: string
  memberId: string
  sprintId: string
  startDate: string
  endDate: string
  notes: string
}

type FormErrors = Partial<Record<'type' | 'memberId' | 'startDate' | 'endDate', string>>

const DURATION_PRESETS = [
  { key: 'rotation.oneWeek', days: 7 },
  { key: 'rotation.twoWeeks', days: 14 },
  { key: 'rotation.oneMonth', days: 30 },
]

interface AssignmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Assignment to edit; creates a new one when omitted. */
  assignment?: ResponsibilityAssignment
  /** Responsibility preselected for a new assignment. */
  presetType?: string
  onDelete?: (a: ResponsibilityAssignment) => void
}

/**
 * Create / edit a single assignment. New assignments start in the next sprint
 * that doesn't have this responsibility yet, with the fairest member preselected.
 */
export default function AssignmentFormModal({ isOpen, onClose, assignment, presetType, onDelete }: AssignmentFormModalProps) {
  const { t } = useTranslation()
  const types = useStore((s) => s.responsibilityTypes)
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const addAssignment = useStore((s) => s.addAssignment)
  const updateAssignment = useStore((s) => s.updateAssignment)

  // Other assignments only – an edited assignment must not compete with itself.
  // Defined before the state below because initialForm() already needs it.
  const others = assignment ? assignments.filter((a) => a.id !== assignment.id) : assignments

  const [form, setForm] = useState<AssignmentFormData>(() => initialForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  // Once the member was picked by hand, changing type / sprint no longer replaces it
  const memberTouched = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    memberTouched.current = !!assignment
    setForm(initialForm())
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  function suggestionFor(type: string, period: Period, sprintId: string): string {
    const typeConfig = types.find((rt) => rt.name === type)
    if (!typeConfig) return ''
    const sprint = sprints.find((s) => s.id === sprintId)
    return suggestedCandidate(rankCandidates({ type: typeConfig, members, assignments: others, period, sprint }))?.member.id ?? ''
  }

  /** Next open sprint for the type (or the period after its last assignment) plus the suggested member. */
  function planFor(type: string): Pick<AssignmentFormData, 'sprintId' | 'startDate' | 'endDate' | 'memberId'> {
    const sprint = type ? nextOpenSprint(sprints, others, type) : undefined
    const period = sprint ?? nextFreePeriod(others, type || undefined)
    const sprintId = sprint?.id ?? ''
    return { sprintId, startDate: period.startDate, endDate: period.endDate, memberId: suggestionFor(type, period, sprintId) }
  }

  function initialForm(): AssignmentFormData {
    if (assignment) {
      return {
        type: assignment.type, memberId: assignment.memberId, sprintId: assignment.sprintId ?? '',
        startDate: assignment.startDate, endDate: assignment.endDate, notes: assignment.notes,
      }
    }
    const type = presetType ?? types[0]?.name ?? ''
    return { type, notes: '', ...planFor(type) }
  }

  function selectType(type: string) {
    setErrors((e) => ({ ...e, type: undefined }))
    if (assignment) { setForm((f) => ({ ...f, type })); return }
    const plan = planFor(type)
    setForm((f) => ({ ...f, ...plan, type, memberId: memberTouched.current ? f.memberId : plan.memberId }))
  }

  /** Selecting a sprint takes over its period; "no sprint" keeps the dates. */
  function selectSprint(sprintId: string) {
    const sprint = sprints.find((s) => s.id === sprintId)
    setForm((f) => {
      const period = sprint ? { startDate: sprint.startDate, endDate: sprint.endDate } : { startDate: f.startDate, endDate: f.endDate }
      const memberId = memberTouched.current ? f.memberId : suggestionFor(f.type, period, sprintId) || f.memberId
      return { ...f, sprintId, ...period, memberId }
    })
  }

  function selectMember(memberId: string) {
    memberTouched.current = true
    setForm((f) => ({ ...f, memberId }))
    setErrors((e) => ({ ...e, memberId: undefined }))
  }

  function setDuration(days: number) {
    if (!form.startDate) return
    setForm((f) => ({ ...f, endDate: toISODate(addDays(parseISO(f.startDate), days - 1)) }))
    setErrors((e) => ({ ...e, endDate: undefined }))
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.type) e.type = t('rotation.responsibilityRequired')
    if (!form.memberId) e.memberId = t('rotation.memberRequired')
    if (!form.startDate) e.startDate = t('rotation.startDateRequired')
    if (!form.endDate) e.endDate = t('rotation.endDateRequired')
    if (form.startDate && form.endDate && form.endDate < form.startDate) e.endDate = t('rotation.endDateAfterStart')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (saving || !validate()) return
    setSaving(true)
    const data = {
      type: form.type, memberId: form.memberId, sprintId: form.sprintId || undefined,
      startDate: form.startDate, endDate: form.endDate, notes: form.notes,
      isAutoSuggested: form.memberId === suggestion?.member.id, isSynthetic: false, isArchived: false,
    }
    try {
      if (assignment) await updateAssignment(assignment.id, { ...data, isAutoSuggested: assignment.isAutoSuggested && data.memberId === assignment.memberId })
      else            await addAssignment(data)
      toast.success(assignment ? t('common.saved') : t('rotation.assignmentCreated', { type: form.type, name: memberName(form.memberId) }))
      onClose()
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  // ─── Derived hints ──────────────────────────────────────────────────────────
  const typeConfig = types.find((rt) => rt.name === form.type)
  const sprint = sprints.find((s) => s.id === form.sprintId)
  const periodValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate
  const period = periodValid ? { startDate: form.startDate, endDate: form.endDate } : undefined
  const ranked = typeConfig ? rankCandidates({ type: typeConfig, members, assignments: others, period, sprint }) : []
  const suggestion = suggestedCandidate(ranked)
  const selected = ranked.find((c) => c.member.id === form.memberId)
  const conflicts = period ? assignmentsOverlapping(others, period, { type: form.type }) : []
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—'

  // Member options in alphabetical order; an edited assignment may belong to an inactive member
  const memberOptions = [...ranked].sort((a, b) => a.member.name.localeCompare(b.member.name))
  const inactiveSelected = form.memberId && !selected ? memberName(form.memberId) : null

  const today = localTodayISO()
  const sprintOptions = [
    ...sprints.filter((s) => s.endDate >= today && s.status !== 'Abgebrochen').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    ...sprints.filter((s) => s.endDate < today || s.status === 'Abgebrochen').sort((a, b) => b.startDate.localeCompare(a.startDate)),
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose() }}
      title={assignment ? t('rotation.editAssignment') : t('rotation.newAssignment')}
      description={assignment ? `${assignment.type} · ${memberName(assignment.memberId)}` : t('rotation.newAssignmentHint')}
      icon={assignment ? <CalendarCog /> : <CalendarPlus />}
      dismissible={false}
      footer={
        <>
          {assignment && onDelete && (
            <Button
              variant="ghost"
              icon={<Trash2 />}
              onClick={() => { onDelete(assignment); onClose() }}
              disabled={saving}
              className="mr-auto !text-red-600 hover:!bg-red-50 dark:!text-red-400 dark:hover:!bg-red-500/10"
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="assignment-form" loading={saving}>
            {assignment ? t('common.save') : t('common.create')}
          </Button>
        </>
      }
    >
      <form
        id="assignment-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
        noValidate
        className="space-y-5"
      >
        {/* Responsibility */}
        <fieldset>
          <legend className="form-label">
            {t('rotation.responsibility')}<span className="ml-0.5 text-red-500">*</span>
          </legend>
          <div role="radiogroup" aria-label={t('rotation.responsibility')} className="flex flex-wrap gap-1.5">
            {types.map((rt) => {
              const active = form.type === rt.name
              return (
                <button
                  key={rt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectType(rt.name)}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                    active
                      ? 'text-white shadow-sm ring-transparent'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
                  }`}
                  style={active ? { backgroundColor: rt.color } : undefined}
                >
                  {active
                    ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                    : <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />}
                  <span className="truncate">{rt.name}</span>
                </button>
              )
            })}
          </div>
          {errors.type && <p className="form-error">{errors.type}</p>}
        </fieldset>

        {/* Sprint – selecting one takes over its period */}
        <Field label={t('rotation.sprint')} htmlFor="assignment-sprint" hint={t('rotation.sprintHintLong')}>
          <Select id="assignment-sprint" value={form.sprintId} onChange={(e) => selectSprint(e.target.value)}>
            <option value="">{t('rotation.noSprint')}</option>
            {sprintOptions.map((s) => {
              const covered = assignmentsOverlapping(others, s, { type: form.type }).length > 0
              return (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatDateShort(s.startDate)} – {formatDateShort(s.endDate)}){covered ? ` · ${t('rotation.sprintCovered')}` : ''}
                </option>
              )
            })}
          </Select>
        </Field>

        {/* Period */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('sprints.startDate')} htmlFor="assignment-start" error={errors.startDate} required>
              <input
                id="assignment-start"
                type="date"
                value={form.startDate}
                onChange={(e) => { setForm((f) => ({ ...f, startDate: e.target.value })); setErrors((x) => ({ ...x, startDate: undefined })) }}
                aria-invalid={!!errors.startDate}
                className="form-input"
              />
            </Field>
            <Field label={t('sprints.endDate')} htmlFor="assignment-end" error={errors.endDate} required>
              <input
                id="assignment-end"
                type="date"
                value={form.endDate}
                onChange={(e) => { setForm((f) => ({ ...f, endDate: e.target.value })); setErrors((x) => ({ ...x, endDate: undefined })) }}
                aria-invalid={!!errors.endDate}
                className="form-input"
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-slate-500 dark:text-slate-400">{t('rotation.setDuration')}</span>
            {DURATION_PRESETS.map(({ key, days }) => (
              <Button key={days} size="xs" variant="secondary" onClick={() => setDuration(days)} disabled={!form.startDate}>
                {t(key)}
              </Button>
            ))}
          </div>
          {conflicts.length > 0 && (
            <Hint warning>
              {t('rotation.overlapWarning', {
                list: conflicts.map((a) => `${memberName(a.memberId)} (${formatDateShort(a.startDate)} – ${formatDateShort(a.endDate)})`).join(', '),
              })}
            </Hint>
          )}
        </div>

        {/* Member */}
        <Field label={t('sprintDetail.memberColumn')} htmlFor="assignment-member" error={errors.memberId} required>
          <Select
            id="assignment-member"
            value={form.memberId}
            onChange={(e) => selectMember(e.target.value)}
            aria-invalid={!!errors.memberId}
          >
            <option value="">{t('rotation.selectMember')}</option>
            {inactiveSelected && <option value={form.memberId}>{inactiveSelected}</option>}
            {memberOptions.map((c) => (
              <option key={c.member.id} value={c.member.id}>
                {c.member.name} ({c.count}×)
                {c.member.id === suggestion?.member.id ? ` · ${t('rotation.suggestedShort')}` : ''}
                {c.excluded ? ` · ${t('rotation.notParticipating')}` : ''}
              </option>
            ))}
          </Select>
        </Field>
        {(suggestion || selected) && (
          <div className="-mt-2 space-y-1.5">
            {suggestion && suggestion.member.id !== form.memberId && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                <Wand2 className="h-3.5 w-3.5 shrink-0" />
                <span>{t('rotation.suggestionLine', { name: suggestion.member.name, count: suggestion.count })}</span>
                <button
                  type="button"
                  onClick={() => selectMember(suggestion.member.id)}
                  className="ml-auto rounded font-semibold underline-offset-2 hover:underline"
                >
                  {t('rotation.useSuggestion')}
                </button>
              </div>
            )}
            {suggestion && suggestion.member.id === form.memberId && (
              <p className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                <Wand2 className="h-3.5 w-3.5 shrink-0" /> {t('rotation.suggestionReason', { count: suggestion.count })}
              </p>
            )}
            {selected?.excluded && <Hint warning>{t('rotation.excludedHint', { name: selected.member.name })}</Hint>}
            {selected && selected.daysOff > 0 && sprint && (
              <Hint warning>{t('rotation.absenceHint', { name: selected.member.name, count: selected.daysOff, sprint: sprint.name })}</Hint>
            )}
            {selected && selected.otherDuties.length > 0 && (
              <Hint>{t('rotation.otherDutiesHint', { name: selected.member.name, duties: selected.otherDuties.join(', ') })}</Hint>
            )}
          </div>
        )}

        <Field label={t('sprints.notesLabel')} htmlFor="assignment-notes" optional>
          <textarea
            id="assignment-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="form-textarea"
          />
        </Field>
      </form>
    </Modal>
  )
}

/** Small inline hint (info or warning) used in the rotation dialogs. */
export function Hint({ warning = false, children }: { warning?: boolean; children: ReactNode }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs ${warning ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
      {warning ? <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> : <Info className="mt-px h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  )
}
