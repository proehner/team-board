import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Globe, Pencil } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import type { Meeting, MeetingRecurrence } from '@/types'
import { WEEKDAY_ORDER, weekdayLabel } from './meetingUtils'

const RECURRENCE_OPTIONS: MeetingRecurrence[] = ['daily', 'weekly', 'biweekly', 'monthly', 'custom']

export interface MeetingPayload {
  title: string
  description: string
  recurrence: MeetingRecurrence
  dayOfWeek?: number
  meetingTime?: string
  location?: string
  isGlobal: boolean
}

interface FormState {
  title: string
  description: string
  recurrence: MeetingRecurrence
  dayOfWeek: string
  meetingTime: string
  location: string
  isGlobal: boolean
}

const EMPTY_FORM: FormState = {
  title: '', description: '', recurrence: 'weekly',
  dayOfWeek: '', meetingTime: '', location: '', isGlobal: false,
}

function toForm(m: Meeting | null): FormState {
  if (!m) return EMPTY_FORM
  return {
    title:       m.title,
    description: m.description,
    recurrence:  m.recurrence,
    dayOfWeek:   m.dayOfWeek != null ? String(m.dayOfWeek) : '',
    meetingTime: m.meetingTime ?? '',
    location:    m.location ?? '',
    isGlobal:    m.isGlobal,
  }
}

interface MeetingFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Meeting to edit, or null to create a new one */
  meeting: Meeting | null
  /** Persist; throw to keep the dialog open */
  onSubmit: (payload: MeetingPayload) => Promise<void>
}

export default function MeetingFormModal({ isOpen, onClose, meeting, onSubmit }: MeetingFormModalProps) {
  const { t } = useTranslation()
  const uid = useId()
  const formId = `${uid}-form`
  const [form, setForm]     = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Reset only when the dialog opens (not on later store updates while typing)
  useEffect(() => {
    if (isOpen) { setForm(toForm(meeting)); setSaving(false) }
  }, [isOpen])

  const initial = toForm(meeting)
  const dirty = (Object.keys(form) as (keyof FormState)[]).some((k) => form[k] !== initial[k])
  const valid = form.title.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSubmit({
        title:       form.title.trim(),
        description: form.description,
        recurrence:  form.recurrence,
        dayOfWeek:   form.dayOfWeek !== '' ? Number(form.dayOfWeek) : undefined,
        meetingTime: form.meetingTime || undefined,
        location:    form.location.trim() || undefined,
        isGlobal:    form.isGlobal,
      })
      onClose()
    } catch {
      // caller shows a toast
    } finally {
      setSaving(false)
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!dirty}
      icon={meeting ? <Pencil /> : <CalendarClock />}
      title={meeting ? t('meetings.editMeeting') : t('meetings.newMeeting')}
      description={meeting ? meeting.title : t('meetings.formDescription')}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving} disabled={!valid}>
            {meeting ? t('common.save') : t('common.create')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('common.name')} htmlFor={`${uid}-title`} required>
          <input
            id={`${uid}-title`}
            autoFocus
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('meetings.titlePlaceholder')}
            className="form-input"
          />
        </Field>

        <Field label={t('meetings.description')} htmlFor={`${uid}-desc`} optional>
          <textarea
            id={`${uid}-desc`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="form-textarea"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('meetings.recurrenceLabel')} htmlFor={`${uid}-rec`}>
            <Select
              id={`${uid}-rec`}
              value={form.recurrence}
              onChange={(e) => set('recurrence', e.target.value as MeetingRecurrence)}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>{t(`meetings.recurrence.${r}`)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('meetings.dayOfWeek')} htmlFor={`${uid}-day`}>
            <Select
              id={`${uid}-day`}
              value={form.dayOfWeek}
              onChange={(e) => set('dayOfWeek', e.target.value)}
            >
              <option value="">{t('common.none')}</option>
              {WEEKDAY_ORDER.map((d) => (
                <option key={d} value={d}>{weekdayLabel(t, d)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('meetings.time')} htmlFor={`${uid}-time`}>
            <input
              id={`${uid}-time`}
              type="time"
              value={form.meetingTime}
              onChange={(e) => set('meetingTime', e.target.value)}
              className="form-input tabular-nums"
            />
          </Field>
          <Field label={t('meetings.location')} htmlFor={`${uid}-loc`}>
            <input
              id={`${uid}-loc`}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder={t('meetings.locationPlaceholder')}
              className="form-input"
            />
          </Field>
        </div>

        <label
          htmlFor={`${uid}-global`}
          className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
        >
          <span className="relative mt-0.5 inline-flex shrink-0">
            <input
              id={`${uid}-global`}
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={form.isGlobal}
              onChange={(e) => set('isGlobal', e.target.checked)}
            />
            <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/70 peer-focus-visible:ring-offset-2 dark:bg-slate-700 dark:peer-checked:bg-indigo-500 dark:peer-focus-visible:ring-offset-slate-900" />
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              {t('meetings.globalLabel')}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('meetings.globalHint')}</span>
          </span>
        </label>
      </form>
    </Modal>
  )
}
