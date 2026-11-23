import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  CalendarClock, Plus, Archive, Trash2, RefreshCw, MapPin, Clock, ChevronUp, ChevronDown,
  Globe, ListTodo, MoreHorizontal, Pencil, Ticket as TicketIcon, SearchX, ArrowLeft, CheckCircle2,
} from 'lucide-react'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { getMemberDisplayNames } from '@/utils/members'
import { meetingsApi } from '@/api/client'
import type { MeetingTopic, MeetingTopicStatus, TeamMember, Team } from '@/types'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import Skeleton from '@/components/ui/Skeleton'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { toast, errorMessage } from '@/store/toast'
import { TopicStatusMenu } from '@/components/meetings/TopicStatus'
import MeetingFormModal, { type MeetingPayload } from '@/components/meetings/MeetingFormModal'
import { formatSchedule } from '@/components/meetings/meetingUtils'
import { stripMarkdown } from '@/components/knownErrors/utils'

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

  async function handleMove(topic: MeetingTopic, direction: 'up' | 'down') {
    if (!meetingId) return
    const active = topics.filter((tp) => tp.status !== 'done')
    const idx    = active.findIndex((tp) => tp.id === topic.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= active.length) return

    const swapTopic = active[swapIdx]
    try {
      const [updA, updB] = await Promise.all([
        meetingsApi.updateTopic(meetingId, topic.id,     { sortOrder: swapTopic.sortOrder }),
        meetingsApi.updateTopic(meetingId, swapTopic.id, { sortOrder: topic.sortOrder }),
      ])
      setTopics((prev) => prev
        .map((tp) => {
          if (tp.id === updA.id) return updA
          if (tp.id === updB.id) return updB
          return tp
        })
        .sort((a, b) => a.sortOrder - b.sortOrder),
      )
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
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
            {tab === 'open'
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
        <ul className="surface divide-y divide-slate-100 dark:divide-slate-800">
          {list.map((topic, idx) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              to={`/meetings/${meeting.id}/topics/${topic.id}`}
              members={memberPool}
              teams={teams}
              canMove={tab === 'open' && !filterQuery}
              isFirst={idx === 0}
              isLast={idx === list.length - 1}
              canWrite={canWrite}
              onStatusChange={handleStatusChange}
              onMove={handleMove}
              onDelete={() => setDeleteTarget(topic)}
            />
          ))}
        </ul>
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

// ─── Topic row ────────────────────────────────────────────────────────────────

interface TopicRowProps {
  topic: MeetingTopic
  to: string
  members: TeamMember[]
  teams: Team[]
  canMove: boolean
  isFirst: boolean
  isLast: boolean
  canWrite: boolean
  onStatusChange: (topic: MeetingTopic, status: MeetingTopicStatus) => void
  onMove: (topic: MeetingTopic, dir: 'up' | 'down') => void
  onDelete: () => void
}

const revealCls = 'opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'

/**
 * Whole row is clickable via a stretched link. Interactive controls come AFTER the link in the
 * DOM (visual order via `order-*`) so they paint above the link overlay without z-index
 * — this keeps dropdown menus above the following rows.
 */
function TopicRow({ topic, to, members, teams, canMove, isFirst, isLast, canWrite, onStatusChange, onMove, onDelete }: TopicRowProps) {
  const { t } = useTranslation()
  const isDone    = topic.status === 'done'
  const assignees = members.filter((m) => topic.assigneeIds?.includes(m.id))
  const assigneeDisplayNames = getMemberDisplayNames(assignees, teams)
  const preview   = topic.description ? stripMarkdown(topic.description) : ''
  const ticketCount = topic.ticketIds?.length ?? 0

  const menuItems: DropdownItem[] = [
    ...(canMove
      ? [
          { label: t('meetings.moveUp'), icon: <ChevronUp />, disabled: isFirst, onClick: () => onMove(topic, 'up') },
          { label: t('meetings.moveDown'), icon: <ChevronDown />, disabled: isLast, onClick: () => onMove(topic, 'down') },
          { type: 'divider' as const },
        ]
      : []),
    { label: t('meetings.deleteTopicTitle'), icon: <Trash2 />, danger: true, onClick: onDelete },
  ]

  return (
    <li className="group relative flex items-center gap-3 px-3 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/40 sm:px-4">
      {/* Title (stretched link) */}
      <Link
        to={to}
        className="order-3 min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-indigo-500/70"
      >
        <span
          className={`block truncate text-sm font-medium ${
            isDone ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400'
          }`}
        >
          {topic.title}
        </span>
        {(preview || (isDone && topic.closedAt)) && (
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {isDone && topic.closedAt
              ? t('meetings.closedAt', { date: format(new Date(topic.closedAt), 'dd.MM.yyyy') })
              : preview}
          </span>
        )}
      </Link>

      {/* Reorder (desktop, hover) */}
      {canWrite && canMove && (
        <div className={`relative order-1 hidden shrink-0 flex-col sm:flex ${revealCls}`}>
          <IconButton size="xs" icon={<ChevronUp />} label={t('meetings.moveUp')} disabled={isFirst} onClick={() => onMove(topic, 'up')} className="!h-4 !rounded" />
          <IconButton size="xs" icon={<ChevronDown />} label={t('meetings.moveDown')} disabled={isLast} onClick={() => onMove(topic, 'down')} className="!h-4 !rounded" />
        </div>
      )}

      {/* Status */}
      <div className="relative order-2 shrink-0">
        <TopicStatusMenu
          status={topic.status}
          compact
          disabled={!canWrite}
          onChange={(s) => onStatusChange(topic, s)}
        />
      </div>

      {/* Meta */}
      {(ticketCount > 0 || assignees.length > 0) && (
        <div className="relative order-4 hidden shrink-0 items-center gap-3 sm:flex">
          {ticketCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              title={t('meetings.linkedTicketsCount', { count: ticketCount })}
            >
              <TicketIcon className="h-3 w-3 text-slate-400" />
              {ticketCount}
            </span>
          )}
          {assignees.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {assignees.slice(0, 3).map((m) => (
                <Avatar key={m.id} name={assigneeDisplayNames.get(m.id) ?? m.name} color={m.avatarColor} size="xs" ring />
              ))}
              {assignees.length > 3 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row actions */}
      {canWrite && (
        <div className="relative order-5 shrink-0">
          <DropdownMenu
            trigger={(p) => (
              <IconButton
                {...p}
                icon={<MoreHorizontal />}
                label={t('common.moreActions')}
                className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
              />
            )}
            items={menuItems}
          />
        </div>
      )}
    </li>
  )
}
