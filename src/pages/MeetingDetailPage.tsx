import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  CalendarClock, Plus, Archive, Trash2, RefreshCw, MapPin, Clock, Globe, ListTodo, MoreHorizontal, Pencil, SearchX, ArrowLeft, CheckCircle2,
} from 'lucide-react'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { meetingsApi } from '@/api/client'
import type { MeetingTopic, MeetingTopicStatus } from '@/types'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import Skeleton from '@/components/ui/Skeleton'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { toast, errorMessage } from '@/store/toast'
import AgendaList from '@/components/meetings/AgendaList'
import MeetingFormModal, { type MeetingPayload } from '@/components/meetings/MeetingFormModal'
import { formatSchedule } from '@/components/meetings/meetingUtils'

type TabKey = 'open' | 'done'

export default function MeetingDetailPage() {
  const { t }           = useTranslation()
  const { meetingId }   = useParams<{ meetingId: string }>()
  const navigate        = useNavigate()
  const meetings        = useStore((s) => s.meetings)
  const members         = useStore((s) => s.members)
  const allMembers      = useStore((s) => s.allMembers)
  const updateMeeting   = useStore((s) => s.updateMeeting)
  const deleteMeeting   = useStore((s) => s.deleteMeeting)
  const teams           = useAuthStore((s) => s.teams)

  const { canWrite, isReadOnly } = usePagePermission('meetings')

  const meeting = meetings.find((m) => m.id === meetingId)

  const [topics, setTopics]               = useState<MeetingTopic[]>([])
  const [tab, setTab]                     = useState<TabKey>('open')
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [topicFilter, setTopicFilter]     = useState('')
  const [newTitle, setNewTitle]           = useState('')
  const [adding, setAdding]               = useState(false)
  const [showAddForm, setShowAddForm]     = useState(false)
  const [deleteTarget, setDeleteTarget]   = useState<MeetingTopic | null>(null)
  const [editOpen, setEditOpen]           = useState(false)
  const [confirmDeleteMeeting, setConfirmDeleteMeeting] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // Load all topics (open + done) once; the tabs split them client-side.
  const loadTopics = useCallback(async () => {
    if (!meetingId) return
    setLoadingTopics(true)
    try {
      setTopics(await meetingsApi.listTopics(meetingId, true))
    } catch (err) {
      toast.error(t('common.loadError'), { description: errorMessage(err) })
    } finally {
      setLoadingTopics(false)
    }
  }, [meetingId, t])

  useEffect(() => { loadTopics() }, [loadTopics])

  function openAddForm() {
    setTab('open')
    setShowAddForm(true)
    requestAnimationFrame(() => addInputRef.current?.focus())
  }

  async function handleAddTopic() {
    if (!newTitle.trim() || !meetingId || adding) return
    setAdding(true)
    try {
      const topic = await meetingsApi.createTopic(meetingId, { title: newTitle.trim() })
      setTopics((prev) => [...prev, topic])
      setNewTitle('')
      toast.success(t('meetings.topicAdded'), { description: topic.title })
      // Keep the form open for quick consecutive entries
      requestAnimationFrame(() => addInputRef.current?.focus())
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setAdding(false)
    }
  }

  async function handleStatusChange(topic: MeetingTopic, newStatus: MeetingTopicStatus, silent = false) {
    if (!meetingId) return
    const previous = topic.status
    try {
      const updated = await meetingsApi.updateTopic(meetingId, topic.id, { status: newStatus })
      setTopics((prev) => prev.map((tp) => (tp.id === topic.id ? updated : tp)))
      if (silent) return
      if (newStatus === 'done' || previous === 'done') {
        toast.success(
          newStatus === 'done' ? t('meetings.topicDone') : t('meetings.topicReopened'),
          {
            description: topic.title,
            action: { label: t('meetings.undo'), onClick: () => handleStatusChange(updated, previous, true) },
          },
        )
      }
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  /** Saves a new agenda order (open topics in display order) — optimistic, reverted on error. */
  async function handleReorder(orderedIds: string[]) {
    if (!meetingId) return
    const previous = topics
    const position = new Map(orderedIds.map((id, i) => [id, i]))
    setTopics((prev) => prev
      .map((tp) => (position.has(tp.id) ? { ...tp, sortOrder: position.get(tp.id)! } : tp))
      .sort((a, b) => a.sortOrder - b.sortOrder))
    try {
      setTopics(await meetingsApi.reorderTopics(meetingId, orderedIds))
    } catch (err) {
      setTopics(previous)
      toast.error(t('meetings.reorderError'), { description: errorMessage(err) })
    }
  }

  async function handleDeleteTopic() {
    if (!deleteTarget || !meetingId) return
    try {
      await meetingsApi.deleteTopic(meetingId, deleteTarget.id)
      setTopics((prev) => prev.filter((tp) => tp.id !== deleteTarget.id))
      toast.success(t('common.deleted'), { description: deleteTarget.title })
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleUpdateMeeting(payload: MeetingPayload) {
    try {
      await updateMeeting(meeting!.id, payload)
      toast.success(t('common.saved'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleDeleteMeeting() {
    try {
      await deleteMeeting(meeting!.id)
      toast.success(t('common.deleted'), { description: meeting!.title })
      navigate('/meetings')
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const activeTopics = useMemo(() => topics.filter((tp) => tp.status !== 'done'), [topics])
  const doneTopics   = useMemo(
    () => topics
      .filter((tp) => tp.status === 'done')
      .sort((a, b) => new Date(b.closedAt ?? b.updatedAt).getTime() - new Date(a.closedAt ?? a.updatedAt).getTime()),
    [topics],
  )

  if (!meeting) {
    return (
      <Page size="narrow">
        <PageHeader back={{ to: '/meetings', label: t('meetings.title') }} title={t('meetings.title')} />
        <div className="surface">
          <EmptyState
            icon={<CalendarClock />}
            title={t('meetings.notFound')}
            action={<Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate('/meetings')}>{t('meetings.backToList')}</Button>}
          />
        </div>
      </Page>
    )
  }

  const filterQuery = topicFilter.trim().toLowerCase()
  const matches = (tp: MeetingTopic) =>
    !filterQuery ||
    tp.title.toLowerCase().includes(filterQuery) ||
    (tp.description ?? '').toLowerCase().includes(filterQuery)

  const list = (tab === 'open' ? activeTopics : doneTopics).filter(matches)
  // Agenda positions stay visible while filtering (they refer to the full agenda)
  const positions = tab === 'open' ? new Map(activeTopics.map((tp, i) => [tp.id, i + 1])) : undefined
  const schedule = formatSchedule(t, meeting)
  const memberPool = meeting.isGlobal ? allMembers : members

  const inProgressCount = activeTopics.filter((tp) => tp.status === 'in_progress').length

  return (
    <Page size="default">
      <PageHeader
        back={{ to: '/meetings', label: t('meetings.title') }}
        title={meeting.title}
        meta={meeting.isGlobal && <Badge variant="success" icon={<Globe />} label={t('meetings.global')} />}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
              {t(`meetings.recurrence.${meeting.recurrence}`)}
            </span>
            {schedule && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {schedule}
              </span>
            )}
            {meeting.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {meeting.location}
              </span>
            )}
          </span>
        }
        actions={
          canWrite && (
            <>
              <Button variant="primary" icon={<Plus />} onClick={openAddForm}>
                {t('meetings.addTopic')}
              </Button>
              <DropdownMenu
                trigger={(p) => (
                  <IconButton {...p} variant="secondary" size="md" icon={<MoreHorizontal />} label={t('common.moreActions')} />
                )}
                items={[
                  { label: t('meetings.editMeeting'), icon: <Pencil />, onClick: () => setEditOpen(true) },
                  { type: 'divider' },
                  { label: t('meetings.deleteTitle'), icon: <Trash2 />, danger: true, onClick: () => setConfirmDeleteMeeting(true) },
                ]}
              />
            </>
          )
        }
      >
        {isReadOnly && <ReadOnlyBanner className="mb-5" />}
        {meeting.description && (
          <p className="mb-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {meeting.description}
          </p>
        )}
        <Tabs<TabKey>
          aria-label={t('meetings.agenda')}
          value={tab}
          onChange={setTab}
          items={[
            { value: 'open', label: t('meetings.agenda'), icon: ListTodo, count: loadingTopics ? undefined : activeTopics.length },
            { value: 'done', label: t('meetings.archivedTopics'), icon: Archive, count: loadingTopics ? undefined : doneTopics.length },
          ]}
        />
      </PageHeader>

      {/* Toolbar */}
      {topics.length > 0 && (
        <div className="-mt-1 mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={topicFilter}
            onChange={setTopicFilter}
            size="sm"
            placeholder={t('meetings.searchTopics')}
            className="w-full sm:w-72"
            aria-label={t('common.search')}
          />
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 sm:ml-auto">
            {tab === 'open' && filterQuery && canWrite
              ? t('meetings.reorderFilterHint')
              : tab === 'open'
                ? t('meetings.agendaSummary', { open: activeTopics.length, inProgress: inProgressCount })
                : t('meetings.doneSummary', { count: doneTopics.length })}
          </span>
        </div>
      )}

      {/* Add topic form */}
      {showAddForm && tab === 'open' && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAddTopic() }}
          className="surface mb-4 flex flex-col gap-2 p-3 animate-slide-down sm:flex-row sm:items-center"
        >
          <input
            ref={addInputRef}
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowAddForm(false); setNewTitle('') } }}
            placeholder={t('meetings.topicTitlePlaceholder')}
            aria-label={t('meetings.addTopic')}
            className="form-input flex-1"
          />
          <div className="flex items-center gap-2">
            <span className="hidden text-2xs text-slate-400 lg:inline">
              <kbd className="kbd">Enter</kbd> {t('meetings.toAdd')} · <kbd className="kbd">Esc</kbd> {t('meetings.toClose')}
            </span>
            <Button variant="ghost" onClick={() => { setShowAddForm(false); setNewTitle('') }} className="ml-auto sm:ml-0">
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" icon={<Plus />} loading={adding} disabled={!newTitle.trim()}>
              {t('common.add')}
            </Button>
          </div>
        </form>
      )}

      {/* Topics list */}
      {loadingTopics ? (
        <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-5 w-24 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="surface">
          {filterQuery ? (
            <EmptyState
              compact
              icon={<SearchX />}
              title={t('meetings.noResults')}
              action={<Button variant="secondary" size="sm" onClick={() => setTopicFilter('')}>{t('common.resetFilters')}</Button>}
            />
          ) : tab === 'open' ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title={t('meetings.emptyAgenda')}
              description={t('meetings.emptyAgendaHint')}
              action={canWrite && !showAddForm && (
                <Button variant="primary" icon={<Plus />} onClick={openAddForm}>{t('meetings.addTopic')}</Button>
              )}
            />
          ) : (
            <EmptyState icon={<Archive />} title={t('meetings.emptyDone')} />
          )}
        </div>
      ) : (
        <AgendaList
          topics={list}
          positions={positions}
          sortable={canWrite && tab === 'open' && !filterQuery && list.length > 1}
          canWrite={canWrite}
          members={memberPool}
          teams={teams}
          topicHref={(topic) => `/meetings/${meeting.id}/topics/${topic.id}`}
          onReorder={handleReorder}
          onStatusChange={handleStatusChange}
          onDelete={setDeleteTarget}
        />
      )}

      {/* Delete topic */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('meetings.deleteTopicTitle')}
        message={t('meetings.deleteTopicConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDeleteTopic}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />

      {/* Edit / delete meeting */}
      <MeetingFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} meeting={meeting} onSubmit={handleUpdateMeeting} />
      <ConfirmDialog
        isOpen={confirmDeleteMeeting}
        title={t('meetings.deleteTitle')}
        message={t('meetings.deleteConfirm', { title: meeting.title })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDeleteMeeting}
        onClose={() => setConfirmDeleteMeeting(false)}
        variant="danger"
      />
    </Page>
  )
}
