import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, CheckCircle2, Circle, MessageSquare, Send, Trash2,
  Paperclip, Upload, Download, File, ImageIcon, Loader2, Users, X,
} from 'lucide-react'
import { useStore } from '@/store'
import { meetingsApi, topicAttachmentsApi } from '@/api/client'
import type { MeetingTopic, TopicComment, TopicAttachment } from '@/types'
import { useAuthStore } from '@/store/auth'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

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
  const user          = useAuthStore((s) => s.user)

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

  useEffect(() => {
    if (!meetingId || !topicId) return
    setLoading(true)
    Promise.all([
      meetingsApi.getTopic(meetingId, topicId),
      meetingsApi.listComments(meetingId, topicId),
    ]).then(([tp, coms]) => {
      setTopic(tp)
      setComments(coms)
    }).finally(() => setLoading(false))
  }, [meetingId, topicId])

  async function handleToggleStatus() {
    if (!topic || !meetingId) return
    const newStatus = topic.status === 'open' ? 'closed' : 'open'
    setTopic(await meetingsApi.updateTopic(meetingId, topic.id, { status: newStatus }))
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

  const isClosed  = topic.status === 'closed'
  const activeMembers = members.filter((m) => m.isActive)
  const assignees = members.filter((m) => topic.assigneeIds.includes(m.id))

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
          <button
            onClick={handleToggleStatus}
            className="shrink-0 mt-0.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
            title={isClosed ? t('meetings.reopen') : t('meetings.close')}
          >
            {isClosed
              ? <CheckCircle2 className="w-6 h-6 text-green-500" />
              : <Circle className="w-6 h-6" />
            }
          </button>
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
                <h1 className={`text-base font-semibold leading-snug ${isClosed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {topic.title}
                </h1>
                {!isClosed && (
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
          <button
            onClick={handleToggleStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
              isClosed
                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {isClosed ? t('meetings.reopen') : t('meetings.close')}
          </button>
        </div>

        {isClosed && topic.closedAt && (
          <p className="text-xs text-slate-400 ml-9">
            {t('meetings.closedAt', { date: new Date(topic.closedAt).toLocaleDateString() })}
          </p>
        )}

        {/* Description – Markdown */}
        <div className="ml-9">
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
              className={!isClosed ? 'cursor-text' : ''}
              onClick={() => { if (!isClosed) { setDescDraft(topic.description); setEditingDesc(true) } }}
            >
              {topic.description ? (
                <MarkdownRenderer content={topic.description} />
              ) : (
                !isClosed && (
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
          {!editingAssignees && (
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
            <div className="flex flex-wrap gap-2">
              {activeMembers.map((m) => {
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
              {activeMembers.length === 0 && (
                <p className="text-xs text-slate-400">{t('meetings.noMembers')}</p>
              )}
            </div>
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
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">{c.content}</p>
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
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
              rows={2}
              placeholder={t('meetings.commentPlaceholder')}
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
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
    </div>
  )
}
