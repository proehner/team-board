import { useState, useEffect, useId, useRef, type ComponentType } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Avatar from '@/components/ui/Avatar'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import DropdownMenu from '@/components/ui/DropdownMenu'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { formatDate, formatDateShort } from '@/utils/date'
import { localTodayISO } from '@/utils/sprint'
import {
  ChevronLeft, Plus, Trash2, ChevronUp, ChevronDown, Lock, Unlock, Pencil, Check, ExternalLink, Link2,
  ThumbsUp, TrendingUp, ListTodo, Calendar, Zap, Maximize2, UserRound, CalendarClock, MessageSquare, Mic,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RetroItemType, RetroItemStatus, RetroItem, TeamMember } from '@/types'

const STATUS_OPTIONS: RetroItemStatus[] = ['Offen', 'InBearbeitung', 'Erledigt', 'Extern']

const STATUS_VARIANTS: Record<RetroItemStatus, BadgeVariant> = {
  Offen: 'default',
  InBearbeitung: 'warning',
  Erledigt: 'success',
  Extern: 'info',
}

interface ColumnDef {
  type: RetroItemType
  label: string
  hint: string
  icon: ComponentType<{ className?: string }>
  iconCls: string
  barCls: string
  voteCls: string
}

/** Copies the deep link of an item (opens its dialog) to the clipboard. */
async function copyItemLink(itemId: string): Promise<void> {
  const hash = window.location.hash.split('?')[0]
  const url = `${window.location.origin}${window.location.pathname}${hash}?item=${itemId}`
  if (!navigator.clipboard) throw new Error('Clipboard API not available')
  await navigator.clipboard.writeText(url)
}

export default function RetroDetailPage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('retro')

  const COLUMNS: ColumnDef[] = [
    {
      type: 'GutGelaufen', label: t('retroDetail.wentWell'), hint: t('retro.howToWentWell'), icon: ThumbsUp,
      iconCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      barCls: 'bg-emerald-500 dark:bg-emerald-400', voteCls: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      type: 'Verbesserung', label: t('retroDetail.improvements'), hint: t('retro.howToImprovements'), icon: TrendingUp,
      iconCls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      barCls: 'bg-amber-500 dark:bg-amber-400', voteCls: 'text-amber-700 dark:text-amber-300',
    },
    {
      type: 'Aktionspunkt', label: t('retroDetail.actionItems'), hint: t('retro.howToActions'), icon: ListTodo,
      iconCls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
      barCls: 'bg-violet-500 dark:bg-violet-400', voteCls: 'text-violet-700 dark:text-violet-300',
    },
  ]

  const { retroId } = useParams<{ retroId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
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
  const [adding, setAdding] = useState<RetroItemType | null>(null)
  const [togglingFinal, setTogglingFinal] = useState(false)

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
      <Page>
        <PageHeader back={{ to: '/retro', label: t('retroDetail.allRetros') }} title={t('retro.title')} />
        <div className="surface">
          <EmptyState
            icon={<MessageSquare />}
            title={t('retroDetail.notFound')}
            action={<Button variant="secondary" icon={<ChevronLeft />} onClick={() => navigate('/retro')}>{t('common.back')}</Button>}
          />
        </div>
      </Page>
    )
  }

  const sprint = retro.sprintId ? sprints.find((s) => s.id === retro.sprintId) : null
  const facilitator = retro.facilitatorId ? members.find((m) => m.id === retro.facilitatorId) : null
  const locked = retro.isFinalized || !canWrite

  /** Runs an item mutation and reports errors via toast. */
  async function mutate(action: () => Promise<void>, successMessage?: string): Promise<boolean> {
    try {
      await action()
      if (successMessage) toast.success(successMessage)
      return true
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      return false
    }
  }

  async function handleAddItem(type: RetroItemType) {
    const text = (newTexts[type] ?? '').trim()
    if (!text || adding) return
    setAdding(type)
    const ok = await mutate(() => addRetroItem(retro!.id, type, text))
    if (ok) setNewTexts((prev) => ({ ...prev, [type]: '' }))
    setAdding(null)
  }

  async function toggleFinalized() {
    setTogglingFinal(true)
    const finalize = !retro!.isFinalized
    await mutate(
      () => updateRetrospective(retro!.id, { isFinalized: finalize }),
      finalize ? t('retroDetail.finalizedToast') : t('retroDetail.unlockedToast'),
    )
    setTogglingFinal(false)
  }

  const actionItems = retro.items.filter((i) => i.type === 'Aktionspunkt')
  const doneActions = actionItems.filter((i) => i.status === 'Erledigt').length

  return (
    <Page size="wide">
      <PageHeader
        back={{ to: '/retro', label: t('retroDetail.allRetros') }}
        title={retro.title}
        meta={retro.isFinalized && <Badge label={t('retroDetail.finalized')} variant="success" icon={<Lock />} />}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(retro.date)}
            </span>
            {sprint && (
              <Link to={`/sprints/${sprint.id}`} className="inline-flex items-center gap-1.5 rounded hover:text-indigo-600 dark:hover:text-indigo-400">
                <Zap className="h-3.5 w-3.5" />
                {sprint.name}
              </Link>
            )}
            {facilitator && (
              <span className="inline-flex items-center gap-1.5" title={t('retroDetail.facilitator')}>
                <Mic className="h-3.5 w-3.5" />
                <span className="sr-only">{t('retroDetail.facilitator')}:</span>
                {facilitator.name}
              </span>
            )}
            {actionItems.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <ListTodo className="h-3.5 w-3.5" />
                {t('retro.actionsDone', { done: doneActions, total: actionItems.length })}
              </span>
            )}
          </span>
        }
        actions={canWrite && (
          <Button
            variant={retro.isFinalized ? 'secondary' : 'primary'}
            icon={retro.isFinalized ? <Unlock /> : <Lock />}
            onClick={toggleFinalized}
            loading={togglingFinal}
          >
            {retro.isFinalized ? t('retroDetail.unlock') : t('retroDetail.finalize')}
          </Button>
        )}
      />

      <div className="space-y-5">
        {isReadOnly && <ReadOnlyBanner />}
        {retro.isFinalized && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('retroDetail.finalizedNotice')}</span>
          </div>
        )}

        {/* Board */}
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = retro.items
              .filter((i) => i.type === col.type)
              .sort((a, b) => b.votes - a.votes)
            const Icon = col.icon
            const inputId = `add-${col.type}`

            return (
              <section
                key={col.type}
                aria-labelledby={`col-${col.type}`}
                className="flex flex-col rounded-xl bg-slate-100/80 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-900/50 dark:ring-slate-800"
              >
                <div className={`h-1 rounded-t-xl ${col.barCls}`} aria-hidden />
                {/* Column header */}
                <header className="flex items-center gap-2.5 px-4 pb-2 pt-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${col.iconCls}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h2 id={`col-${col.type}`} className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{col.label}</h2>
                  <span className="min-w-[1.5rem] rounded-full bg-white px-2 py-0.5 text-center text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    {items.length}
                  </span>
                </header>

                {/* Items */}
                <div className="flex-1 space-y-2 px-3 py-2 scrollbar-thin lg:max-h-[min(640px,calc(100vh-18rem))] lg:overflow-y-auto">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      {col.hint}
                    </p>
                  ) : items.map((item) => (
                    <RetroItemCard
                      key={item.id}
                      item={item}
                      members={members}
                      locked={locked}
                      voteCls={col.voteCls}
                      onUpdate={(data) => mutate(() => updateRetroItem(retro.id, item.id, data))}
                      onDelete={() => setDeleteTarget(item.id)}
                      onVote={(delta) => mutate(() => voteRetroItem(retro.id, item.id, delta))}
                      onOpenDialog={() => openDialog(item.id)}
                    />
                  ))}
                </div>

                {/* Add item */}
                {!locked && (
                  <form
                    className="p-3 pt-1"
                    onSubmit={(e) => { e.preventDefault(); handleAddItem(col.type) }}
                  >
                    <label htmlFor={inputId} className="sr-only">{t('retroDetail.addTo', { column: col.label })}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        id={inputId}
                        type="text"
                        placeholder={t('retroDetail.addNewPlaceholder')}
                        value={newTexts[col.type] ?? ''}
                        onChange={(e) => setNewTexts((txt) => ({ ...txt, [col.type]: e.target.value }))}
                        disabled={adding === col.type}
                        className="form-input"
                      />
                      <IconButton
                        type="submit"
                        variant="primary"
                        size="md"
                        icon={<Plus />}
                        label={t('common.add')}
                        disabled={!(newTexts[col.type] ?? '').trim() || adding === col.type}
                        className="disabled:!bg-slate-300 dark:disabled:!bg-slate-700"
                      />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1 px-0.5 text-2xs text-slate-500 dark:text-slate-400">
                      <kbd className="kbd">Enter</kbd> {t('retroDetail.pressEnterShort')}
                    </p>
                  </form>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteRetroItem(retro.id, deleteTarget)
            toast.success(t('retroDetail.itemDeleted'))
          } catch (err) {
            toast.error(t('common.deleteError'), { description: errorMessage(err) })
            throw err
          }
        }}
        title={t('retroDetail.deleteItem')}
        message={t('retroDetail.deleteItemConfirm')}
        confirmLabel={t('common.delete')}
      />

      {dialogItem && (
        <RetroItemDialog
          item={dialogItem}
          retroTitle={retro.title}
          members={members}
          locked={locked}
          onUpdate={(data) => mutate(() => updateRetroItem(retro.id, dialogItem.id, data))}
          onClose={closeDialog}
        />
      )}
    </Page>
  )
}

// ─── Item card ────────────────────────────────────────────────────────────────

interface RetroItemCardProps {
  item: RetroItem
  members: TeamMember[]
  locked: boolean
  voteCls: string
  onUpdate: (data: Partial<RetroItem>) => void
  onDelete: () => void
  onVote: (delta: 1 | -1) => void
  onOpenDialog: () => void
}

function RetroItemCard({ item, members, locked, voteCls, onUpdate, onDelete, onVote, onOpenDialog }: RetroItemCardProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const isAction = item.type === 'Aktionspunkt'

  function startEdit() {
    if (locked) return
    setEditText(item.text)
    setEditing(true)
  }

  function saveEdit() {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) onUpdate({ text: trimmed })
    setEditing(false)
  }

  async function handleCopyLink() {
    try {
      await copyItemLink(item.id)
      toast.success(t('retroDetail.linkCopied'))
    } catch {
      // Fallback: open the dialog so the deep link is in the address bar
      onOpenDialog()
    }
  }

  return (
    <article className="group rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200/80 transition-shadow hover:shadow-card-hover dark:bg-slate-900 dark:ring-slate-800 dark:hover:ring-slate-700">
      {editing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
              if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) }
            }}
            rows={Math.min(6, Math.max(2, Math.ceil(editText.length / 40)))}
            aria-label={t('common.edit')}
            className="form-textarea form-sm text-sm"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            <Button size="xs" variant="primary" icon={<Check />} onClick={saveEdit} disabled={!editText.trim()}>{t('common.save')}</Button>
          </div>
        </div>
      ) : (
        <p
          className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200 ${locked ? '' : 'cursor-text'}`}
          onDoubleClick={startEdit}
          title={locked ? undefined : t('retroDetail.doubleClickToEdit')}
        >
          {item.text}
        </p>
      )}

      {isAction && !editing && (
        <ActionMeta item={item} members={members} locked={locked} onUpdate={onUpdate} onOpenDialog={onOpenDialog} />
      )}

      {!editing && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <VoteControl votes={item.votes} disabled={locked} accentCls={voteCls} onVote={onVote} />
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {isAction && (
              <>
                <IconButton size="xs" icon={<Maximize2 />} label={t('retroDetail.openDetails')} onClick={onOpenDialog} />
                <IconButton size="xs" icon={<Link2 />} label={t('retroDetail.copyLink')} onClick={handleCopyLink} />
              </>
            )}
            {!locked && (
              <>
                <IconButton size="xs" icon={<Pencil />} label={t('common.edit')} onClick={startEdit} />
                <IconButton size="xs" variant="danger" icon={<Trash2 />} label={t('retroDetail.deleteItem')} onClick={onDelete} />
              </>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function VoteControl({ votes, disabled, accentCls, onVote }: { votes: number; disabled: boolean; accentCls: string; onVote: (d: 1 | -1) => void }) {
  const { t } = useTranslation()
  const btn = 'flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200'
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800"
      title={t('retroDetail.votes', { count: votes })}
    >
      {!disabled && (
        <button type="button" className={btn} onClick={() => onVote(-1)} disabled={votes === 0} aria-label={t('retroDetail.voteDown')}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      <span
        className={`min-w-[1.25rem] px-1 text-center text-xs font-semibold tabular-nums ${votes > 0 ? accentCls : 'text-slate-400 dark:text-slate-500'}`}
        aria-label={t('retroDetail.votes', { count: votes })}
      >
        {votes}
      </span>
      {!disabled && (
        <button type="button" className={btn} onClick={() => onVote(1)} aria-label={t('retroDetail.voteUp')}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** Compact status / owner / due date / ticket row of an action item. Details are edited in the dialog. */
function ActionMeta({ item, members, locked, onUpdate, onOpenDialog }: {
  item: RetroItem
  members: TeamMember[]
  locked: boolean
  onUpdate: (data: Partial<RetroItem>) => void
  onOpenDialog: () => void
}) {
  const { t } = useTranslation()
  const assignee = members.find((m) => m.id === item.assigneeId)
  const overdue = !!item.dueDate && item.status !== 'Erledigt' && item.status !== 'Extern' && item.dueDate < localTodayISO()

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
      {locked ? (
        <Badge label={t(`retroItemStatus.${item.status}`)} variant={STATUS_VARIANTS[item.status]} dot />
      ) : (
        <DropdownMenu
          align="start"
          width="w-48"
          items={STATUS_OPTIONS.map((s) => ({
            label: t(`retroItemStatus.${s}`),
            checked: s === item.status,
            onClick: () => { if (s !== item.status) onUpdate({ status: s }) },
          }))}
          trigger={(p) => (
            <button
              type="button"
              {...p}
              aria-label={`${t('retroDetail.status')}: ${t(`retroItemStatus.${item.status}`)}`}
              className="rounded-full transition-opacity hover:opacity-80"
            >
              <Badge
                label={<span className="inline-flex items-center gap-0.5">{t(`retroItemStatus.${item.status}`)}<ChevronDown className="!h-3 !w-3 opacity-60" /></span>}
                variant={STATUS_VARIANTS[item.status]}
                dot
              />
            </button>
          )}
        />
      )}

      <button
        type="button"
        onClick={onOpenDialog}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-xs text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        title={t('retroDetail.owner')}
      >
        {assignee ? (
          <>
            <Avatar name={assignee.name} color={assignee.avatarColor} size="2xs" />
            <span className="truncate">{assignee.name}</span>
          </>
        ) : (
          <>
            <UserRound className="h-4 w-4 text-slate-400" />
            <span className="text-slate-400 dark:text-slate-500">{t('retroDetail.noOwnerShort')}</span>
          </>
        )}
      </button>

      {item.dueDate && (
        <span
          className={`inline-flex items-center gap-1 text-xs tabular-nums ${overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}
          title={overdue ? t('retroDetail.overdue') : t('retroDetail.dueDate')}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDateShort(item.dueDate)}
        </span>
      )}

      {item.ticketUrl && (
        <a
          href={item.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={item.ticketUrl}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('retroDetail.ticket')}
        </a>
      )}
    </div>
  )
}

// ─── Item dialog ──────────────────────────────────────────────────────────────

interface RetroItemDialogProps {
  item: RetroItem
  retroTitle: string
  members: TeamMember[]
  locked: boolean
  onUpdate: (data: Partial<RetroItem>) => void
  onClose: () => void
}

function RetroItemDialog({ item, retroTitle, members, locked, onUpdate, onClose }: RetroItemDialogProps) {
  const { t } = useTranslation()
  const uid = useId()
  const [editText, setEditText] = useState(item.text)
  const [ticketUrl, setTicketUrl] = useState(item.ticketUrl ?? '')
  const textFocused = useRef(false)
  const ticketFocused = useRef(false)

  useEffect(() => {
    if (!textFocused.current) setEditText(item.text)
  }, [item.id, item.text])

  useEffect(() => {
    if (!ticketFocused.current) setTicketUrl(item.ticketUrl ?? '')
  }, [item.id, item.ticketUrl])

  function saveText() {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== item.text) onUpdate({ text: trimmed })
  }

  function saveTicket() {
    const value = ticketUrl.trim()
    if (value !== (item.ticketUrl ?? '')) onUpdate({ ticketUrl: value || null })
  }

  function handleClose() {
    // Persist pending edits (blur does not fire when the dialog unmounts)
    if (!locked) { saveText(); saveTicket() }
    onClose()
  }

  async function handleCopyLink() {
    try {
      await copyItemLink(item.id)
      toast.success(t('retroDetail.linkCopied'))
    } catch {
      toast.error(t('retroDetail.copyFailed'))
    }
  }

  const assignee = members.find((m) => m.id === item.assigneeId)
  const id = (name: string) => `${uid}-${name}`
  const readValue = 'flex min-h-[2.25rem] items-center text-sm text-slate-700 dark:text-slate-300'

  return (
    <Modal
      isOpen
      onClose={handleClose}
      icon={<ListTodo />}
      title={t('retroDetail.actionItemDetail')}
      description={retroTitle}
      size="md"
      footer={
        <>
          <Button variant="ghost" icon={<Link2 />} onClick={handleCopyLink} className="mr-auto">
            {t('retroDetail.copyLink')}
          </Button>
          <Button variant="secondary" onClick={handleClose}>{t('common.close')}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t('retroDetail.description')} htmlFor={id('text')}>
          {locked ? (
            <p id={id('text')} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-200">{item.text}</p>
          ) : (
            <textarea
              id={id('text')}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onFocus={() => { textFocused.current = true }}
              onBlur={() => { textFocused.current = false; saveText() }}
              rows={3}
              className="form-textarea"
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t('retroDetail.status')} htmlFor={id('status')}>
            {locked ? (
              <div className={readValue}><Badge label={t(`retroItemStatus.${item.status}`)} variant={STATUS_VARIANTS[item.status]} dot /></div>
            ) : (
              <Select id={id('status')} value={item.status} onChange={(e) => onUpdate({ status: e.target.value as RetroItemStatus })}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`retroItemStatus.${s}`)}</option>)}
              </Select>
            )}
          </Field>

          <Field label={t('retroDetail.owner')} htmlFor={id('owner')}>
            {locked ? (
              <div className={readValue}>
                {assignee ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />
                    {assignee.name}
                  </span>
                ) : (
                  <span className="text-slate-400">{t('retroDetail.noOwner')}</span>
                )}
              </div>
            ) : (
              <Select id={id('owner')} value={item.assigneeId ?? ''} onChange={(e) => onUpdate({ assigneeId: e.target.value || undefined })}>
                <option value="">{t('retroDetail.noOwner')}</option>
                {members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
          </Field>

          <Field label={t('retroDetail.dueDate')} htmlFor={id('due')}>
            {locked ? (
              <div className={readValue}>{item.dueDate ? formatDate(item.dueDate) : <span className="text-slate-400">—</span>}</div>
            ) : (
              <input
                id={id('due')}
                type="date"
                value={item.dueDate ?? ''}
                onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
                className="form-input"
              />
            )}
          </Field>

          <Field label={t('retroDetail.ticketUrl')} htmlFor={id('ticket')}>
            {locked ? (
              <div className={readValue}>
                {item.ticketUrl ? (
                  <a href={item.ticketUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.ticketUrl}</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  id={id('ticket')}
                  type="url"
                  inputMode="url"
                  placeholder={t('retroDetail.ticketUrlPlaceholder')}
                  value={ticketUrl}
                  onChange={(e) => setTicketUrl(e.target.value)}
                  onFocus={() => { ticketFocused.current = true }}
                  onBlur={() => { ticketFocused.current = false; saveTicket() }}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  className="form-input"
                />
                {item.ticketUrl && (
                  <a
                    href={item.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('retroDetail.openTicket')}
                    aria-label={t('retroDetail.openTicket')}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  )
}
