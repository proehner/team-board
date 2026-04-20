import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Plus, Search, Pencil, Trash2, RefreshCw, ChevronRight } from 'lucide-react'
import { useStore } from '@/store'
import type { Meeting, MeetingRecurrence } from '@/types'

const RECURRENCE_OPTIONS: MeetingRecurrence[] = ['daily', 'weekly', 'biweekly', 'monthly', 'custom']

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function RecurrenceBadge({ recurrence }: { recurrence: MeetingRecurrence }) {
  const { t } = useTranslation()
  const colors: Record<MeetingRecurrence, string> = {
    daily:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    weekly:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    biweekly: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    monthly:  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    custom:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[recurrence]}`}>
      <RefreshCw className="w-3 h-3" />
      {t(`meetings.recurrence.${recurrence}`)}
    </span>
  )
}

interface FormState {
  title: string
  description: string
  recurrence: MeetingRecurrence
  dayOfWeek: string
  meetingTime: string
  location: string
}

const EMPTY_FORM: FormState = {
  title: '', description: '', recurrence: 'weekly',
  dayOfWeek: '', meetingTime: '', location: '',
}

export default function MeetingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const meetings      = useStore((s) => s.meetings)
  const addMeeting    = useStore((s) => s.addMeeting)
  const updateMeeting = useStore((s) => s.updateMeeting)
  const deleteMeeting = useStore((s) => s.deleteMeeting)

  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [form, setForm]             = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return meetings.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      (m.location ?? '').toLowerCase().includes(q),
    )
  }, [meetings, search])

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(m: Meeting, e: React.MouseEvent) {
    e.stopPropagation()
    setEditId(m.id)
    setForm({
      title:       m.title,
      description: m.description,
      recurrence:  m.recurrence,
      dayOfWeek:   m.dayOfWeek != null ? String(m.dayOfWeek) : '',
      meetingTime: m.meetingTime ?? '',
      location:    m.location ?? '',
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description,
        recurrence:  form.recurrence,
        dayOfWeek:   form.dayOfWeek !== '' ? Number(form.dayOfWeek) : undefined,
        meetingTime: form.meetingTime || undefined,
        location:    form.location.trim() || undefined,
      }
      if (editId) {
        await updateMeeting(editId, payload)
      } else {
        await addMeeting(payload)
      }
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteMeeting(deleteTarget.id)
    setDeleteTarget(null)
  }

  function formatSchedule(m: Meeting) {
    const parts: string[] = []
    if (m.dayOfWeek != null) parts.push(t(`meetings.days.${DAY_KEYS[m.dayOfWeek]}`))
    if (m.meetingTime) parts.push(m.meetingTime)
    return parts.join(', ')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500 flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{t('meetings.title')}</h1>
            <p className="text-xs text-slate-500">{t('meetings.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('meetings.newMeeting')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search ? t('meetings.noResults') : t('meetings.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => navigate(`/meetings/${m.id}`)}
              className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <CalendarClock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{m.title}</span>
                  <RecurrenceBadge recurrence={m.recurrence} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {m.description && (
                    <p className="text-xs text-slate-500 truncate">{m.description}</p>
                  )}
                  {formatSchedule(m) && (
                    <span className="text-xs text-slate-400 shrink-0">{formatSchedule(m)}</span>
                  )}
                  {m.location && (
                    <span className="text-xs text-slate-400 shrink-0 truncate">{m.location}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => openEdit(m, e)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(m) }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-violet-400 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg space-y-4 p-6">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {editId ? t('meetings.editMeeting') : t('meetings.newMeeting')}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('common.name')} *</label>
                <input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder={t('meetings.titlePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('meetings.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('meetings.recurrenceLabel')}</label>
                  <select
                    value={form.recurrence}
                    onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as MeetingRecurrence }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {RECURRENCE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{t(`meetings.recurrence.${r}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('meetings.dayOfWeek')}</label>
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">{t('common.none')}</option>
                    {DAY_KEYS.map((day, i) => (
                      <option key={i} value={i}>{t(`meetings.days.${day}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('meetings.time')}</label>
                  <input
                    type="time"
                    value={form.meetingTime}
                    onChange={(e) => setForm((f) => ({ ...f, meetingTime: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('meetings.location')}</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder={t('meetings.locationPlaceholder')}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim() || saving}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? '…' : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('meetings.deleteTitle')}</h2>
            <p className="text-sm text-slate-500">{t('meetings.deleteConfirm', { title: deleteTarget.title })}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
