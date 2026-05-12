import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ticket as TicketIcon, Plus, Trash2, ChevronRight, ChevronLeft,
  Loader2, Flag, Users, X, Globe, Tag, Archive, ArchiveRestore,
} from 'lucide-react'
import { ticketsApi, ticketCategoriesApi } from '@/api/client'
import type { Ticket, TicketStatus, TicketPriority, TeamMember, TicketCategory } from '@/types'
import { useStore } from '@/store'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TicketDetailModal from '@/components/tickets/TicketDetailModal'
import { PRIORITY_BADGE } from '@/components/tickets/TicketDetailModal'

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS: { status: TicketStatus; headerCls: string }[] = [
  { status: 'todo',        headerCls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  { status: 'in_progress', headerCls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  { status: 'done',        headerCls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { t }      = useTranslation()
  const members    = useStore((s) => s.members)
  const allMembers = useStore((s) => s.allMembers)

  const [tickets,      setTickets]      = useState<Ticket[]>([])
  const [categories,   setCategories]   = useState<TicketCategory[]>([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Ticket | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Filters
  const [filterPriority, setFilterPriority] = useState<TicketPriority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Create form
  const [newTitle,      setNewTitle]      = useState('')
  const [newPriority,   setNewPriority]   = useState<TicketPriority>('medium')
  const [newIsGlobal,   setNewIsGlobal]   = useState(false)
  const [newCategoryId, setNewCategoryId] = useState<string>('')
  const [creating,      setCreating]      = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTickets(await ticketsApi.list(showArchived)) }
    finally { setLoading(false) }
  }, [showArchived])

  const loadCategories = useCallback(async () => {
    try { setCategories(await ticketCategoriesApi.list()) }
    catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCategories() }, [loadCategories])

  function applyFilters(list: Ticket[]) {
    return list
      .filter((t) => filterPriority === 'all' || t.priority === filterPriority)
      .filter((t) => filterAssignee === 'all' || t.assigneeIds?.includes(filterAssignee))
      .filter((t) => filterCategory === 'all' || t.categoryId === filterCategory)
  }

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const ticket = await ticketsApi.create({
        title:      newTitle.trim(),
        priority:   newPriority,
        isGlobal:   newIsGlobal,
        categoryId: newCategoryId || null,
      })
      setTickets((prev) => [...prev, ticket])
      setNewTitle('')
      setNewPriority('medium')
      setNewIsGlobal(false)
      setNewCategoryId('')
      setShowCreate(false)
    } finally { setCreating(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await ticketsApi.delete(deleteTarget.id)
    setTickets((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    if (detailTicket?.id === deleteTarget.id) setDetailTicket(null)
    setDeleteTarget(null)
  }

  async function handleArchive() {
    if (!archiveTarget) return
    const updated = await ticketsApi.update(archiveTarget.id, { isArchived: true })
    setTickets((prev) => prev.filter((t) => t.id !== updated.id))
    if (detailTicket?.id === archiveTarget.id) setDetailTicket(null)
    setArchiveTarget(null)
  }

  async function handleUnarchive(ticket: Ticket) {
    const updated = await ticketsApi.update(ticket.id, { isArchived: false })
    setTickets((prev) => prev.map((t) => (t.id === ticket.id ? updated : t)))
    if (detailTicket?.id === ticket.id) setDetailTicket(updated)
  }

  // Callbacks for the shared TicketDetailModal
  function handleTicketChange(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    if (detailTicket?.id === updated.id) setDetailTicket(updated)
    // If a ticket got archived while showing the archived view, remove it from list
    if (!showArchived && updated.isArchived) {
      setTickets((prev) => prev.filter((t) => t.id !== updated.id))
    }
    // If in archived view and ticket was unarchived, remove from list
    if (showArchived && !updated.isArchived) {
      setTickets((prev) => prev.filter((t) => t.id !== updated.id))
    }
  }

  function handleTicketDelete(ticketId: string) {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    if (detailTicket?.id === ticketId) setDetailTicket(null)
  }

  const filtered = applyFilters(tickets)
  const hasFilters = filterPriority !== 'all' || filterAssignee !== 'all' || filterCategory !== 'all'

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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              showArchived
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            {t('tickets.archive')}
          </button>
          {!showArchived && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('tickets.newTicket')}
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">{t('tickets.filterByCategory')}:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{t('tickets.filterAll')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

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
            onClick={() => { setFilterPriority('all'); setFilterAssignee('all'); setFilterCategory('all') }}
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

      {/* Board / Archive */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">{t('meetings.loading')}</span>
        </div>
      ) : showArchived ? (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">{t('tickets.emptyArchive')}</p>
          ) : (
            filtered.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center gap-3 shadow-sm cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                onClick={() => setDetailTicket(ticket)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{ticket.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${PRIORITY_BADGE[ticket.priority]}`}>
                      <Flag className="w-2.5 h-2.5" />
                      {t(`tickets.priority.${ticket.priority}`)}
                    </span>
                    {ticket.categoryId && (() => {
                      const cat = categories.find((c) => c.id === ticket.categoryId)
                      return cat ? (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                          {cat.name}
                        </span>
                      ) : null
                    })()}
                    <span className="text-xs text-slate-400">{t(`tickets.status.${ticket.status}`)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnarchive(ticket) }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors shrink-0"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  {t('tickets.unarchive')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(ticket) }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {COLUMNS.map(({ status, headerCls }) => {
            const col = filtered.filter((t) => t.status === status)
            return (
              <div key={status} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${headerCls}`}>
                  <span className="text-sm font-semibold">{t(`tickets.status.${status}`)}</span>
                  <span className="text-xs font-medium opacity-70 bg-white/40 dark:bg-black/20 px-2 py-0.5 rounded-full">{col.length}</span>
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
                      categories={categories}
                      onOpen={() => setDetailTicket(ticket)}
                      onMove={async (tk, dir) => {
                        const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
                        const i   = statuses.indexOf(tk.status)
                        const next = dir === 'forward' ? statuses[i + 1] : statuses[i - 1]
                        if (!next) return
                        const updated = await ticketsApi.update(tk.id, { status: next })
                        handleTicketChange(updated)
                      }}
                      onDelete={() => setDeleteTarget(ticket)}
                      onArchive={() => setArchiveTarget(ticket)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ticket detail modal (shared component) */}
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

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
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
              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('tickets.noCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
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
                onClick={() => { setShowCreate(false); setNewTitle(''); setNewIsGlobal(false); setNewCategoryId('') }}
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

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title={t('tickets.archiveTitle')}
        message={t('tickets.archiveConfirm', { title: archiveTarget?.title ?? '' })}
        onConfirm={handleArchive}
        onClose={() => setArchiveTarget(null)}
        variant="warning"
      />
    </div>
  )
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: Ticket
  members: TeamMember[]
  categories: TicketCategory[]
  onOpen: () => void
  onMove: (ticket: Ticket, dir: 'forward' | 'backward') => void
  onDelete: () => void
  onArchive: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function TicketCard({ ticket, members, categories, onOpen, onMove, onDelete, onArchive, t }: TicketCardProps) {
  const statuses: TicketStatus[] = ['todo', 'in_progress', 'done']
  const idx        = statuses.indexOf(ticket.status)
  const canBack    = idx > 0
  const canForward = idx < statuses.length - 1
  const assignees  = members.filter((m) => ticket.assigneeIds?.includes(m.id))
  const category   = ticket.categoryId ? categories.find((c) => c.id === ticket.categoryId) : null

  return (
    <div
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group cursor-pointer"
      onClick={onOpen}
    >
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">{ticket.title}</p>
      {ticket.description && (
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{ticket.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 ${PRIORITY_BADGE[ticket.priority]}`}>
          <Flag className="w-2.5 h-2.5" />
          {t(`tickets.priority.${ticket.priority}`)}
        </span>
        {category && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: category.color + '22', color: category.color }}>
            {category.name}
          </span>
        )}
        {ticket.isGlobal && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <Globe className="w-2.5 h-2.5" />
            {t('tickets.global')}
          </span>
        )}
        {ticket.topicIds?.length > 0 && (
          <span className="text-xs text-slate-400 flex items-center gap-0.5">🔗 {ticket.topicIds.length}</span>
        )}
        {assignees.length > 0 && (
          <div className="flex items-center -space-x-1 ml-auto">
            {assignees.slice(0, 4).map((m) => (
              <div key={m.id} title={m.name} className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: m.avatarColor }}>
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
      <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pt-0.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onMove(ticket, 'backward')} disabled={!canBack} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title={canBack ? t(`tickets.status.${statuses[idx - 1]}`) : ''}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove(ticket, 'forward')} disabled={!canForward} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title={canForward ? t(`tickets.status.${statuses[idx + 1]}`) : ''}>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          {ticket.status === 'done' && (
            <button onClick={onArchive} className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors" title={t('tickets.archiveTitle')}>
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
