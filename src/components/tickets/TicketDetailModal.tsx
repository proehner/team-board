import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Ticket as TicketIcon, ChevronLeft, ChevronRight, Flag, Users, AlignLeft, Globe, Tag,
  Archive, ArchiveRestore, Trash2, ExternalLink, Link2, Check, Loader2,
} from 'lucide-react'
import { ticketsApi, meetingsApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import { getMemberDisplayNames } from '@/utils/members'
import type { Ticket, TicketStatus, TicketPriority, TeamMember, TicketCategory, MeetingTopic } from '@/types'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Select from '@/components/ui/Select'
import SearchInput from '@/components/ui/SearchInput'
import Avatar from '@/components/ui/Avatar'
import Skeleton from '@/components/ui/Skeleton'
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_STATUS_META, TICKET_PRIORITY_META } from './ticketMeta'

// ─── Shared style constants (kept for backwards compatibility) ───────────────

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
  /** Disables all editing controls (read-only page permission) */
  readOnly?: boolean
}

const ASSIGNEE_SEARCH_THRESHOLD = 12

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketDetailModal({
  ticket, members, allMembers, categories,
  onTicketChange, onTicketDelete, onClose, readOnly = false,
}: TicketDetailModalProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const teams    = useAuthStore((s) => s.teams)

  const [title,       setTitle]       = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [status,      setStatus]      = useState<TicketStatus>(ticket.status)
  const [priority,    setPriority]    = useState<TicketPriority>(ticket.priority)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(ticket.assigneeIds ?? [])
  const [isGlobal,    setIsGlobal]    = useState(ticket.isGlobal)
  const [categoryId,  setCategoryId]  = useState<string | null>(ticket.categoryId)
  const [pending,     setPending]     = useState(0)
  const [savedAt,     setSavedAt]     = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [assigneeQuery, setAssigneeQuery] = useState('')

  // Always compare against the latest server state of the ticket
  const ticketRef = useRef(ticket)
  ticketRef.current = ticket

  // Auto-grow the (multi-line capable) title field so long titles wrap instead of scrolling
  const titleRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  // Linked topics (loaded from API to get title + meetingId)
  const [linkedTopics,    setLinkedTopics]    = useState<MeetingTopic[]>([])
  const [loadingTopics,   setLoadingTopics]   = useState(false)

  useEffect(() => {
    if (!ticket.topicIds?.length) return
    setLoadingTopics(true)
    Promise.all(ticket.topicIds.map((id) => meetingsApi.getTopicById(id).catch(() => null)))
      .then((results) => setLinkedTopics(results.filter((tp): tp is MeetingTopic => tp !== null)))
      .finally(() => setLoadingTopics(false))
  }, [ticket.topicIds])

  // Hide the "saved" hint after a moment
  useEffect(() => {
    if (!savedAt) return
    const id = window.setTimeout(() => setSavedAt(null), 2000)
    return () => window.clearTimeout(id)
  }, [savedAt])

  async function saveField(patch: Partial<Record<string, unknown>>, revert?: () => void) {
    setPending((n) => n + 1)
    try {
      const updated = await ticketsApi.update(ticket.id, patch as Parameters<typeof ticketsApi.update>[1])
      onTicketChange(updated)
      setSavedAt(Date.now())
      return updated
    } catch (err) {
      revert?.()
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      return undefined
    } finally {
      setPending((n) => n - 1)
    }
  }

  function toggleAssignee(id: string) {
    const prev = assigneeIds
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((x) => x !== id)
      : [...assigneeIds, id]
    setAssigneeIds(next)
    saveField({ assigneeIds: next }, () => setAssigneeIds(prev))
  }

  function changeStatus(next: TicketStatus) {
    const prev = status
    setStatus(next)
    saveField({ status: next }, () => setStatus(prev)).then((updated) => {
      if (updated) setStatus(updated.status)
    })
  }

  function saveTitle() {
    const trimmed = title.trim()
    if (!trimmed) { setTitle(ticketRef.current.title); return }
    if (trimmed !== ticketRef.current.title) saveField({ title: trimmed })
  }

  function saveDescription() {
    if (description !== ticketRef.current.description) saveField({ description })
  }

  /** Persist pending text edits (title/description) before closing via Esc / X / backdrop */
  function handleClose() {
    if (!readOnly) {
      const trimmed = title.trim()
      const patch: Record<string, unknown> = {}
      if (trimmed && trimmed !== ticketRef.current.title) patch.title = trimmed
      if (description !== ticketRef.current.description) patch.description = description
      if (Object.keys(patch).length > 0) saveField(patch)
    }
    onClose()
  }

  async function handleDelete() {
    try {
      await ticketsApi.delete(ticket.id)
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
    toast.success(t('tickets.toast.deleted'))
    onTicketDelete(ticket.id)
    onClose()
  }

  async function handleArchive() {
    const updated = await saveField({ isArchived: true })
    if (updated) {
      toast.success(t('tickets.toast.archived'))
      onClose()
    }
  }

  async function handleUnarchive() {
    const updated = await saveField({ isArchived: false })
    if (updated) toast.success(t('tickets.toast.restored'))
  }

  const idx        = TICKET_STATUSES.indexOf(status)
  const canBack    = idx > 0
  const canForward = idx < TICKET_STATUSES.length - 1

  const memberPool = useMemo(
    () => (isGlobal ? allMembers : members).filter((m) => m.isActive),
    [isGlobal, allMembers, members],
  )
  const memberDisplayNames = useMemo(() => getMemberDisplayNames(memberPool, teams), [memberPool, teams])
  const visibleMembers = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase()
    if (!q) return memberPool
    return memberPool.filter((m) => (memberDisplayNames.get(m.id) ?? m.name).toLowerCase().includes(q))
  }, [memberPool, memberDisplayNames, assigneeQuery])

  const locale = i18n.language.startsWith('de') ? 'de-DE' : 'en-US'
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })
  const saving = pending > 0

  const labelCls = 'mb-1.5 flex items-center gap-1.5 section-label [&_svg]:h-3.5 [&_svg]:w-3.5'

  return (
    <>
      <Modal
        isOpen
        onClose={handleClose}
        size="xl"
        icon={<TicketIcon />}
        title={readOnly ? t('tickets.ticketDetails') : t('tickets.editTicket')}
        description={
          <span className="tabular-nums">
            {t('tickets.createdOn', { date: fmt(ticket.createdAt) })}
            {ticket.updatedAt && ticket.updatedAt !== ticket.createdAt && (
              <> · {t('tickets.updatedOn', { date: fmt(ticket.updatedAt) })}</>
            )}
          </span>
        }
        footer={
          <>
            <div className="mr-auto flex min-h-[2.25rem] items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t('tickets.saving')}</>
              ) : savedAt ? (
                <><Check className="h-3.5 w-3.5 text-emerald-500" />{t('common.saved')}</>
              ) : null}
            </div>
            {!readOnly && (
              <>
                <Button variant="ghost" icon={<Trash2 />} onClick={() => setConfirmDelete(true)} className="!text-red-600 hover:!bg-red-50 dark:!text-red-400 dark:hover:!bg-red-500/10">
                  {t('common.delete')}
                </Button>
                {ticket.isArchived ? (
                  <Button variant="secondary" icon={<ArchiveRestore />} onClick={handleUnarchive}>
                    {t('tickets.unarchive')}
                  </Button>
                ) : status === 'done' ? (
                  <Button variant="secondary" icon={<Archive />} onClick={handleArchive}>
                    {t('tickets.archiveAction')}
                  </Button>
                ) : null}
              </>
            )}
            <Button variant="primary" onClick={handleClose}>{t('common.close')}</Button>
          </>
        }
      >
        {ticket.isArchived && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Archive className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-800 dark:text-amber-300">{t('tickets.archivedNote')}</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="ticket-title" className="sr-only">{t('tickets.titleLabel')}</label>
              <textarea
                id="ticket-title"
                ref={titleRef}
                rows={1}
                value={title}
                readOnly={readOnly}
                onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
                }}
                placeholder={t('tickets.titlePlaceholder')}
                className="-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold leading-snug text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 read-only:hover:border-transparent dark:text-slate-50 dark:hover:border-slate-700 dark:focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="ticket-description" className={labelCls}>
                <AlignLeft />
                {t('tickets.descriptionLabel')}
              </label>
              <textarea
                id="ticket-description"
                value={description}
                readOnly={readOnly}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={saveDescription}
                placeholder={readOnly ? '' : t('tickets.descriptionPlaceholder')}
                rows={6}
                className="form-textarea"
              />
            </div>

            {/* Assignees */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className={labelCls.replace('mb-1.5 ', '')}>
                  <Users />
                  {t('tickets.assigneesLabel')}
                  {assigneeIds.length > 0 && (
                    <span className="rounded-full bg-indigo-100 px-1.5 py-px text-2xs font-semibold tabular-nums text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {assigneeIds.length}
                    </span>
                  )}
                </span>
                {memberPool.length > ASSIGNEE_SEARCH_THRESHOLD && (
                  <SearchInput
                    size="sm"
                    value={assigneeQuery}
                    onChange={setAssigneeQuery}
                    placeholder={t('tickets.searchMembers')}
                    className="w-40 sm:w-52"
                    aria-label={t('tickets.searchMembers')}
                  />
                )}
              </div>
              {memberPool.length === 0 ? (
                <p className="text-xs text-slate-400">{t('meetings.noMembers')}</p>
              ) : visibleMembers.length === 0 ? (
                <p className="text-xs text-slate-400">{t('common.noResults')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('tickets.assigneesLabel')}>
                  {visibleMembers.map((m) => {
                    const selected = assigneeIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={selected}
                        onClick={() => toggleAssignee(m.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:cursor-default ${
                          selected
                            ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/40'
                            : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 disabled:hover:bg-white dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:disabled:hover:bg-slate-900'
                        } ${readOnly && !selected ? 'opacity-50' : ''}`}
                      >
                        <Avatar name={m.name} color={m.avatarColor} size="2xs" />
                        {memberDisplayNames.get(m.id) ?? m.name}
                        {selected && <Check className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Linked Topics */}
            {ticket.topicIds?.length > 0 && (
              <div>
                <span className={labelCls}>
                  <Link2 />
                  {t('tickets.linkedTopics')}
                </span>
                {loadingTopics ? (
                  <div className="space-y-2">
                    {ticket.topicIds.map((id) => <Skeleton key={id} className="h-8 w-full" />)}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {linkedTopics.map((topic) => (
                      <li key={topic.id}>
                        <button
                          type="button"
                          onClick={() => {
                            handleClose()
                            navigate(`/meetings/${topic.meetingId}/topics/${topic.id}`)
                          }}
                          className="group flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                        >
                          <span className="min-w-0 flex-1 truncate">{topic.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-indigo-500" />
                        </button>
                      </li>
                    ))}
                    {/* Topics that failed to load */}
                    {ticket.topicIds.length > linkedTopics.length && (
                      <li className="px-3 py-2 text-xs text-slate-400">
                        +{ticket.topicIds.length - linkedTopics.length} {t('tickets.linkedTopics')}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* ── Properties panel ── */}
          <aside className="space-y-5 lg:border-l lg:border-slate-100 lg:pl-6 dark:lg:border-slate-800">
            {/* Status */}
            <div>
              <label htmlFor="ticket-status" className={labelCls}>{t('tickets.statusLabel')}</label>
              <div className="flex items-center gap-1">
                <Select
                  id="ticket-status"
                  size="sm"
                  disabled={readOnly}
                  icon={<span className={`block h-2 w-2 rounded-full ${TICKET_STATUS_META[status].dotCls}`} />}
                  value={status}
                  onChange={(e) => changeStatus(e.target.value as TicketStatus)}
                  wrapperClassName="min-w-0 flex-1"
                  data-autofocus={readOnly ? undefined : true}
                >
                  {TICKET_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`tickets.status.${s}`)}</option>
                  ))}
                </Select>
                {!readOnly && (
                  <>
                    <IconButton
                      size="sm"
                      icon={<ChevronLeft />}
                      label={canBack ? t('tickets.moveTo', { status: t(`tickets.status.${TICKET_STATUSES[idx - 1]}`) }) : t('tickets.moveBack')}
                      disabled={!canBack}
                      onClick={() => canBack && changeStatus(TICKET_STATUSES[idx - 1])}
                    />
                    <IconButton
                      size="sm"
                      icon={<ChevronRight />}
                      label={canForward ? t('tickets.moveTo', { status: t(`tickets.status.${TICKET_STATUSES[idx + 1]}`) }) : t('tickets.moveForward')}
                      disabled={!canForward}
                      onClick={() => canForward && changeStatus(TICKET_STATUSES[idx + 1])}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="ticket-priority" className={labelCls}>{t('tickets.filterByPriority')}</label>
              <Select
                id="ticket-priority"
                size="sm"
                disabled={readOnly}
                icon={<Flag className={TICKET_PRIORITY_META[priority].flagCls} />}
                value={priority}
                onChange={(e) => {
                  const prev = priority
                  const next = e.target.value as TicketPriority
                  setPriority(next)
                  saveField({ priority: next }, () => setPriority(prev))
                }}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
                ))}
              </Select>
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <label htmlFor="ticket-category" className={labelCls}>{t('tickets.filterByCategory')}</label>
                <Select
                  id="ticket-category"
                  size="sm"
                  disabled={readOnly}
                  icon={(() => {
                    const cat = categories.find((c) => c.id === categoryId)
                    return cat
                      ? <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      : <Tag />
                  })()}
                  value={categoryId ?? ''}
                  onChange={(e) => {
                    const prev = categoryId
                    const next = e.target.value || null
                    setCategoryId(next)
                    saveField({ categoryId: next }, () => setCategoryId(prev))
                  }}
                >
                  <option value="">{t('tickets.noCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {/* Cross-team */}
            <div>
              <span className={labelCls}>{t('tickets.visibility')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isGlobal}
                disabled={readOnly}
                onClick={() => {
                  const prev = isGlobal
                  const next = !isGlobal
                  setIsGlobal(next)
                  saveField({ isGlobal: next }, () => setIsGlobal(prev))
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-default ${
                  isGlobal
                    ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                }`}
              >
                <Globe className={`mt-0.5 h-4 w-4 shrink-0 ${isGlobal ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-800 dark:text-slate-200">{t('tickets.global')}</span>
                  <span className="mt-0.5 block text-2xs leading-snug text-slate-500 dark:text-slate-400">{t('tickets.globalHint')}</span>
                </span>
                <span
                  aria-hidden
                  className={`relative mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    isGlobal ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${isGlobal ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </span>
              </button>
            </div>
          </aside>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('tickets.deleteTitle')}
        message={t('tickets.deleteConfirm', { title: ticket.title })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
        variant="danger"
      />
    </>
  )
}
