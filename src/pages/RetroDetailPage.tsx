import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { formatDate } from '@/utils/date'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock, Unlock,
  Edit2, Check, X, ExternalLink, Link2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RetroItemType, RetroItemStatus, RetroItem, TeamMember } from '@/types'

const STATUS_OPTIONS: RetroItemStatus[] = ['Offen', 'InBearbeitung', 'Erledigt', 'Extern']

const STATUS_VARIANTS: Record<RetroItemStatus, 'default' | 'warning' | 'success' | 'info'> = {
  Offen: 'default',
  InBearbeitung: 'warning',
  Erledigt: 'success',
  Extern: 'info',
}

export default function RetroDetailPage() {
  const { t } = useTranslation()

  const COLUMNS: { type: RetroItemType; label: string; color: string; bg: string; border: string }[] = [
    { type: 'GutGelaufen',  label: t('retroDetail.wentWell'),    color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
    { type: 'Verbesserung', label: t('retroDetail.improvements'), color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
    { type: 'Aktionspunkt', label: t('retroDetail.actionItems'),  color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200'   },
  ]

  const { retroId } = useParams<{ retroId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const retrospectives = useStore((s) => s.retrospectives)
  const addRetroItem = useStore((s) => s.addRetroItem)
  const updateRetroItem = useStore((s) => s.updateRetroItem)
  const deleteRetroItem = useStore((s) => s.deleteRetroItem)
  const voteRetroItem = useStore((s) => s.voteRetroItem)
  const updateRetrospective = useStore((s) => s.updateRetrospective)

  const retro = retrospectives.find((r) => r.id === retroId)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newTexts, setNewTexts] = useState<Partial<Record<RetroItemType, string>>>({})

  const dialogItemId = searchParams.get('item')
  const dialogItem = retro?.items.find((i) => i.id === dialogItemId) ?? null

  function closeDialog() {
    setSearchParams((prev) => { prev.delete('item'); return prev }, { replace: true })
  }

  function openDialog(itemId: string) {
    setSearchParams((prev) => { prev.set('item', itemId); return prev }, { replace: true })
  }

  if (!retro) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-slate-500">{t('retroDetail.notFound')}</p>
        <Link to="/retro" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline mt-3">
          <ArrowLeft className="w-4 h-4" /> {t('common.back')}
        </Link>
      </div>
    )
  }

  const sprint = retro.sprintId ? sprints.find((s) => s.id === retro.sprintId) : null
  const facilitator = retro.facilitatorId ? members.find((m) => m.id === retro.facilitatorId) : null

  async function handleAddItem(type: RetroItemType) {
    const text = (newTexts[type] ?? '').trim()
    if (!text) return
    try {
      await addRetroItem(retro!.id, type, text)
      setNewTexts((t) => ({ ...t, [type]: '' }))
    } catch {
      alert(t('competencies.saveError'))
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Back */}
      <Link to="/retro" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('retroDetail.allRetros')}
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{retro.title}</h1>
              {retro.isFinalized && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> {t('retroDetail.finalized')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{formatDate(retro.date)}</span>
              {sprint && <Badge label={sprint.name} variant="info" />}
              {facilitator && (
                <div className="flex items-center gap-1.5">
                  <Avatar name={facilitator.name} color={facilitator.avatarColor} size="xs" />
                  <span>{facilitator.name}</span>
                </div>
              )}
            </div>
          </div>
          <Button
            variant={retro.isFinalized ? 'secondary' : 'primary'}
            size="sm"
            icon={retro.isFinalized ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            onClick={() => updateRetrospective(retro.id, { isFinalized: !retro.isFinalized })}
          >
            {retro.isFinalized ? t('retroDetail.unlock') : t('retroDetail.finalize')}
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid lg:grid-cols-3 gap-5">
        {COLUMNS.map((col) => {
          const items = retro.items
            .filter((i) => i.type === col.type)
            .sort((a, b) => b.votes - a.votes)

          return (
            <div key={col.type} className={`rounded-xl border ${col.border} ${col.bg} flex flex-col`}>
              {/* Column header */}
              <div className={`px-4 py-3 border-b ${col.border} flex items-center justify-between`}>
                <h2 className={`text-sm font-semibold ${col.color}`}>{col.label}</h2>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/70 ${col.color}`}>
                  {items.length}
                </span>
              </div>

              {/* Items */}
              <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[600px] scrollbar-thin">
                {items.map((item) => (
                  <RetroItemCard
                    key={item.id}
                    item={item}
                    members={members}
                    isFinalized={retro.isFinalized}
                    onUpdate={(data) => updateRetroItem(retro.id, item.id, data)}
                    onDelete={() => setDeleteTarget(item.id)}
                    onVote={(delta) => voteRetroItem(retro.id, item.id, delta)}
                    onOpenDialog={() => openDialog(item.id)}
                    colColor={col.color}
                  />
                ))}
              </div>

              {/* Add item */}
              {!retro.isFinalized && (
                <div className={`p-3 border-t ${col.border}`}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('retroDetail.addNewPlaceholder')}
                      value={newTexts[col.type] ?? ''}
                      onChange={(e) => setNewTexts((txt) => ({ ...txt, [col.type]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(col.type) }}
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                    <Button size="sm" variant="ghost" icon={<Plus className="w-4 h-4" />} onClick={() => handleAddItem(col.type)} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 ml-1">{t('retroDetail.pressEnter')}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteRetroItem(retro.id, deleteTarget) }}
        title={t('retroDetail.deleteItem')}
        message={t('retroDetail.deleteItemConfirm')}
        confirmLabel={t('common.delete')}
      />

      {dialogItem && (
        <RetroItemDialog
          item={dialogItem}
          members={members}
          isFinalized={retro.isFinalized}
          onUpdate={(data) => updateRetroItem(retro.id, dialogItem.id, data)}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

interface RetroItemCardProps {
  item: RetroItem
  members: TeamMember[]
  isFinalized: boolean
  onUpdate: (data: Partial<RetroItem>) => void
  onDelete: () => void
  onVote: (delta: 1 | -1) => void
  onOpenDialog: () => void
  colColor: string
}

function RetroItemCard({ item, members, isFinalized, onUpdate, onDelete, onVote, onOpenDialog, colColor }: RetroItemCardProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function saveEdit() {
    if (editText.trim()) onUpdate({ text: editText.trim() })
    setEditing(false)
  }

  function handleCopyLink() {
    const hash = window.location.hash.split('?')[0]
    const url = `${window.location.origin}${window.location.pathname}${hash}?item=${item.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
    onOpenDialog()
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-white dark:border-slate-800 shadow-sm p-3 space-y-2 hover:shadow transition-shadow">
      {/* Text */}
      {editing ? (
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
          <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p
          className="text-sm text-slate-800 dark:text-slate-200 leading-snug"
          onDoubleClick={() => { if (!isFinalized) { setEditText(item.text); setEditing(true) } }}
        >
          {item.text}
        </p>
      )}

      {/* Action item extras */}
      {item.type === 'Aktionspunkt' && (
        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <select
              value={item.status}
              onChange={(e) => onUpdate({ status: e.target.value as RetroItemStatus })}
              disabled={isFinalized}
              className="text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`retroItemStatus.${s}`)}</option>
              ))}
            </select>
            <Badge label={t(`retroItemStatus.${item.status}`)} variant={STATUS_VARIANTS[item.status]} />
          </div>
          <select
            value={item.assigneeId ?? ''}
            onChange={(e) => onUpdate({ assigneeId: e.target.value || undefined })}
            disabled={isFinalized}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">{t('retroDetail.noOwner')}</option>
            {members.filter((m) => m.isActive).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={item.dueDate ?? ''}
            onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
            disabled={isFinalized}
            className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="url"
              placeholder={t('retroDetail.ticketUrlPlaceholder')}
              value={item.ticketUrl ?? ''}
              onChange={(e) => onUpdate({ ticketUrl: e.target.value || null })}
              disabled={isFinalized}
              className="flex-1 text-xs border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            />
            {item.ticketUrl && (
              <a
                href={item.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
                title={t('retroDetail.openTicket')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Footer: votes + actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onVote(-1)}
            disabled={isFinalized || item.votes === 0}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className={`text-xs font-semibold w-4 text-center ${item.votes > 0 ? colColor : 'text-slate-400'}`}>
            {item.votes}
          </span>
          <button
            onClick={() => onVote(1)}
            disabled={isFinalized}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {item.type === 'Aktionspunkt' && (
            <button
              onClick={handleCopyLink}
              className={`p-1 rounded transition-colors ${copied ? 'text-green-500' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800'}`}
              title={t('retroDetail.copyLink')}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {!isFinalized && (
            <>
              <button
                onClick={() => { setEditText(item.text); setEditing(true) }}
                className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface RetroItemDialogProps {
  item: RetroItem
  members: TeamMember[]
  isFinalized: boolean
  onUpdate: (data: Partial<RetroItem>) => void
  onClose: () => void
}

function RetroItemDialog({ item, members, isFinalized, onUpdate, onClose }: RetroItemDialogProps) {
  const { t } = useTranslation()
  const [editText, setEditText] = useState(item.text)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setEditText(item.text)
  }, [item.id])

  function saveText() {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) onUpdate({ text: trimmed })
  }

  function handleCopyLink() {
    const hash = window.location.hash.split('?')[0]
    const url = `${window.location.origin}${window.location.pathname}${hash}?item=${item.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const assignee = members.find((m) => m.id === item.assigneeId)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('retroDetail.actionItemDetail')}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            onClick={handleCopyLink}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
              copied
                ? 'text-green-600 bg-green-50'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700'
            }`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copied ? t('retroDetail.linkCopied') : t('retroDetail.copyLink')}
          </button>
          <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Text */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            {t('retroDetail.actionItems')}
          </label>
          {isFinalized ? (
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">{item.text}</p>
          ) : (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={saveText}
              rows={3}
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-100 resize-none"
            />
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide w-24 shrink-0">
            {t('retroDetail.status')}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={item.status}
              onChange={(e) => onUpdate({ status: e.target.value as RetroItemStatus })}
              disabled={isFinalized}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{t(`retroItemStatus.${s}`)}</option>
              ))}
            </select>
            <Badge label={t(`retroItemStatus.${item.status}`)} variant={STATUS_VARIANTS[item.status]} />
          </div>
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide w-24 shrink-0">
            {t('retroDetail.owner')}
          </label>
          {isFinalized ? (
            assignee ? (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                {assignee.name}
              </div>
            ) : (
              <span className="text-sm text-slate-400">{t('retroDetail.noOwner')}</span>
            )
          ) : (
            <select
              value={item.assigneeId ?? ''}
              onChange={(e) => onUpdate({ assigneeId: e.target.value || undefined })}
              className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">{t('retroDetail.noOwner')}</option>
              {members.filter((m) => m.isActive).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide w-24 shrink-0">
            {t('retroDetail.dueDate')}
          </label>
          {isFinalized ? (
            <span className="text-sm text-slate-700 dark:text-slate-300">
              {item.dueDate ? formatDate(item.dueDate) : <span className="text-slate-400">—</span>}
            </span>
          ) : (
            <input
              type="date"
              value={item.dueDate ?? ''}
              onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
              className="text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
            />
          )}
        </div>

        {/* Ticket URL */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide w-24 shrink-0">
            {t('retroDetail.ticketUrl')}
          </label>
          <div className="flex-1 flex items-center gap-1.5">
            {isFinalized ? (
              item.ticketUrl ? (
                <a
                  href={item.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  {item.ticketUrl}
                </a>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )
            ) : (
              <>
                <input
                  type="url"
                  placeholder={t('retroDetail.ticketUrlPlaceholder')}
                  value={item.ticketUrl ?? ''}
                  onChange={(e) => onUpdate({ ticketUrl: e.target.value || null })}
                  className="flex-1 text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-900 dark:text-slate-300"
                />
                {item.ticketUrl && (
                  <a
                    href={item.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors shrink-0"
                    title={t('retroDetail.openTicket')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
