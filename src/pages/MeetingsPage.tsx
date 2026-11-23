import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock, Plus, Pencil, Trash2, RefreshCw, Clock, MapPin, Globe, ListTodo,
  MoreHorizontal, SearchX,
} from 'lucide-react'
import { useStore } from '@/store'
import type { Meeting } from '@/types'
import { meetingsApi } from '@/api/client'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast, errorMessage } from '@/store/toast'
import MeetingFormModal, { type MeetingPayload } from '@/components/meetings/MeetingFormModal'
import { compareMeetings, formatSchedule, isMeetingToday, weekdayShort } from '@/components/meetings/meetingUtils'

/** Calendar-like tile: weekday abbreviation + time. Highlighted when the meeting is today. */
function DayTile({ meeting, today }: { meeting: Meeting; today: boolean }) {
  const { t } = useTranslation()
  const base = 'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset'
  const tone = today
    ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white ring-white/10 shadow-sm shadow-indigo-500/30'
    : 'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20'
  if (meeting.dayOfWeek == null) {
    return (
      <span className={`${base} ${tone}`}>
        <CalendarClock className="h-5 w-5" />
      </span>
    )
  }
  return (
    <span className={`${base} ${tone}`}>
      <span className={`text-2xs font-semibold uppercase tracking-wider ${today ? 'text-indigo-100' : 'text-indigo-500 dark:text-indigo-400'}`}>
        {weekdayShort(t, meeting.dayOfWeek)}
      </span>
      <span className="text-sm font-semibold leading-tight tabular-nums">
        {meeting.meetingTime ?? '–'}
      </span>
    </span>
  )
}

export default function MeetingsPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('meetings')
  const meetings      = useStore((s) => s.meetings)
  const addMeeting    = useStore((s) => s.addMeeting)
  const updateMeeting = useStore((s) => s.updateMeeting)
  const deleteMeeting = useStore((s) => s.deleteMeeting)

  const [search, setSearch]             = useState('')
  const [formOpen, setFormOpen]         = useState(false)
  const [editTarget, setEditTarget]     = useState<Meeting | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
  /** meetingId → number of open (not done) topics; undefined while loading */
  const [openCounts, setOpenCounts]     = useState<Record<string, number>>({})

  // Read-only: count open agenda topics per meeting
  const idsKey = meetings.map((m) => m.id).join(',')
  useEffect(() => {
    let cancelled = false
    meetings.forEach((m) => {
      meetingsApi.listTopics(m.id)
        .then((topics) => { if (!cancelled) setOpenCounts((c) => ({ ...c, [m.id]: topics.length })) })
        .catch(() => { /* count is optional */ })
    })
    return () => { cancelled = true }
  }, [idsKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meetings
      .filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.location ?? '').toLowerCase().includes(q),
      )
      .sort(compareMeetings)
  }, [meetings, search])

  function openCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function openEdit(m: Meeting) {
    setEditTarget(m)
    setFormOpen(true)
  }

  async function handleSubmit(payload: MeetingPayload) {
    try {
      if (editTarget) {
        await updateMeeting(editTarget.id, payload)
        toast.success(t('common.saved'))
      } else {
        await addMeeting(payload)
        toast.success(t('common.created'), { description: payload.title })
      }
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteMeeting(deleteTarget.id)
      toast.success(t('common.deleted'), { description: deleteTarget.title })
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  return (
    <Page size="default">
      <PageHeader
        icon={CalendarClock}
        title={t('meetings.title')}
        subtitle={t('meetings.subtitle')}
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus />} onClick={openCreate}>
              {t('meetings.newMeeting')}
            </Button>
          )
        }
      >
        {isReadOnly && <ReadOnlyBanner className="mb-5" />}
        {meetings.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              size="sm"
              placeholder={t('meetings.searchPlaceholder')}
              className="w-full sm:w-72"
              aria-label={t('common.search')}
            />
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 sm:ml-auto" aria-live="polite">
              {search.trim()
                ? t('meetings.filteredCount', { shown: filtered.length, total: meetings.length })
                : t('meetings.count', { count: meetings.length })}
            </span>
          </div>
        )}
      </PageHeader>

      {meetings.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<CalendarClock />}
            title={t('meetings.empty')}
            description={t('meetings.emptyHint')}
            action={canWrite && (
              <Button variant="primary" icon={<Plus />} onClick={openCreate}>{t('meetings.newMeeting')}</Button>
            )}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<SearchX />}
            title={t('meetings.noResults')}
            action={<Button variant="secondary" onClick={() => setSearch('')}>{t('common.resetFilters')}</Button>}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((m) => {
            const today = isMeetingToday(m)
            const schedule = formatSchedule(t, m)
            const open = openCounts[m.id]
            return (
              <li key={m.id} className="group relative">
                <Link
                  to={`/meetings/${m.id}`}
                  className="surface-interactive flex h-full flex-col p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3.5 pr-8">
                    <DayTile meeting={m} today={today} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-sm font-semibold leading-6 text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                          {m.title}
                        </h3>
                        {today && <Badge variant="indigo" dot label={t('meetings.today')} />}
                      </div>
                      {m.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                        {t(`meetings.recurrence.${m.recurrence}`)}
                      </span>
                      {schedule && (
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {schedule}
                        </span>
                      )}
                      {m.location && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{m.location}</span>
                        </span>
                      )}
                      {m.isGlobal && (
                        <Badge variant="success" icon={<Globe />} label={t('meetings.global')} />
                      )}
                      <span className="inline-flex items-center gap-1.5 sm:ml-auto">
                        <ListTodo className="h-3.5 w-3.5 text-slate-400" />
                        {open === undefined ? (
                          <span className="inline-block h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" aria-hidden />
                        ) : open === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500">{t('meetings.noOpenTopics')}</span>
                        ) : (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {t('meetings.openTopicsCount', { count: open })}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </Link>

                {canWrite && (
                  <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
                    <DropdownMenu
                      trigger={(p) => (
                        <IconButton
                          {...p}
                          icon={<MoreHorizontal />}
                          label={t('common.moreActions')}
                          className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                        />
                      )}
                      items={[
                        { label: t('meetings.editMeeting'), icon: <Pencil />, onClick: () => openEdit(m) },
                        { type: 'divider' },
                        { label: t('meetings.deleteTitle'), icon: <Trash2 />, danger: true, onClick: () => setDeleteTarget(m) },
                      ]}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <MeetingFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        meeting={editTarget}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('meetings.deleteTitle')}
        message={t('meetings.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </Page>
  )
}
