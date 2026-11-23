import { useState, useEffect, type ReactNode } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  Users, X, Ticket as TicketIcon, Pencil, FileText, Info, CheckCircle2, RotateCcw, Plus,
  CalendarClock, CalendarPlus, History, ArrowLeft, MessageSquare,
} from 'lucide-react'
import { usePagePermission } from '@/hooks/usePagePermission'
import { useStore } from '@/store'
import { meetingsApi, topicAttachmentsApi, ticketsApi, ticketCategoriesApi } from '@/api/client'
import type { MeetingTopic, MeetingTopicStatus, TopicComment, Ticket, TicketCategory, TicketStatus } from '@/types'
import { useAuthStore } from '@/store/auth'
import { getMemberDisplayNames } from '@/utils/members'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TicketDetailModal from '@/components/tickets/TicketDetailModal'
import { toast, errorMessage } from '@/store/toast'
import Panel from '@/components/knownErrors/Panel'
import AttachmentsCard from '@/components/knownErrors/AttachmentsCard'
import CommentThread from '@/components/knownErrors/CommentThread'
import { TopicStatusMenu } from '@/components/meetings/TopicStatus'
import CreateTicketModal, { type NewTicketData } from '@/components/meetings/CreateTicketModal'
import AssigneesModal from '@/components/meetings/AssigneesModal'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const TICKET_STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  todo:        'default',
  in_progress: 'info',
  done:        'success',
}

function MetaLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5 text-sm">
      <span className="mt-0.5 text-slate-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="w-[5.5rem] shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">{children}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicDetailPage() {
  const { t }         = useTranslation()
  const { meetingId, topicId } = useParams<{ meetingId: string; topicId: string }>()
  const navigate      = useNavigate()
  const meetings      = useStore((s) => s.meetings)
  const members       = useStore((s) => s.members)
  const allMembers    = useStore((s) => s.allMembers)
  const user          = useAuthStore((s) => s.user)
  const teams         = useAuthStore((s) => s.teams)

  const { canWrite, isReadOnly } = usePagePermission('meetings')

  const meeting = meetings.find((m) => m.id === meetingId)

  const [topic,       setTopic]       = useState<MeetingTopic | null>(null)
  const [comments,    setComments]    = useState<TopicComment[]>([])
  const [loading,     setLoading]     = useState(true)

  // Editing state
  const [editingDesc,   setEditingDesc]   = useState(false)
  const [descDraft,     setDescDraft]     = useState('')
  const [savingDesc,    setSavingDesc]    = useState(false)
  const [editingTitle,  setEditingTitle]  = useState(false)
  const [titleDraft,    setTitleDraft]    = useState('')
  const [assigneesOpen, setAssigneesOpen] = useState(false)
  const [attachRefresh, setAttachRefresh] = useState(0)

  // Categories & ticket modal
  const [categories,       setCategories]       = useState<TicketCategory[]>([])
  const [detailTicket,     setDetailTicket]     = useState<Ticket | null>(null)
  const [linkedTickets,    setLinkedTickets]    = useState<Ticket[]>([])
  const [showCreateTicket, setShowCreateTicket] = useState(false)
  const [unlinkConfirm,    setUnlinkConfirm]    = useState<Ticket | null>(null)

  useEffect(() => {
    if (!meetingId || !topicId) return
    setLoading(true)
    Promise.all([
      meetingsApi.getTopic(meetingId, topicId),
      meetingsApi.listComments(meetingId, topicId),
      ticketsApi.byTopic(topicId),
      ticketCategoriesApi.list(),
    ]).then(([tp, coms, tix, cats]) => {
      setTopic(tp)
      setComments(coms)
      setLinkedTickets(tix)
      setCategories(cats)
    }).catch(() => {
      // handled by the not-found state below
    }).finally(() => setLoading(false))
  }, [meetingId, topicId])

  async function handleStatusChange(newStatus: MeetingTopicStatus, silent = false) {
    if (!topic || !meetingId) return
    const previous = topic.status
    try {
      const updated = await meetingsApi.updateTopic(meetingId, topic.id, { status: newStatus })
      setTopic(updated)
      if (silent) return
      if (newStatus === 'done' || previous === 'done') {
        toast.success(newStatus === 'done' ? t('meetings.topicDone') : t('meetings.topicReopened'), {
          action: { label: t('meetings.undo'), onClick: () => handleStatusChange(previous, true) },
        })
      }
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function handleCreateTicket(data: NewTicketData) {
    if (!topicId) return
    try {
      const ticket = await ticketsApi.create({ ...data, topicId })
      setLinkedTickets((prev) => [...prev, ticket])
      toast.success(t('meetings.ticketCreated'), { description: ticket.title })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  function handleTicketChange(updated: Ticket) {
    setLinkedTickets((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    if (detailTicket?.id === updated.id) setDetailTicket(updated)
  }

  function handleTicketDelete(ticketId: string) {
    setLinkedTickets((prev) => prev.filter((x) => x.id !== ticketId))
    setDetailTicket(null)
  }

  async function handleUnlinkTicket(ticket: Ticket) {
    if (!topicId) return
    try {
      await ticketsApi.unlink(ticket.id, topicId)
      setLinkedTickets((prev) => prev.filter((x) => x.id !== ticket.id))
      toast.success(t('meetings.ticketUnlinked'), { description: ticket.title })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleSaveDesc() {
    if (!topic || !meetingId || savingDesc) return
    setSavingDesc(true)
    try {
      setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { description: descDraft }))
      setEditingDesc(false)
      toast.success(t('common.saved'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSavingDesc(false)
    }
  }

  async function handleSaveTitle() {
    if (!topic || !meetingId || !titleDraft.trim()) return
    try {
      setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { title: titleDraft.trim() }))
      setEditingTitle(false)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  async function handleSaveAssignees(ids: string[]) {
    if (!topic || !meetingId) return
    try {
      setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { assigneeIds: ids }))
      toast.success(t('common.saved'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  // Image upload for markdown editor – uploads to topic attachments
  async function handleImageUpload(file: File): Promise<string> {
    const att = await topicAttachmentsApi.upload(topicId!, file)
    setAttachRefresh((n) => n + 1)
    return att.filename
  }

  function startEditDesc() {
    if (!topic) return
    setDescDraft(topic.description)
    setEditingDesc(true)
  }

  // ─── Loading / not found ───────────────────────────────────────────────────
  if (loading) {
    return (
      <Page size="default">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="mb-8 h-5 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <div className="surface space-y-3 p-5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
            <div className="surface h-32" />
          </div>
          <div className="surface h-48" />
        </div>
      </Page>
    )
  }

  if (!topic || !meeting) {
    const back = meeting ? { to: `/meetings/${meeting.id}`, label: meeting.title } : { to: '/meetings', label: t('meetings.title') }
    return (
      <Page size="narrow">
        <PageHeader back={back} title={t('meetings.title')} />
        <div className="surface">
          <EmptyState
            icon={<CalendarClock />}
            title={t('meetings.notFound')}
            action={<Button variant="secondary" icon={<ArrowLeft />} onClick={() => navigate(back.to)}>{back.label}</Button>}
          />
        </div>
      </Page>
    )
  }

  const isDone    = topic.status === 'done'
  const canEdit   = canWrite && !isDone
  const pool      = meeting.isGlobal ? allMembers : members.filter((m) => m.isActive)
  const assignees = [...members, ...allMembers].filter(
    (m, i, arr) => topic.assigneeIds.includes(m.id) && arr.findIndex((x) => x.id === m.id) === i,
  )
  const assigneeDisplayNames = getMemberDisplayNames(assignees, teams)
  const fmt = (d: string) => format(new Date(d), 'dd.MM.yyyy')

  return (
    <Page size="default">
      <PageHeader
        back={{ to: `/meetings/${meeting.id}`, label: meeting.title }}
        documentTitle={topic.title}
        title={
          editingTitle ? (
            <span className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle() }
                  if (e.key === 'Escape') { e.stopPropagation(); setEditingTitle(false) }
                }}
                aria-label={t('meetings.editTitle')}
                className="form-input min-w-0 flex-1 text-base font-semibold sm:min-w-[24rem]"
              />
              <span className="flex gap-2">
                <Button variant="primary" onClick={handleSaveTitle} disabled={!titleDraft.trim()}>{t('common.save')}</Button>
                <Button variant="ghost" onClick={() => setEditingTitle(false)}>{t('common.cancel')}</Button>
              </span>
            </span>
          ) : (
            <span className={isDone ? 'text-slate-500 dark:text-slate-400' : ''}>{topic.title}</span>
          )
        }
        meta={
          !editingTitle && (
            <span className="inline-flex items-center gap-1">
              <TopicStatusMenu status={topic.status} disabled={!canWrite} onChange={(s) => handleStatusChange(s)} />
              {canEdit && (
                <IconButton
                  size="xs"
                  icon={<Pencil />}
                  label={t('meetings.editTitle')}
                  onClick={() => { setTitleDraft(topic.title); setEditingTitle(true) }}
                />
              )}
            </span>
          )
        }
        subtitle={
          isDone && topic.closedAt
            ? t('meetings.closedAt', { date: fmt(topic.closedAt) })
            : t('meetings.createdOn', { date: fmt(topic.createdAt) })
        }
        actions={
          canWrite && !editingTitle && (
            <>
              {isDone ? (
                <Button variant="secondary" icon={<RotateCcw />} onClick={() => handleStatusChange('todo')}>
                  {t('meetings.reopen')}
                </Button>
              ) : (
                <Button variant="secondary" icon={<CheckCircle2 className="text-emerald-500" />} onClick={() => handleStatusChange('done')}>
                  {t('meetings.markDone')}
                </Button>
              )}
              <Button variant="primary" icon={<TicketIcon />} onClick={() => setShowCreateTicket(true)}>
                {t('meetings.createTicket')}
              </Button>
            </>
          )
        }
      />

      {isReadOnly && <ReadOnlyBanner className="-mt-1 mb-6" />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── Main ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          <Panel
            title={t('meetings.descriptionTitle')}
            icon={<FileText />}
            action={
              canEdit && !editingDesc && topic.description && (
                <Button size="xs" variant="ghost" icon={<Pencil />} onClick={startEditDesc}>{t('common.edit')}</Button>
              )
            }
          >
            {editingDesc ? (
              <div className="space-y-3">
                <MarkdownEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  placeholder={t('meetings.descriptionPlaceholder')}
                  rows={8}
                  autoFocus
                  onImageUpload={handleImageUpload}
                  onSubmitShortcut={handleSaveDesc}
                />
                <div className="flex items-center justify-end gap-2">
                  <span className="mr-auto hidden text-xs text-slate-400 sm:inline">
                    <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd className="kbd">Enter</kbd> {t('knownErrors.toSave')}
                  </span>
                  <Button variant="ghost" onClick={() => setEditingDesc(false)} disabled={savingDesc}>{t('common.cancel')}</Button>
                  <Button variant="primary" onClick={handleSaveDesc} loading={savingDesc}>{t('common.save')}</Button>
                </div>
              </div>
            ) : topic.description ? (
              <MarkdownRenderer content={topic.description} />
            ) : canEdit ? (
              <button
                type="button"
                onClick={startEditDesc}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-5 text-left text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/5 dark:hover:text-indigo-300"
              >
                <Plus className="h-4 w-4" />
                {t('meetings.addDescription')}
              </button>
            ) : (
              <p className="text-sm italic text-slate-400 dark:text-slate-500">{t('meetings.noDescription')}</p>
            )}
          </Panel>

          <AttachmentsCard
            key={`att-${topic.id}`}
            ns="meetings.attachments"
            load={() => topicAttachmentsApi.list(topic.id)}
            upload={(file) => topicAttachmentsApi.upload(topic.id, file)}
            remove={(att) => topicAttachmentsApi.delete(topic.id, att.id)}
            fileUrl={topicAttachmentsApi.fileUrl}
            canWrite={canWrite}
            refreshKey={attachRefresh}
          />

          <CommentThread
            key={`com-${topic.id}`}
            comments={comments}
            canWrite={canWrite}
            onSend={async (content) => {
              const comment = await meetingsApi.createComment(meetingId!, topicId!, content, user?.displayName ?? '')
              setComments((prev) => [...prev, comment])
            }}
            onDelete={async (c) => {
              await meetingsApi.deleteComment(meetingId!, topicId!, c.id)
              setComments((prev) => prev.filter((x) => x.id !== c.id))
            }}
            labels={{
              title:         t('meetings.discussion'),
              empty:         t('meetings.noComments'),
              placeholder:   t('commentThread.placeholder'),
              anonymous:     t('meetings.anonymous'),
              deleteTitle:   t('meetings.deleteCommentTitle'),
              deleteConfirm: t('meetings.deleteCommentConfirm'),
            }}
          />
        </div>

        {/* ── Side panel ───────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Assignees */}
          <Panel
            title={t('meetings.assignees')}
            icon={<Users />}
            count={assignees.length}
            bodyClassName="p-4"
            action={canEdit && (
              <IconButton size="sm" icon={<Pencil />} label={t('meetings.editAssignees')} onClick={() => setAssigneesOpen(true)} />
            )}
          >
            {assignees.length > 0 ? (
              <ul className="space-y-2">
                {assignees.map((m) => (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <Avatar name={m.name} color={m.avatarColor} size="xs" />
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {assigneeDisplayNames.get(m.id) ?? m.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : canEdit ? (
              <button
                type="button"
                onClick={() => setAssigneesOpen(true)}
                className="flex w-full items-center gap-2 text-sm text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
              >
                <Plus className="h-4 w-4" />
                {t('meetings.addAssignees')}
              </button>
            ) : (
              <p className="text-sm italic text-slate-400 dark:text-slate-500">{t('meetings.noAssignees')}</p>
            )}
          </Panel>

          {/* Linked tickets */}
          <Panel
            title={t('meetings.linkedTickets')}
            icon={<TicketIcon />}
            count={linkedTickets.length}
            bodyClassName={linkedTickets.length > 0 ? 'p-1.5' : 'p-4'}
            action={canWrite && (
              <IconButton size="sm" icon={<Plus />} label={t('meetings.createTicket')} onClick={() => setShowCreateTicket(true)} />
            )}
          >
            {linkedTickets.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('meetings.noLinkedTickets')}</p>
            ) : (
              <ul>
                {linkedTickets.map((ticket) => (
                  <li key={ticket.id} className="group relative flex items-start gap-1 rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <button
                      type="button"
                      onClick={() => setDetailTicket(ticket)}
                      className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-lg px-2.5 py-2 text-left"
                    >
                      <span className="line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                        {ticket.title}
                      </span>
                      <Badge variant={TICKET_STATUS_VARIANT[ticket.status]} dot label={t(`tickets.status.${ticket.status}`)} />
                    </button>
                    {canWrite && (
                      <IconButton
                        size="xs"
                        variant="danger"
                        icon={<X />}
                        label={t('meetings.unlinkTicket')}
                        onClick={() => setUnlinkConfirm(ticket)}
                        className="mr-1.5 mt-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Details */}
          <Panel title={t('meetings.details')} icon={<Info />} bodyClassName="px-4 py-2.5">
            <MetaLine icon={<CalendarClock />} label={t('meetings.meeting')}>
              <Link to={`/meetings/${meeting.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                {meeting.title}
              </Link>
            </MetaLine>
            <MetaLine icon={<CalendarPlus />} label={t('meetings.created')}>
              <span className="tabular-nums">{fmt(topic.createdAt)}</span>
            </MetaLine>
            <MetaLine icon={<History />} label={t('meetings.updated')}>
              <span className="tabular-nums">{fmt(topic.updatedAt)}</span>
            </MetaLine>
            {isDone && topic.closedAt && (
              <MetaLine icon={<CheckCircle2 />} label={t('meetings.status.done')}>
                <span className="tabular-nums">{fmt(topic.closedAt)}</span>
              </MetaLine>
            )}
            <MetaLine icon={<MessageSquare />} label={t('meetings.discussion')}>
              <span className="tabular-nums">{comments.length}</span>
            </MetaLine>
          </Panel>
        </aside>
      </div>

      <CreateTicketModal
        isOpen={showCreateTicket}
        onClose={() => setShowCreateTicket(false)}
        pool={pool}
        categories={categories}
        context={topic.title}
        onCreate={handleCreateTicket}
      />

      <AssigneesModal
        isOpen={assigneesOpen}
        onClose={() => setAssigneesOpen(false)}
        pool={pool}
        teams={teams}
        groupByTeam={meeting.isGlobal}
        selected={topic.assigneeIds}
        onSave={handleSaveAssignees}
      />

      <ConfirmDialog
        isOpen={!!unlinkConfirm}
        title={t('meetings.unlinkTicket')}
        message={t('meetings.unlinkConfirm', { title: unlinkConfirm?.title ?? '' })}
        confirmLabel={t('meetings.unlink')}
        onConfirm={() => unlinkConfirm && handleUnlinkTicket(unlinkConfirm)}
        onClose={() => setUnlinkConfirm(null)}
        variant="danger"
      />

      {detailTicket && (
        <TicketDetailModal
          ticket={detailTicket}
          members={members}
          allMembers={allMembers}
          categories={categories}
          onTicketChange={handleTicketChange}
          onTicketDelete={handleTicketDelete}
          onClose={() => setDetailTicket(null)}
        />
      )}
    </Page>
  )
}
