import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Ticket as TicketIcon, Plus, Trash2, Flag, Users, X, Globe, Tag, Archive, ArchiveRestore,
  Columns3, Link2, MoreHorizontal, ArrowRight, Search,
} from 'lucide-react'
import { ticketsApi, ticketCategoriesApi } from '@/api/client'
import type { Ticket, TicketStatus, TicketPriority, TeamMember, TicketCategory, Team } from '@/types'
import { useStore } from '@/store'
import { useAuthStore } from '@/store/auth'
import { toast, errorMessage } from '@/store/toast'
import { getMemberDisplayNames } from '@/utils/members'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import Chip from '@/components/ui/Chip'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Select from '@/components/ui/Select'
import SearchInput from '@/components/ui/SearchInput'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import DropdownMenu, { type DropdownItem } from '@/components/ui/DropdownMenu'
import { usePagePermission } from '@/hooks/usePagePermission'
import TicketDetailModal from '@/components/tickets/TicketDetailModal'
import {
  TICKET_STATUSES, TICKET_PRIORITIES, TICKET_STATUS_META, TICKET_PRIORITY_META,
} from '@/components/tickets/ticketMeta'

type BoardView = 'board' | 'archive'
type TFn = (key: string, opts?: Record<string, unknown>) => string

const CREATE_FORM_ID = 'create-ticket-form'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { t }      = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('tickets')
  const members    = useStore((s) => s.members)
  const allMembers = useStore((s) => s.allMembers)
  const teams      = useAuthStore((s) => s.teams)

  const [tickets,      setTickets]      = useState<Ticket[]>([])
  const [categories,   setCategories]   = useState<TicketCategory[]>([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Ticket | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Filters
  const [search,         setSearch]         = useState('')
  const [filterPriority, setFilterPriority] = useState<TicketPriority | 'all'>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  // Create form
  const [newTitle,      setNewTitle]      = useState('')
  const [newPriority,   setNewPriority]   = useState<TicketPriority>('medium')
  const [newIsGlobal,   setNewIsGlobal]   = useState(false)
  const [newCategoryId, setNewCategoryId] = useState<string>('')
  const [creating,      setCreating]      = useState(false)

  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOver,   setDragOver]   = useState<TicketStatus | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setTickets(await ticketsApi.list(showArchived)) }
    catch (err) { toast.error(t('common.loadError'), { description: errorMessage(err) }) }
    finally { setLoading(false) }
  }, [showArchived, t])

  const loadCategories = useCallback(async () => {
    try { setCategories(await ticketCategoriesApi.list()) }
    catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadCategories() }, [loadCategories])

  // Keyboard shortcut: N opens the create dialog
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (
        canWrite && !showArchived &&
        e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement) &&
        !(el instanceof HTMLSelectElement) && !el?.isContentEditable &&
        !document.querySelector('[role="dialog"]')
      ) {
        e.preventDefault()
        setShowCreate(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canWrite, showArchived])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets
      .filter((tk) => !q || tk.title.toLowerCase().includes(q) || (tk.description ?? '').toLowerCase().includes(q))
      .filter((tk) => filterPriority === 'all' || tk.priority === filterPriority)
      .filter((tk) => filterAssignee === 'all' || tk.assigneeIds?.includes(filterAssignee))
      .filter((tk) => filterCategory === 'all' || tk.categoryId === filterCategory)
  }, [tickets, search, filterPriority, filterAssignee, filterCategory])

  const priorityCounts = useMemo(() => {
    const c: Record<TicketPriority, number> = { low: 0, medium: 0, high: 0 }
    for (const tk of tickets) c[tk.priority]++
    return c
  }, [tickets])

  function resetCreateForm() {
    setNewTitle('')
    setNewPriority('medium')
    setNewIsGlobal(false)
    setNewCategoryId('')
  }

  function closeCreate() {
    if (creating) return
    setShowCreate(false)
    resetCreateForm()
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault()
    if (!newTitle.trim() || creating) return
    setCreating(true)
    try {
      const ticket = await ticketsApi.create({
        title:      newTitle.trim(),
        priority:   newPriority,
        isGlobal:   newIsGlobal,
        categoryId: newCategoryId || null,
      })
      setTickets((prev) => [...prev, ticket])
      resetCreateForm()
      setShowCreate(false)
      toast.success(t('tickets.toast.created'), {
        description: ticket.title,
        action: { label: t('common.open'), onClick: () => setDetailTicket(ticket) },
      })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally { setCreating(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await ticketsApi.delete(target.id)
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
    setTickets((prev) => prev.filter((tk) => tk.id !== target.id))
    if (detailTicket?.id === target.id) setDetailTicket(null)
    setDeleteTarget(null)
    toast.success(t('tickets.toast.deleted'))
  }

  async function handleArchive() {
    if (!archiveTarget) return
    const target = archiveTarget
    let updated: Ticket
    try {
      updated = await ticketsApi.update(target.id, { isArchived: true })
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
    setTickets((prev) => prev.filter((tk) => tk.id !== updated.id))
    if (detailTicket?.id === target.id) setDetailTicket(null)
    setArchiveTarget(null)
    toast.success(t('tickets.toast.archived'))
  }

  async function handleUnarchive(ticket: Ticket) {
    try {
      const updated = await ticketsApi.update(ticket.id, { isArchived: false })
      // In the archive view an un-archived ticket leaves the list
      setTickets((prev) => (showArchived ? prev.filter((tk) => tk.id !== ticket.id) : prev.map((tk) => (tk.id === ticket.id ? updated : tk))))
      if (detailTicket?.id === ticket.id) setDetailTicket(updated)
      toast.success(t('tickets.toast.restored'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  // Callbacks for the shared TicketDetailModal
  function handleTicketChange(updated: Ticket) {
    setTickets((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)))
    if (detailTicket?.id === updated.id) setDetailTicket(updated)
    // If a ticket got archived while showing the board, remove it from list
    if (!showArchived && updated.isArchived) {
      setTickets((prev) => prev.filter((tk) => tk.id !== updated.id))
    }
    // If in archived view and ticket was unarchived, remove from list
    if (showArchived && !updated.isArchived) {
      setTickets((prev) => prev.filter((tk) => tk.id !== updated.id))
    }
  }

  function handleTicketDelete(ticketId: string) {
    setTickets((prev) => prev.filter((tk) => tk.id !== ticketId))
    if (detailTicket?.id === ticketId) setDetailTicket(null)
  }

  /** Optimistically moves a ticket to another column */
  async function moveTicket(ticket: Ticket, next: TicketStatus) {
    if (ticket.status === next) return
    setTickets((prev) => prev.map((tk) => (tk.id === ticket.id ? { ...tk, status: next } : tk)))
    try {
      const updated = await ticketsApi.update(ticket.id, { status: next })
      handleTicketChange(updated)
    } catch (err) {
      setTickets((prev) => prev.map((tk) => (tk.id === ticket.id ? ticket : tk)))
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    }
  }

  function onColumnDrop(status: TicketStatus) {
    const tk = tickets.find((x) => x.id === draggingId)
    setDraggingId(null)
    setDragOver(null)
    if (tk) moveTicket(tk, status)
  }

  const hasFilters = search.trim() !== '' || filterPriority !== 'all' || filterAssignee !== 'all' || filterCategory !== 'all'
  function resetFilters() {
    setSearch('')
    setFilterPriority('all')
    setFilterAssignee('all')
    setFilterCategory('all')
  }

  const activeMembers = members.filter((m) => m.isActive)
  const view: BoardView = showArchived ? 'archive' : 'board'

  // ── Render helpers ──────────────────────────────────────────────────────────

  const noResults = (
    <div className="surface">
      <EmptyState
        icon={<Search />}
        title={t('tickets.emptyFiltered')}
        action={<Button variant="secondary" icon={<X />} onClick={resetFilters}>{t('common.resetFilters')}</Button>}
      />
    </div>
  )

  let content: React.ReactNode
  if (loading) {
    content = showArchived ? (
      <div className="surface divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 px-4 py-3.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TICKET_STATUSES.map((s, i) => (
          <div key={s} className={`space-y-2 rounded-xl bg-slate-100/70 p-2 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-900/40 dark:ring-slate-800 ${i > 0 ? 'hidden md:block' : ''}`}>
            <Skeleton className="m-1 h-4 w-24" />
            {Array.from({ length: 3 - i }).map((_, j) => (
              <div key={j} className="surface space-y-2 p-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  } else if (showArchived) {
    content = filtered.length === 0 ? (
      hasFilters && tickets.length > 0 ? noResults : (
        <div className="surface">
          <EmptyState icon={<Archive />} title={t('tickets.emptyArchive')} description={t('tickets.emptyArchiveHint')} />
        </div>
      )
    ) : (
      <ul className="surface divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {filtered.map((ticket) => {
          const cat = ticket.categoryId ? categories.find((c) => c.id === ticket.categoryId) : null
          return (
            <li
              key={ticket.id}
              className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
              onClick={() => setDetailTicket(ticket)}
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDetailTicket(ticket) }}
                  className="block max-w-full truncate text-left text-sm font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                >
                  {ticket.title}
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={ticket.priority} t={t} />
                  {cat && <CategoryBadge category={cat} />}
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${TICKET_STATUS_META[ticket.status].dotCls}`} />
                    {t(`tickets.status.${ticket.status}`)}
                  </span>
                </div>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" icon={<ArchiveRestore />} onClick={() => handleUnarchive(ticket)}>
                    <span className="hidden sm:inline">{t('tickets.unarchive')}</span>
                  </Button>
                  <IconButton variant="danger" icon={<Trash2 />} label={t('tickets.deleteTitle')} onClick={() => setDeleteTarget(ticket)} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    )
  } else if (tickets.length === 0) {
    content = (
      <div className="surface">
        <EmptyState
          icon={<TicketIcon />}
          title={t('tickets.emptyAll')}
          description={t('tickets.emptyAllHint')}
          action={canWrite && (
            <Button variant="primary" icon={<Plus />} onClick={() => setShowCreate(true)}>{t('tickets.newTicket')}</Button>
          )}
        />
      </div>
    )
  } else if (filtered.length === 0) {
    content = noResults
  } else {
    content = (
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
        {TICKET_STATUSES.map((status) => {
          const col = filtered.filter((tk) => tk.status === status)
          const isOver = dragOver === status
          return (
            <section
              key={status}
              aria-label={t(`tickets.status.${status}`)}
              onDragOver={(e) => {
                if (!canWrite || !draggingId) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOver !== status) setDragOver(status)
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
              onDrop={(e) => { e.preventDefault(); if (canWrite) onColumnDrop(status) }}
              className={`flex w-[85%] max-w-sm shrink-0 snap-start flex-col rounded-xl ring-1 ring-inset transition-colors md:w-auto md:max-w-none ${
                isOver
                  ? 'bg-indigo-50/80 ring-2 ring-indigo-300 dark:bg-indigo-500/10 dark:ring-indigo-500/50'
                  : 'bg-slate-100/70 ring-slate-200/70 dark:bg-slate-900/40 dark:ring-slate-800'
              }`}
            >
              <header className="flex items-center gap-2 px-3.5 pb-2 pt-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TICKET_STATUS_META[status].dotCls}`} aria-hidden />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t(`tickets.status.${status}`)}</h2>
                <span className="min-w-[1.25rem] rounded-full bg-white px-1.5 py-px text-center text-2xs font-semibold tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                  {col.length}
                </span>
              </header>
              <div className="flex min-h-[8rem] flex-1 flex-col gap-2 px-2 pb-2">
                {col.length === 0 ? (
                  <div className={`flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-xs ${
                    isOver ? 'border-indigo-300 text-indigo-600 dark:border-indigo-500/50 dark:text-indigo-300' : 'border-slate-300/80 text-slate-400 dark:border-slate-700 dark:text-slate-500'
                  }`}>
                    {draggingId ? t('tickets.dropHere') : hasFilters ? t('tickets.emptyFiltered') : t('tickets.empty')}
                  </div>
                ) : col.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    members={ticket.isGlobal ? allMembers : members}
                    teams={teams}
                    categories={categories}
                    canWrite={canWrite}
                    isDragging={draggingId === ticket.id}
                    onDragStart={() => setDraggingId(ticket.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOver(null) }}
                    onOpen={() => setDetailTicket(ticket)}
                    onMove={(next) => moveTicket(ticket, next)}
                    onDelete={() => setDeleteTarget(ticket)}
                    onArchive={() => setArchiveTarget(ticket)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <Page size="full">
      <PageHeader
        icon={TicketIcon}
        title={t('tickets.title')}
        subtitle={t('tickets.subtitle')}
        actions={!showArchived && canWrite && (
          <Button variant="primary" icon={<Plus />} onClick={() => setShowCreate(true)} title={`${t('tickets.newTicket')} (N)`}>
            {t('tickets.newTicket')}
          </Button>
        )}
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              variant="segmented"
              size="sm"
              aria-label={t('tickets.viewLabel')}
              value={view}
              onChange={(v) => { setShowArchived(v === 'archive'); setDraggingId(null) }}
              items={[
                { value: 'board',   icon: Columns3, label: t('tickets.board') },
                { value: 'archive', icon: Archive,  label: t('tickets.archive') },
              ]}
            />
            <SearchInput
              size="sm"
              value={search}
              onChange={setSearch}
              placeholder={t('tickets.searchPlaceholder')}
              aria-label={t('common.search')}
              className="w-full sm:w-56"
            />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div role="group" aria-label={t('tickets.filterByPriority')} className="flex flex-wrap items-center gap-1.5">
              {TICKET_PRIORITIES.map((p) => (
                <Chip
                  key={p}
                  active={filterPriority === p}
                  dotColor={TICKET_PRIORITY_META[p].dot}
                  count={priorityCounts[p]}
                  onClick={() => setFilterPriority(filterPriority === p ? 'all' : p)}
                >
                  {t(`tickets.priority.${p}`)}
                </Chip>
              ))}
            </div>
            {categories.length > 0 && (
              <Select
                size="sm"
                icon={<Tag />}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                aria-label={t('tickets.filterByCategory')}
                wrapperClassName="min-w-[9rem] flex-1 sm:flex-none sm:w-44"
              >
                <option value="all">{t('tickets.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
            <Select
              size="sm"
              icon={<Users />}
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              aria-label={t('tickets.filterByAssignee')}
              wrapperClassName="min-w-[9rem] flex-1 sm:flex-none sm:w-44"
            >
              <option value="all">{t('tickets.allAssignees')}</option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
            {hasFilters && (
              <Button size="xs" variant="ghost" icon={<X />} onClick={resetFilters}>
                {t('common.resetFilters')}
              </Button>
            )}
            <span className="ml-auto text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {t('tickets.resultCount', { shown: filtered.length, total: tickets.length })}
            </span>
          </div>
        </div>
      </PageHeader>

      {isReadOnly && <ReadOnlyBanner className="mb-5" />}

      {content}

      {/* Ticket detail modal (shared component) */}
      {detailTicket && (
        <TicketDetailModal
          key={detailTicket.id}
          ticket={detailTicket}
          members={members}
          allMembers={allMembers}
          categories={categories}
          onTicketChange={handleTicketChange}
          onTicketDelete={handleTicketDelete}
          onClose={() => setDetailTicket(null)}
          readOnly={!canWrite}
        />
      )}

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={closeCreate}
        title={t('tickets.newTicket')}
        icon={<TicketIcon />}
        size="md"
        dismissible={!newTitle}
        footer={
          <>
            <Button variant="secondary" onClick={closeCreate} disabled={creating}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form={CREATE_FORM_ID} loading={creating} disabled={!newTitle.trim()}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <form id={CREATE_FORM_ID} onSubmit={handleCreate} className="space-y-4">
          <Field label={t('tickets.titleLabel')} htmlFor="new-ticket-title" required>
            <input
              id="new-ticket-title"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('tickets.titlePlaceholder')}
              className="form-input"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('tickets.filterByPriority')} htmlFor="new-ticket-priority">
              <Select
                id="new-ticket-priority"
                icon={<Flag className={TICKET_PRIORITY_META[newPriority].flagCls} />}
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
                ))}
              </Select>
            </Field>
            {categories.length > 0 && (
              <Field label={t('tickets.filterByCategory')} htmlFor="new-ticket-category">
                <Select
                  id="new-ticket-category"
                  icon={<Tag />}
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="">{t('tickets.noCategory')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <label
            htmlFor="new-ticket-global"
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
              newIsGlobal
                ? 'border-indigo-200 bg-indigo-50/70 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
            }`}
          >
            <input
              id="new-ticket-global"
              type="checkbox"
              checked={newIsGlobal}
              onChange={(e) => setNewIsGlobal(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                <Globe className="h-3.5 w-3.5 text-indigo-500" />
                {t('tickets.globalLabel')}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('tickets.globalHint')}</span>
            </span>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('tickets.deleteTitle')}
        message={t('tickets.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title={t('tickets.archiveTitle')}
        message={t('tickets.archiveConfirm', { title: archiveTarget?.title ?? '' })}
        confirmLabel={t('tickets.archiveAction')}
        onConfirm={handleArchive}
        onClose={() => setArchiveTarget(null)}
        variant="warning"
      />
    </Page>
  )
}

// ─── Small badges ─────────────────────────────────────────────────────────────

function PriorityBadge({ priority, t }: { priority: TicketPriority; t: TFn }) {
  return (
    <Badge
      variant={TICKET_PRIORITY_META[priority].badge}
      icon={<Flag />}
      label={t(`tickets.priority.${priority}`)}
    />
  )
}

function CategoryBadge({ category }: { category: TicketCategory }) {
  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
      <span className="truncate">{category.name}</span>
    </span>
  )
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: Ticket
  members: TeamMember[]
  teams: Team[]
  categories: TicketCategory[]
  canWrite: boolean
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onOpen: () => void
  onMove: (next: TicketStatus) => void
  onDelete: () => void
  onArchive: () => void
  t: TFn
}

function TicketCard({
  ticket, members, teams, categories, canWrite, isDragging,
  onDragStart, onDragEnd, onOpen, onMove, onDelete, onArchive, t,
}: TicketCardProps) {
  const assignees  = members.filter((m) => ticket.assigneeIds?.includes(m.id))
  const assigneeDisplayNames = getMemberDisplayNames(assignees, teams)
  const category   = ticket.categoryId ? categories.find((c) => c.id === ticket.categoryId) : null

  const menuItems: DropdownItem[] = [
    { type: 'label', label: t('tickets.moveToLabel') },
    ...TICKET_STATUSES.filter((s) => s !== ticket.status).map<DropdownItem>((s) => ({
      label: t(`tickets.status.${s}`),
      icon: <ArrowRight />,
      onClick: () => onMove(s),
    })),
    { type: 'divider' },
    ...(ticket.status === 'done'
      ? [{ label: t('tickets.archiveAction'), icon: <Archive />, onClick: onArchive } as DropdownItem]
      : []),
    { label: t('common.delete'), icon: <Trash2 />, danger: true, onClick: onDelete },
  ]

  return (
    <article
      draggable={canWrite}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', ticket.id)
        setTimeout(onDragStart, 0)
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`group relative cursor-pointer rounded-lg border border-slate-200/80 bg-white p-3 shadow-card transition-[box-shadow,border-color,opacity,transform] hover:border-slate-300 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 ${
        isDragging ? 'rotate-1 opacity-40' : ''
      } ${canWrite ? 'active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
        >
          {ticket.title}
        </button>
        {canWrite && (
          <div
            className="-mr-1 -mt-1 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu
              width="w-52"
              trigger={(p) => <IconButton {...p} size="xs" icon={<MoreHorizontal />} label={t('common.moreActions')} />}
              items={menuItems}
            />
          </div>
        )}
      </div>

      {ticket.description && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2 dark:text-slate-400">{ticket.description}</p>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <PriorityBadge priority={ticket.priority} t={t} />
          {category && <CategoryBadge category={category} />}
          {ticket.isGlobal && (
            <span
              className="inline-flex items-center rounded-full bg-indigo-50 p-1 text-indigo-600 ring-1 ring-inset ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20"
              title={t('tickets.global')}
              aria-label={t('tickets.global')}
            >
              <Globe className="h-3 w-3" />
            </span>
          )}
          {ticket.topicIds?.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs tabular-nums text-slate-400 dark:text-slate-500" title={t('tickets.linkedTopics')}>
              <Link2 className="h-3 w-3" />
              {ticket.topicIds.length}
            </span>
          )}
        </div>
        {assignees.length > 0 && (
          <div className="flex shrink-0 items-center -space-x-0.5">
            {assignees.slice(0, 3).map((m) => (
              <span key={m.id} title={assigneeDisplayNames.get(m.id) ?? m.name} className="inline-flex">
                <Avatar name={m.name} color={m.avatarColor} size="xs" ring />
              </span>
            ))}
            {assignees.length > 3 && (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-900">
                +{assignees.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
