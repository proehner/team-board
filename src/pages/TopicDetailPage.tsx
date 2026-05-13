import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, MessageSquare, Send, Trash2,
  Paperclip, Upload, Download, File, ImageIcon, Loader2, Users, X,
  Ticket as TicketIcon, Flag, Globe, Tag,
} from 'lucide-react'
import { useStore } from '@/store'
import { meetingsApi, topicAttachmentsApi, ticketsApi, ticketCategoriesApi } from '@/api/client'
import type { MeetingTopic, MeetingTopicStatus, TopicComment, TopicAttachment, Ticket, TicketPriority, TicketCategory } from '@/types'
import { useAuthStore } from '@/store/auth'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import MentionInput, { renderWithMentions } from '@/components/ui/MentionInput'
import TicketDetailModal from '@/components/tickets/TicketDetailModal'

const TOPIC_STATUS_CONFIG: Record<MeetingTopicStatus, { className: string }> = {
  todo:        { className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  in_progress: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  deferred:    { className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  fixed:       { className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  done:        { className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Attachments Panel ────────────────────────────────────────────────────────

function AttachmentsPanel({ topicId, onImageUpload }: {
  topicId: string
  onImageUpload: (file: File) => Promise<string>
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [attachments,   setAttachments]   = useState<TopicAttachment[]>([])
  const [loading,       setLoading]       = useState(true)
  const [uploading,     setUploading]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<TopicAttachment | null>(null)
  const [deletingId,    setDeletingId]    = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setAttachments(await topicAttachmentsApi.list(topicId)) }
    finally { setLoading(false) }
  }, [topicId])

  useEffect(() => { load() }, [load])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) await topicAttachmentsApi.upload(topicId, file)
      await load()
    } finally { setUploading(false) }
  }

  async function handleDelete(att: TopicAttachment) {
    setDeletingId(att.id)
    try {
      await topicAttachmentsApi.delete(topicId, att.id)
      setAttachments((prev) => prev.filter((a) => a.id !== att.id))
    } finally { setDeletingId(null); setConfirmDelete(null) }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Paperclip className="w-4 h-4" />
          {t('meetings.attachments.title')}
          {attachments.length > 0 && (
            <span className="text-xs font-normal text-slate-400">({attachments.length})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t('meetings.attachments.upload')}
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-4">{t('meetings.attachments.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => {
            const url   = topicAttachmentsApi.fileUrl(att.filename)
            const isImg = att.mimeType.startsWith('image/')
            return (
              <li key={att.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 group transition-colors">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  {isImg ? <ImageIcon className="w-4 h-4 text-violet-500" /> : <File className="w-4 h-4 text-slate-500" />}
                </div>
                {isImg && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={url} alt={att.originalName} className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-600" />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{att.originalName}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(att.size)} · {new Date(att.uploadedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={url}
                    download={att.originalName}
                    className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                    title={t('meetings.attachments.download')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(att)}
                    disabled={deletingId === att.id}
                    className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    {deletingId === att.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={t('meetings.attachments.deleteTitle')}
        message={t('meetings.attachments.deleteConfirm', { name: confirmDelete?.originalName ?? '' })}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        variant="danger"
      />
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

  const meeting = meetings.find((m) => m.id === meetingId)

  const [topic,       setTopic]       = useState<MeetingTopic | null>(null)
  const [comments,    setComments]    = useState<TopicComment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [newComment,  setNewComment]  = useState('')
  const [sending,     setSending]     = useState(false)
  const [confirmDeleteComment, setConfirmDeleteComment] = useState<TopicComment | null>(null)

  // Editing state
  const [editingDesc,      setEditingDesc]      = useState(false)
  const [descDraft,        setDescDraft]        = useState('')
  const [editingTitle,     setEditingTitle]     = useState(false)
  const [titleDraft,       setTitleDraft]       = useState('')
  const [editingAssignees, setEditingAssignees] = useState(false)
  const [assigneeDraft,    setAssigneeDraft]    = useState<string[]>([])

  // Categories & ticket modal
  const [categories,           setCategories]           = useState<TicketCategory[]>([])
  const [detailTicket,         setDetailTicket]         = useState<Ticket | null>(null)

  // Tickets
  const [linkedTickets,        setLinkedTickets]        = useState<Ticket[]>([])
  const [showCreateTicket,     setShowCreateTicket]     = useState(false)
  const [newTicketTitle,       setNewTicketTitle]       = useState('')
  const [newTicketDesc,        setNewTicketDesc]        = useState('')
  const [newTicketPriority,    setNewTicketPriority]    = useState<TicketPriority>('medium')
  const [newTicketAssigneeIds, setNewTicketAssigneeIds] = useState<string[]>([])
  const [newTicketCategoryId,  setNewTicketCategoryId]  = useState<string | null>(null)
  const [newTicketIsGlobal,    setNewTicketIsGlobal]    = useState(false)
  const [creatingTicket,       setCreatingTicket]       = useState(false)
  const [unlinkConfirm,        setUnlinkConfirm]        = useState<Ticket | null>(null)

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
    }).finally(() => setLoading(false))
  }, [meetingId, topicId])

  async function handleStatusChange(newStatus: MeetingTopicStatus) {
    if (!topic || !meetingId) return
    setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { status: newStatus }))
  }

  async function handleCreateTicket() {
    if (!newTicketTitle.trim() || !topicId) return
    setCreatingTicket(true)
    try {
      const ticket = await ticketsApi.create({
        title:       newTicketTitle.trim(),
        description: newTicketDesc.trim() || undefined,
        priority:    newTicketPriority,
        assigneeIds: newTicketAssigneeIds,
        categoryId:  newTicketCategoryId ?? undefined,
        isGlobal:    newTicketIsGlobal,
        topicId,
      })
      setLinkedTickets((prev) => [...prev, ticket])
      setNewTicketTitle('')
      setNewTicketDesc('')
      setNewTicketPriority('medium')
      setNewTicketAssigneeIds([])
      setNewTicketCategoryId(null)
      setNewTicketIsGlobal(false)
      setShowCreateTicket(false)
    } finally { setCreatingTicket(false) }
  }

  function handleTicketChange(updated: Ticket) {
    setLinkedTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    if (detailTicket?.id === updated.id) setDetailTicket(updated)
  }

  function handleTicketDelete(ticketId: string) {
    setLinkedTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setDetailTicket(null)
  }

  async function handleUnlinkTicket(ticket: Ticket) {
    if (!topicId) return
    await ticketsApi.unlink(ticket.id, topicId)
    setLinkedTickets((prev) => prev.filter((t) => t.id !== ticket.id))
    setUnlinkConfirm(null)
  }

  async function handleSaveDesc() {
    if (!topic || !meetingId) return
    setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { description: descDraft }))
    setEditingDesc(false)
  }

  async function handleSaveTitle() {
    if (!topic || !meetingId || !titleDraft.trim()) return
    setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { title: titleDraft.trim() }))
    setEditingTitle(false)
  }

  async function handleSaveAssignees() {
    if (!topic || !meetingId) return
    setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { assigneeIds: assigneeDraft }))
    setEditingAssignees(false)
  }

  function toggleAssignee(memberId: string) {
    setAssigneeDraft((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  async function handleSendComment() {
    if (!newComment.trim() || !meetingId || !topicId) return
    setSending(true)
    try {
      const comment = await meetingsApi.createComment(meetingId, topicId, newComment.trim(), user?.displayName ?? '')
      setComments((prev) => [...prev, comment])
      setNewComment('')
    } finally { setSending(false) }
  }

  async function handleDeleteComment(c: TopicComment) {
    if (!meetingId || !topicId) return
    await meetingsApi.deleteComment(meetingId, topicId, c.id)
    setComments((prev) => prev.filter((x) => x.id !== c.id))
    setConfirmDeleteComment(null)
  }

  // Image upload for markdown editor – uploads to topic attachments
  async function handleImageUpload(file: File): Promise<string> {
    const att = await topicAttachmentsApi.upload(topicId!, file)
    return att.filename
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">{t('meetings.loading')}</p>
      </div>
    )
  }

  if (!topic || !meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">{t('meetings.notFound')}</p>
      </div>
    )
  }

  const isDone    = topic.status === 'done'
  const pool      = meeting.isGlobal ? allMembers : members.filter((m) => m.isActive)
  const assignees = [...members, ...allMembers].filter(
    (m, i, arr) => topic.assigneeIds.includes(m.id) && arr.findIndex((x) => x.id === m.id) === i,
  )

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <button onClick={() => navigate('/meetings')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          {t('meetings.title')}
        </button>
        <span>/</span>
        <button onClick={() => navigate(`/meetings/${meetingId}`)} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          {meeting.title}
        </button>
        <span>/</span>
        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{topic.title}</span>
      </div>

      <button
        onClick={() => navigate(`/meetings/${meetingId}`)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {meeting.title}
      </button>

      {/* Topic card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        {/* Title row */}
        <div className="flex items-start gap-3">
          {/* Status dropdown */}
          <div className="shrink-0 mt-0.5">
            <select
              value={topic.status}
              onChange={(e) => handleStatusChange(e.target.value as MeetingTopicStatus)}
              className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-violet-500 ${TOPIC_STATUS_CONFIG[topic.status].className}`}
            >
              {(['todo', 'in_progress', 'deferred', 'fixed', 'done'] as MeetingTopicStatus[]).map((s) => (
                <option key={s} value={s}>{t(`meetings.status.${s}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  className="flex-1 px-2 py-1 text-base font-semibold bg-white dark:bg-slate-800 border border-violet-300 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button onClick={handleSaveTitle} className="px-3 py-1 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700">{t('common.save')}</button>
                <button onClick={() => setEditingTitle(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <h1 className={`text-base font-semibold leading-snug ${isDone ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {topic.title}
                </h1>
                {!isDone && (
                  <button
                    onClick={() => { setTitleDraft(topic.title); setEditingTitle(true) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    ✎
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Create ticket button */}
          <button
            onClick={() => setShowCreateTicket(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <TicketIcon className="w-3.5 h-3.5" />
            {t('meetings.createTicket')}
          </button>
        </div>

        {isDone && topic.closedAt && (
          <p className="text-xs text-slate-400 ml-0">
            {t('meetings.closedAt', { date: new Date(topic.closedAt).toLocaleDateString() })}
          </p>
        )}

        {/* Description – Markdown */}
        <div>
          {editingDesc ? (
            <div className="space-y-2">
              <MarkdownEditor
                value={descDraft}
                onChange={setDescDraft}
                placeholder={t('meetings.descriptionPlaceholder')}
                rows={6}
                onImageUpload={handleImageUpload}
              />
              <div className="flex gap-2">
                <button onClick={handleSaveDesc} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors">
                  {t('common.save')}
                </button>
                <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div
              className={!isDone ? 'cursor-text' : ''}
              onClick={() => { if (!isDone) { setDescDraft(topic.description); setEditingDesc(true) } }}
            >
              {topic.description ? (
                <MarkdownRenderer content={topic.description} />
              ) : (
                !isDone && (
                  <p className="text-sm text-slate-400 italic hover:text-slate-500 transition-colors">
                    {t('meetings.addDescription')}
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assignees */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('meetings.assignees')}
          </h2>
          {!editingAssignees && !isDone && (
            <button
              onClick={() => { setAssigneeDraft([...topic.assigneeIds]); setEditingAssignees(true) }}
              className="text-xs text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            >
              {t('common.edit')}
            </button>
          )}
        </div>

        {editingAssignees ? (
          <div className="space-y-3">
            {meeting.isGlobal ? (
              // Group by team when global meeting
              teams.length > 0
                ? teams.map((team) => {
                    const teamMembers = pool.filter((m) => m.teamId === team.id)
                    if (teamMembers.length === 0) return null
                    return (
                      <div key={team.id}>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{team.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {teamMembers.map((m) => {
                            const selected = assigneeDraft.includes(m.id)
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleAssignee(m.id)}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  selected
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                                  {m.name.charAt(0).toUpperCase()}
                                </span>
                                {m.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                : (
                  <div className="flex flex-wrap gap-2">
                    {pool.map((m) => {
                      const selected = assigneeDraft.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleAssignee(m.id)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selected
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                )
            ) : (
              <div className="flex flex-wrap gap-2">
                {pool.map((m) => {
                  const selected = assigneeDraft.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      {m.name}
                    </button>
                  )
                })}
              </div>
            )}
            {pool.length === 0 && (
              <p className="text-xs text-slate-400">{t('meetings.noMembers')}</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleSaveAssignees} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors">
                {t('common.save')}
              </button>
              <button onClick={() => setEditingAssignees(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : assignees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {assignees.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-full text-xs font-medium">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: m.avatarColor, color: '#fff' }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </span>
                {m.name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">{t('meetings.noAssignees')}</p>
        )}
      </div>

      {/* Attachments */}
      <AttachmentsPanel topicId={topic.id} onImageUpload={handleImageUpload} />

      {/* Linked Tickets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <TicketIcon className="w-4 h-4" />
            {t('meetings.linkedTickets')}
            {linkedTickets.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({linkedTickets.length})</span>
            )}
          </h2>
          <button
            onClick={() => setShowCreateTicket(true)}
            className="text-xs text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            + {t('meetings.createTicket')}
          </button>
        </div>
        {linkedTickets.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-3">{t('meetings.noLinkedTickets')}</p>
        ) : (
          <ul className="space-y-2">
            {linkedTickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 group transition-colors cursor-pointer"
                onClick={() => setDetailTicket(ticket)}
              >
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                  ticket.status === 'todo'        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                }`}>
                  {t(`tickets.status.${ticket.status}`)}
                </span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{ticket.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setUnlinkConfirm(ticket) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-600"
                  title={t('meetings.unlinkTicket')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TicketIcon className="w-4 h-4 text-indigo-500" />
                {t('meetings.createTicket')}
              </h2>
              <button
                onClick={() => { setShowCreateTicket(false); setNewTicketTitle('') }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('tickets.titleLabel')}</label>
              <input
                autoFocus
                value={newTicketTitle}
                onChange={(e) => setNewTicketTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowCreateTicket(false) }}
                placeholder={t('tickets.titlePlaceholder')}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{t('tickets.descriptionLabel')}</label>
              <textarea
                value={newTicketDesc}
                onChange={(e) => setNewTicketDesc(e.target.value)}
                placeholder={t('tickets.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Priority + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  {t('tickets.filterByPriority')}
                </label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                    <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
                  ))}
                </select>
              </div>
              {categories.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {t('tickets.filterByCategory')}
                  </label>
                  <select
                    value={newTicketCategoryId ?? ''}
                    onChange={(e) => setNewTicketCategoryId(e.target.value || null)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('tickets.noCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Assignees */}
            {pool.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {t('tickets.assigneesLabel')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {pool.map((m) => {
                    const selected = newTicketAssigneeIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setNewTicketAssigneeIds((prev) =>
                          prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id],
                        )}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </span>
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* isGlobal */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={newTicketIsGlobal}
                onChange={(e) => setNewTicketIsGlobal(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {t('tickets.globalLabel')}
                </span>
                <p className="text-xs text-slate-400 mt-0.5">{t('tickets.globalHint')}</p>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setShowCreateTicket(false)
                  setNewTicketTitle('')
                  setNewTicketDesc('')
                  setNewTicketPriority('medium')
                  setNewTicketAssigneeIds([])
                  setNewTicketCategoryId(null)
                  setNewTicketIsGlobal(false)
                }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={!newTicketTitle.trim() || creatingTicket}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creatingTicket ? '…' : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink confirm */}
      <ConfirmDialog
        isOpen={!!unlinkConfirm}
        title={t('meetings.unlinkTicket')}
        message={`"${unlinkConfirm?.title}" ${t('meetings.unlinkTicket')}?`}
        onConfirm={() => unlinkConfirm && handleUnlinkTicket(unlinkConfirm)}
        onClose={() => setUnlinkConfirm(null)}
        variant="danger"
      />

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <MessageSquare className="w-4 h-4" />
          {t('meetings.discussion')}
          <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t('meetings.noComments')}</p>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="group flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
                  style={{ backgroundColor: members.find((m) => m.name === c.authorName)?.avatarColor ?? '#6366f1' }}
                >
                  {(c.authorName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{c.authorName || t('meetings.anonymous')}</span>
                    <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{renderWithMentions(c.content, allMembers)}</p>
                </div>
                <button
                  onClick={() => setConfirmDeleteComment(c)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-start mt-1 p-1 text-slate-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* New comment */}
        <div className="flex gap-2 pt-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
            style={{ backgroundColor: members.find((m) => m.name === user?.displayName)?.avatarColor ?? '#6366f1' }}
          >
            {(user?.displayName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 flex gap-2">
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
              members={allMembers}
              rows={2}
              placeholder={t('meetings.commentPlaceholder')}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              className="self-end px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteComment}
        title={t('meetings.deleteCommentTitle')}
        message={t('meetings.deleteCommentConfirm')}
        onConfirm={() => confirmDeleteComment && handleDeleteComment(confirmDeleteComment)}
        onClose={() => setConfirmDeleteComment(null)}
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
    </div>
  )
}
