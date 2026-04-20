import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock, ArrowLeft, Plus, CheckCircle2, Circle, Archive,
  ChevronRight, Trash2, RefreshCw, MapPin, Clock,
} from 'lucide-react'
import { useStore } from '@/store'
import { meetingsApi } from '@/api/client'
import type { MeetingTopic, TeamMember } from '@/types'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export default function MeetingDetailPage() {
  const { t }           = useTranslation()
  const { meetingId }   = useParams<{ meetingId: string }>()
  const navigate        = useNavigate()
  const meetings        = useStore((s) => s.meetings)
  const members         = useStore((s) => s.members)
  const updateMeeting   = useStore((s) => s.updateMeeting)

  const meeting = meetings.find((m) => m.id === meetingId)

  const [topics, setTopics]           = useState<MeetingTopic[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [newTitle, setNewTitle]       = useState('')
  const [adding, setAdding]           = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MeetingTopic | null>(null)

  const loadTopics = useCallback(async () => {
    if (!meetingId) return
    setLoadingTopics(true)
    try {
      const data = await meetingsApi.listTopics(meetingId, showArchived)
      setTopics(data)
    } finally {
      setLoadingTopics(false)
    }
  }, [meetingId, showArchived])

  useEffect(() => { loadTopics() }, [loadTopics])

  async function handleAddTopic() {
    if (!newTitle.trim() || !meetingId) return
    setAdding(true)
    try {
      const topic = await meetingsApi.createTopic(meetingId, { title: newTitle.trim() })
      setTopics((prev) => [topic, ...prev])
      setNewTitle('')
      setShowAddForm(false)
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleStatus(topic: MeetingTopic, e: React.MouseEvent) {
    e.stopPropagation()
    if (!meetingId) return
    const newStatus = topic.status === 'open' ? 'closed' : 'open'
    const updated = await meetingsApi.updateTopic(meetingId, topic.id, { status: newStatus })
    setTopics((prev) => prev.map((tp) => (tp.id === topic.id ? updated : tp)).filter((tp) =>
      showArchived ? true : tp.status === 'open',
    ))
  }

  async function handleDeleteTopic() {
    if (!deleteTarget || !meetingId) return
    await meetingsApi.deleteTopic(meetingId, deleteTarget.id)
    setTopics((prev) => prev.filter((tp) => tp.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  if (!meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">{t('meetings.notFound')}</p>
      </div>
    )
  }

  const openTopics   = topics.filter((tp) => tp.status === 'open')
  const closedTopics = topics.filter((tp) => tp.status === 'closed')

  function formatSchedule() {
    const parts: string[] = []
    if (meeting!.dayOfWeek != null) parts.push(t(`meetings.days.${DAY_KEYS[meeting!.dayOfWeek]}`))
    if (meeting!.meetingTime) parts.push(meeting!.meetingTime)
    return parts.join(', ')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('meetings.title')}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{meeting.title}</h1>
              {meeting.description && (
                <p className="text-sm text-slate-500 mt-0.5">{meeting.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t(`meetings.recurrence.${meeting.recurrence}`)}
                </span>
                {formatSchedule() && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {formatSchedule()}
                  </span>
                )}
                {meeting.location && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    {meeting.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agenda Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('meetings.agenda')}</h2>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {openTopics.length} {t('meetings.openTopics')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              showArchived
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {t('meetings.showArchived')}
            {closedTopics.length > 0 && !showArchived && (
              <span className="bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-full px-1.5 py-0 text-xs">
                {closedTopics.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('meetings.addTopic')}
          </button>
        </div>
      </div>

      {/* Add topic form */}
      {showAddForm && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTopic(); if (e.key === 'Escape') setShowAddForm(false) }}
            placeholder={t('meetings.topicTitlePlaceholder')}
            className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={handleAddTopic}
            disabled={!newTitle.trim() || adding}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {adding ? '…' : t('common.add')}
          </button>
          <button
            onClick={() => { setShowAddForm(false); setNewTitle('') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* Topics list */}
      {loadingTopics ? (
        <div className="text-center py-8 text-slate-400 text-sm">{t('meetings.loading')}</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t('meetings.emptyAgenda')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Open topics */}
          {openTopics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              meetingId={meeting.id}
              members={members}
              onToggle={handleToggleStatus}
              onDelete={() => setDeleteTarget(topic)}
              onNavigate={() => navigate(`/meetings/${meeting.id}/topics/${topic.id}`)}
              t={t}
            />
          ))}

          {/* Archived section */}
          {showArchived && closedTopics.length > 0 && (
            <>
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Archive className="w-3 h-3" /> {t('meetings.archivedTopics')}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>
              {closedTopics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  meetingId={meeting.id}
                  members={members}
                  onToggle={handleToggleStatus}
                  onDelete={() => setDeleteTarget(topic)}
                  onNavigate={() => navigate(`/meetings/${meeting.id}/topics/${topic.id}`)}
                  t={t}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">{t('meetings.deleteTopicTitle')}</h2>
            <p className="text-sm text-slate-500">{t('meetings.deleteTopicConfirm', { title: deleteTarget.title })}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleDeleteTopic} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TopicRowProps {
  topic: MeetingTopic
  meetingId: string
  members: TeamMember[]
  onToggle: (topic: MeetingTopic, e: React.MouseEvent) => void
  onDelete: () => void
  onNavigate: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function TopicRow({ topic, members, onToggle, onDelete, onNavigate, t }: TopicRowProps) {
  const isClosed  = topic.status === 'closed'
  const assignees = members.filter((m) => topic.assigneeIds?.includes(m.id))
  return (
    <div
      onClick={onNavigate}
      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        isClosed
          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm'
      }`}
    >
      <button
        onClick={(e) => onToggle(topic, e)}
        className="shrink-0 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        title={isClosed ? t('meetings.reopen') : t('meetings.close')}
      >
        {isClosed
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isClosed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
          {topic.title}
        </p>
        {topic.description && (
          <p className="text-xs text-slate-400 truncate mt-0.5">{topic.description.replace(/[#*`_>\-]/g, '').slice(0, 100)}</p>
        )}
      </div>
      {assignees.length > 0 && (
        <div className="flex items-center -space-x-1.5 shrink-0">
          {assignees.slice(0, 3).map((m) => (
            <div
              key={m.id}
              title={m.name}
              className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: m.avatarColor }}
            >
              {m.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {assignees.length > 3 && (
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
              +{assignees.length - 3}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-violet-400 transition-colors" />
    </div>
  )
}
