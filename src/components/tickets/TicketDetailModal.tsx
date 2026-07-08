import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Ticket as TicketIcon, ChevronLeft, ChevronRight,
  Loader2, Flag, Users, X, AlignLeft, Globe, Tag,
  Archive, ArchiveRestore, Trash2, ExternalLink,
} from 'lucide-react'
import { ticketsApi, meetingsApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { getMemberDisplayNames } from '@/utils/members'
import type { Ticket, TicketStatus, TicketPriority, TeamMember, TicketCategory, MeetingTopic } from '@/types'

// ─── Shared style constants ───────────────────────────────────────────────────

export const PRIORITY_FLAG: Record<TicketPriority, string> = {
  low:    'text-slate-300 dark:text-slate-600',
  medium: 'text-amber-400',
  high:   'text-red-500',
}

export const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  high:   'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TicketDetailModalProps {
  ticket: Ticket
  members: TeamMember[]
  allMembers: TeamMember[]
  categories: TicketCategory[]
  /** Called with the updated ticket after any save/move/archive/unarchive */
  onTicketChange: (updated: Ticket) => void
  /** Called after the ticket is deleted */
  onTicketDelete: (ticketId: string) => void
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketDetailModal({
  ticket, members, allMembers, categories,
  onTicketChange, onTicketDelete, onClose,
}: TicketDetailModalProps) {
  const { t }    = useTranslation()
  const navigate = useNavigate()
  const teams    = useAuthStore((s) => s.teams)

  const [title,       setTitle]       = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [status,      setStatus]      = useState<TicketStatus>(ticket.status)
  const [priority,    setPriority]    = useState<TicketPriority>(ticket.priority)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(ticket.assigneeIds ?? [])
  const [isGlobal,    setIsGlobal]    = useState(ticket.isGlobal)
  const [categoryId,  setCategoryId]  = useState<string | null>(ticket.categoryId)
  const [saving,      setSaving]      = useState(false)

  // Linked topics (loaded from API to get title + meetingId)
  const [linkedTopics,    setLinkedTopics]    = useState<MeetingTopic[]>([])
  const [loadingTopics,   setLoadingTopics]   = useState(false)

  useEffect(() => {
    if (!ticket.topicIds?.length) return
    setLoadingTopics(true)
    Promise.all(ticket.topicIds.map((id) => meetingsApi.getTopicById(id).catch(() => null)))
      .then((results) => setLinkedTopics(results.filter((t): t is MeetingTopic => t !== null)))
      .finally(() => setLoadingTopics(false))
  }, [ticket.topicIds])

  async function saveField(patch: Partial<Record<string, unknown>>) {
    setSaving(true)
    try {
      const updated = await ticketsApi.update(ticket.id, patch as Parameters<typeof ticketsApi.update>[1])
      onTicketChange(updated)
      return updated
    } finally {
      setSaving(false)
    }
  }

  function toggleAssignee(id: string) {
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((x) => x !== id)
      : [...assigneeIds, id]
    setAssigneeIds(next)
    saveField({ assigneeIds: next })
  }

  async function handleDelete() {
    await ticketsApi.delete(ticket.id)
    onTicketDelete(ticket.id)
    onClose()
  }

  async function handleArchive() {
    const updated = await saveField({ isArchived: true })
    if (updated) onClose()
  }

  async function handleUnarchive() {
    await saveField({ isArchived: false })
  }

  const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
  const idx        = statuses.indexOf(status)
  const canBack    = idx > 0
  const canForward = idx < statuses.length - 1

  const STATUS_BADGE: Record<TicketStatus, string> = {
    todo:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    done:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  }

  const memberPool = isGlobal ? allMembers.filter((m) => m.isActive) : members.filter((m) => m.isActive)
  const memberDisplayNames = useMemo(() => getMemberDisplayNames(memberPool, teams), [memberPool, teams])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-indigo-500 shrink-0" />
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as TicketStatus
                setStatus(next)
                saveField({ status: next })
              }}
              className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_BADGE[status]}`}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{t(`tickets.status.${s}`)}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                const next = statuses[idx - 1]
                if (!next) return
                setStatus(next)
                const updated = await saveField({ status: next })
                if (updated) setStatus(updated.status)
              }}
              disabled={!canBack}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={async () => {
                const next = statuses[idx + 1]
                if (!next) return
                setStatus(next)
                const updated = await saveField({ status: next })
                if (updated) setStatus(updated.status)
              }}
              disabled={!canForward}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            {ticket.isArchived ? (
              <button
                onClick={handleUnarchive}
                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                title={t('tickets.unarchive')}
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            ) : status === 'done' ? (
              <button
                onClick={handleArchive}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
                title={t('tickets.archiveTitle')}
              >
                <Archive className="w-4 h-4" />
              </button>
            ) : null}
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {ticket.isArchived && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-400">{t('tickets.archivedNote')}</span>
          </div>
        )}

        <div className="px-5 pb-5 space-y-5">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== ticket.title && saveField({ title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full text-base font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-400 focus:outline-none py-0.5 transition-colors"
          />

          {/* Priority + Category + Global */}
          <div className="flex items-center gap-3 flex-wrap">
            <Flag className={`w-3.5 h-3.5 shrink-0 ${PRIORITY_FLAG[priority]}`} />
            <select
              value={priority}
              onChange={(e) => {
                const next = e.target.value as TicketPriority
                setPriority(next)
                saveField({ priority: next })
              }}
              className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${PRIORITY_BADGE[priority]}`}
            >
              {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
              ))}
            </select>

            {categories.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                <select
                  value={categoryId ?? ''}
                  onChange={(e) => {
                    const next = e.target.value || null
                    setCategoryId(next)
                    saveField({ categoryId: next })
                  }}
                  className="text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('tickets.noCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const next = !isGlobal
                setIsGlobal(next)
                saveField({ isGlobal: next })
              }}
              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                isGlobal
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={t('tickets.globalHint')}
            >
              <Globe className="w-3 h-3" />
              {t('tickets.global')}
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <AlignLeft className="w-3.5 h-3.5" />
              {t('tickets.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== ticket.description && saveField({ description })}
              placeholder={t('tickets.descriptionPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Users className="w-3.5 h-3.5" />
              {t('tickets.assigneesLabel')}
            </label>
            {memberPool.length === 0 ? (
              <p className="text-xs text-slate-400">{t('meetings.noMembers')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {memberPool.map((m) => {
                  const selected = assigneeIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                        style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : m.avatarColor }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      {memberDisplayNames.get(m.id) ?? m.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Linked Topics */}
          {ticket.topicIds?.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                🔗 {t('tickets.linkedTopics')}
              </label>
              {loadingTopics ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </div>
              ) : (
                <ul className="space-y-1">
                  {linkedTopics.map((topic) => (
                    <li key={topic.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate(`/meetings/${topic.meetingId}/topics/${topic.id}`)
                        }}
                        className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
                        <span className="truncate">{topic.title}</span>
                      </button>
                    </li>
                  ))}
                  {/* Show IDs for any topics that failed to load */}
                  {ticket.topicIds.length > linkedTopics.length && (
                    <li className="text-xs text-slate-400 px-2.5">
                      +{ticket.topicIds.length - linkedTopics.length} {t('tickets.linkedTopics').toLowerCase()}
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
