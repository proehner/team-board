import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ticket as TicketIcon, Plus, Trash2, ChevronRight, ChevronLeft,
  Loader2, Flag, Users, X, AlignLeft, Globe,
} from 'lucide-react'
import { ticketsApi } from '@/api/client'
import type { Ticket, TicketStatus, TicketPriority, TeamMember } from '@/types'
import { useStore } from '@/store'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { status: TicketStatus; headerCls: string }[] = [
  { status: 'todo',        headerCls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  { status: 'in_progress', headerCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { status: 'done',        headerCls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
]

const PRIORITY_FLAG: Record<TicketPriority, string> = {
  low:    'text-slate-300 dark:text-slate-600',
  medium: 'text-amber-400',
  high:   'text-red-500',
}

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  high:   'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { t }      = useTranslation()
  const members    = useStore((s) => s.members)
  const allMembers = useStore((s) => s.allMembers)

  const [tickets,      setTickets]      = useState<Ticket[]>([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)

  // Filters
  const [filterPriority, setFilterPriority] = useState<TicketPriority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // Create form
  const [newTitle,    setNewTitle]    = useState('')
  const [newPriority, setNewPriority] = useState<TicketPriority>('medium')
  const [newIsGlobal, setNewIsGlobal] = useState(false)
  const [creating,    setCreating]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTickets(await ticketsApi.list()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function applyFilters(list: Ticket[]) {
    return list
      .filter((t) => filterPriority === 'all' || t.priority === filterPriority)
      .filter((t) => filterAssignee === 'all' || t.assigneeIds?.includes(filterAssignee))
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const ticket = await ticketsApi.create({ title: newTitle.trim(), priority: newPriority, isGlobal: newIsGlobal })
      setTickets((prev) => [...prev, ticket])
      setNewTitle('')
      setNewPriority('medium')
      setNewIsGlobal(false)
      setShowCreate(false)
    } finally { setCreating(false) }
  }

  async function handleMove(ticket: Ticket, direction: 'forward' | 'backward') {
    const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
    const idx  = statuses.indexOf(ticket.status)
    const next = direction === 'forward' ? statuses[idx + 1] : statuses[idx - 1]
    if (!next) return
    const updated = await ticketsApi.update(ticket.id, { status: next })
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)))
    if (detailTicket?.id === ticket.id) setDetailTicket(updated)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await ticketsApi.delete(deleteTarget.id)
    setTickets((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    if (detailTicket?.id === deleteTarget.id) setDetailTicket(null)
    setDeleteTarget(null)
  }

  async function handleDetailSave(id: string, patch: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'assigneeIds' | 'isGlobal'>>) {
    const updated = await ticketsApi.update(id, patch)
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)))
    setDetailTicket(updated)
  }

  const filtered = applyFilters(tickets)
  const hasFilters = filterPriority !== 'all' || filterAssignee !== 'all'

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
            <TicketIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t('tickets.title')}</h1>
            <p className="text-sm text-slate-500">{t('tickets.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t('tickets.newTicket')}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Priority filter */}
        <div className="flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">{t('tickets.filterByPriority')}:</span>
          {(['all', 'low', 'medium', 'high'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                filterPriority === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p === 'all' ? t('tickets.filterAll') : t(`tickets.priority.${p}`)}
            </button>
          ))}
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">{t('tickets.filterByAssignee')}:</span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('tickets.filterAll')}</option>
            {members.filter((m) => m.isActive).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterPriority('all'); setFilterAssignee('all') }}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" />
            {t('common.all')}
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} / {tickets.length}
        </span>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t('meetings.loading')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map(({ status, headerCls }) => {
            const col = filtered.filter((t) => t.status === status)
            return (
              <div key={status} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${headerCls}`}>
                  <span className="text-sm font-semibold">{t(`tickets.status.${status}`)}</span>
                  <span className="text-xs font-medium opacity-70 bg-white/40 dark:bg-black/20 px-2 py-0.5 rounded-full">
                    {col.length}
                  </span>
                </div>

                <div className="flex-1 p-3 space-y-2 min-h-[120px]">
                  {col.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">
                      {hasFilters ? t('tickets.emptyFiltered') : t('tickets.empty')}
                    </p>
                  )}
                  {col.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      members={ticket.isGlobal ? allMembers : members}
                      onOpen={() => setDetailTicket(ticket)}
                      onMove={handleMove}
                      onDelete={() => setDeleteTarget(ticket)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ticket detail modal */}
      {detailTicket && (
        <TicketDetailModal
          ticket={detailTicket}
          members={members}
          allMembers={allMembers}
          onSave={handleDetailSave}
          onMove={handleMove}
          onDelete={() => { setDeleteTarget(detailTicket) }}
          onClose={() => setDetailTicket(null)}
          t={t}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TicketIcon className="w-4 h-4 text-indigo-500" />
              {t('tickets.newTicket')}
            </h2>
            <div className="space-y-3">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false) }}
                placeholder={t('tickets.titlePlaceholder')}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                  className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                    <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsGlobal}
                  onChange={(e) => setNewIsGlobal(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    {t('tickets.globalLabel')}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{t('tickets.globalHint')}</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewTitle(''); setNewIsGlobal(false) }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating ? '…' : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('tickets.deleteTitle')}
        message={t('tickets.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: Ticket
  members: TeamMember[]
  onOpen: () => void
  onMove: (ticket: Ticket, dir: 'forward' | 'backward') => void
  onDelete: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function TicketCard({ ticket, members, onOpen, onMove, onDelete, t }: TicketCardProps) {
  const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
  const idx        = statuses.indexOf(ticket.status)
  const canBack    = idx > 0
  const canForward = idx < statuses.length - 1
  const assignees  = members.filter((m) => ticket.assigneeIds?.includes(m.id))

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group cursor-pointer"
      onClick={onOpen}
    >
      {/* Title */}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
        {ticket.title}
      </p>

      {/* Description snippet */}
      {ticket.description && (
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {ticket.description}
        </p>
      )}

      {/* Meta row: priority badge + global badge + assignees */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${PRIORITY_BADGE[ticket.priority]}`}>
          <Flag className="w-2.5 h-2.5" />
          {t(`tickets.priority.${ticket.priority}`)}
        </span>

        {ticket.isGlobal && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" title={t('tickets.globalHint')}>
            <Globe className="w-2.5 h-2.5" />
            {t('tickets.global')}
          </span>
        )}

        {ticket.topicIds?.length > 0 && (
          <span className="text-xs text-slate-400 flex items-center gap-0.5">
            🔗 {ticket.topicIds.length}
          </span>
        )}

        {assignees.length > 0 && (
          <div className="flex items-center -space-x-1 ml-auto">
            {assignees.slice(0, 4).map((m) => (
              <div
                key={m.id}
                title={m.name}
                className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: m.avatarColor }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {assignees.length > 4 && (
              <div className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                +{assignees.length - 4}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action row (only on hover) */}
      <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pt-0.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onMove(ticket, 'backward')}
            disabled={!canBack}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            title={canBack ? t(`tickets.status.${statuses[idx - 1]}`) : ''}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMove(ticket, 'forward')}
            disabled={!canForward}
            className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            title={canForward ? t(`tickets.status.${statuses[idx + 1]}`) : ''}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={onDelete}
          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────

interface TicketDetailModalProps {
  ticket: Ticket
  members: TeamMember[]
  allMembers: TeamMember[]
  onSave: (id: string, patch: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'assigneeIds' | 'isGlobal'>>) => Promise<void>
  onMove: (ticket: Ticket, dir: 'forward' | 'backward') => void
  onDelete: () => void
  onClose: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function TicketDetailModal({ ticket, members, allMembers, onSave, onMove, onDelete, onClose, t }: TicketDetailModalProps) {
  const [title,       setTitle]       = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [status,      setStatus]      = useState<TicketStatus>(ticket.status)
  const [priority,    setPriority]    = useState<TicketPriority>(ticket.priority)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(ticket.assigneeIds ?? [])
  const [isGlobal,    setIsGlobal]    = useState(ticket.isGlobal)
  const [saving,      setSaving]      = useState(false)

  async function saveField(patch: Partial<Pick<Ticket, 'title' | 'description' | 'status' | 'priority' | 'assigneeIds' | 'isGlobal'>>) {
    setSaving(true)
    try { await onSave(ticket.id, patch) }
    finally { setSaving(false) }
  }

  function toggleAssignee(id: string) {
    const next = assigneeIds.includes(id)
      ? assigneeIds.filter((x) => x !== id)
      : [...assigneeIds, id]
    setAssigneeIds(next)
    saveField({ assigneeIds: next })
  }

  const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
  const idx        = statuses.indexOf(status)
  const canBack    = idx > 0
  const canForward = idx < statuses.length - 1

  const STATUS_MODAL: Record<TicketStatus, string> = {
    todo:        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    done:        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  }

  const memberPool    = isGlobal ? allMembers.filter((m) => m.isActive) : members.filter((m) => m.isActive)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <TicketIcon className="w-4 h-4 text-indigo-500 shrink-0" />
            {/* Status select */}
            <select
              value={status}
              onChange={(e) => {
                const next = e.target.value as TicketStatus
                setStatus(next)
                saveField({ status: next })
              }}
              className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${STATUS_MODAL[status]}`}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{t(`tickets.status.${s}`)}</option>
              ))}
            </select>
            {/* Move arrows */}
            <button
              onClick={() => { onMove(ticket, 'backward'); setStatus(statuses[idx - 1] ?? status) }}
              disabled={!canBack}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title={canBack ? t(`tickets.status.${statuses[idx - 1]}`) : ''}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { onMove(ticket, 'forward'); setStatus(statuses[idx + 1] ?? status) }}
              disabled={!canForward}
              className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              title={canForward ? t(`tickets.status.${statuses[idx + 1]}`) : ''}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            <button
              onClick={() => { onDelete(); onClose() }}
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

        <div className="px-5 pb-5 space-y-5">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== ticket.title && saveField({ title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full text-base font-semibold text-slate-800 dark:text-slate-100 bg-transparent border-0 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-400 focus:outline-none py-0.5 transition-colors"
          />

          {/* Priority + global */}
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
                      {m.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Linked topics */}
          {ticket.topicIds?.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                🔗 {t('tickets.linkedTopics')}
              </label>
              <p className="text-xs text-slate-400">
                {ticket.topicIds.length} {t('tickets.linkedTopics').toLowerCase()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
