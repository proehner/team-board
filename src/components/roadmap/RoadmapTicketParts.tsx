import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Pencil, Trash2, Ticket, ChevronDown } from 'lucide-react'
import type { RoadmapTicket, RoadmapTicketType, RoadmapTicketArea, RoadmapPriority } from '@/types'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import { PriorityIndicator } from './RoadmapBadges'
import {
  TICKET_TYPES, TICKET_AREAS, ROADMAP_PRIORITIES,
  TICKET_TYPE_META, TICKET_AREA_META, PRIORITY_META,
} from './roadmapConfig'

export interface RoadmapTicketFormData {
  title: string
  description: string
  acceptanceCriteria: string
  type: RoadmapTicketType
  area: RoadmapTicketArea
  storyPoints?: number
  priority: RoadmapPriority
  assignedTeam?: string
  tags: string[]
}

// ─── Add / edit modal ─────────────────────────────────────────────────────────

interface TicketFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Existing ticket → edit mode; otherwise create mode */
  ticket?: RoadmapTicket
  teams: string[]
  onSubmit: (data: RoadmapTicketFormData) => Promise<void>
}

function initialForm(ticket?: RoadmapTicket) {
  return {
    title:              ticket?.title ?? '',
    description:        ticket?.description ?? '',
    acceptanceCriteria: ticket?.acceptanceCriteria ?? '',
    type:               ticket?.type ?? ('task' as RoadmapTicketType),
    area:               ticket?.area ?? ('frontend' as RoadmapTicketArea),
    storyPoints:        (ticket?.storyPoints ?? '') as number | '',
    priority:           ticket?.priority ?? ('medium' as RoadmapPriority),
    assignedTeam:       ticket?.assignedTeam ?? '',
    tags:               ticket?.tags.join(', ') ?? '',
  }
}

const TICKET_FORM_ID = 'roadmap-ticket-form'

export function TicketFormModal({ isOpen, onClose, ticket, teams, onSubmit }: TicketFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm]     = useState(() => initialForm(ticket))
  const [saving, setSaving] = useState(false)
  const isEdit = !!ticket

  // Reset the form each time the dialog opens
  useEffect(() => {
    if (isOpen) setForm(initialForm(ticket))
  }, [isOpen, ticket])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description,
        acceptanceCriteria: form.acceptanceCriteria,
        type: form.type,
        area: form.area,
        storyPoints: form.storyPoints === '' ? undefined : Number(form.storyPoints),
        priority: form.priority,
        assignedTeam: form.assignedTeam.trim() || undefined,
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      toast.success(isEdit ? t('roadmap.toast.ticketSaved') : t('roadmap.toast.ticketCreated'), { description: form.title.trim() })
      onClose()
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const id = (k: string) => `rt-${k}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose() }}
      title={isEdit ? t('roadmap.editTicket') : t('roadmap.addTicket')}
      icon={<Ticket />}
      size="lg"
      dismissible={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form={TICKET_FORM_ID} loading={saving} disabled={!form.title.trim()}>
            {isEdit ? t('common.save') : t('roadmap.addTicket')}
          </Button>
        </>
      }
    >
      <form id={TICKET_FORM_ID} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t('roadmap.ticketTitle')} htmlFor={id('title')} required className="sm:col-span-2">
          <input
            id={id('title')}
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('roadmap.ticketTitlePlaceholder')}
            className="form-input"
          />
        </Field>
        <Field label={t('roadmap.ticketType')} htmlFor={id('type')}>
          <Select id={id('type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RoadmapTicketType })}>
            {TICKET_TYPES.map((tp) => <option key={tp} value={tp}>{t(`roadmap.ticketTypes.${tp}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('roadmap.ticketArea')} htmlFor={id('area')}>
          <Select id={id('area')} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as RoadmapTicketArea })}>
            {TICKET_AREAS.map((a) => <option key={a} value={a}>{t(`roadmap.areas.${a}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('roadmap.priority')} htmlFor={id('priority')}>
          <Select id={id('priority')} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as RoadmapPriority })}>
            {ROADMAP_PRIORITIES.map((p) => <option key={p} value={p}>{t(`roadmap.priorityLabels.${p}`)}</option>)}
          </Select>
        </Field>
        <Field label={t('roadmap.storyPoints')} htmlFor={id('sp')} optional>
          <input
            id={id('sp')}
            type="number" min={0} max={100} inputMode="numeric"
            value={form.storyPoints}
            onChange={(e) => setForm({ ...form, storyPoints: e.target.value === '' ? '' : Number(e.target.value) })}
            className="form-input tabular-nums"
          />
        </Field>
        <Field label={t('roadmap.assignedTeam')} htmlFor={id('team')} optional className="sm:col-span-2">
          {teams.length > 0 ? (
            <Select id={id('team')} value={form.assignedTeam} onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}>
              <option value="">{t('common.none')}</option>
              {teams.map((tm) => <option key={tm} value={tm}>{tm}</option>)}
            </Select>
          ) : (
            <input
              id={id('team')}
              value={form.assignedTeam}
              onChange={(e) => setForm({ ...form, assignedTeam: e.target.value })}
              placeholder={t('roadmap.assignedTeamPlaceholder')}
              className="form-input"
            />
          )}
        </Field>
        <Field label={t('roadmap.description')} htmlFor={id('desc')} className="sm:col-span-2">
          <textarea
            id={id('desc')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            placeholder={t('roadmap.ticketDescPlaceholder')}
            className="form-textarea font-mono"
          />
        </Field>
        <Field label={t('roadmap.acceptanceCriteria')} htmlFor={id('ac')} className="sm:col-span-2">
          <textarea
            id={id('ac')}
            value={form.acceptanceCriteria}
            onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })}
            rows={4}
            placeholder={t('roadmap.acceptanceCriteriaPlaceholder')}
            className="form-textarea font-mono"
          />
        </Field>
        <Field label={t('roadmap.tags')} htmlFor={id('tags')} hint={t('roadmap.tagsSeparator')} className="sm:col-span-2">
          <input
            id={id('tags')}
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="frontend, authentication, v2"
            className="form-input"
          />
        </Field>
      </form>
    </Modal>
  )
}

// ─── Ticket row ───────────────────────────────────────────────────────────────

interface TicketRowProps {
  ticket: RoadmapTicket
  teams: string[]
  onUpdate: (data: Partial<RoadmapTicket>) => Promise<void>
  onDelete: () => Promise<void>
  canWrite?: boolean
}

export function TicketRow({ ticket, teams, onUpdate, onDelete, canWrite = true }: TicketRowProps) {
  const { t } = useTranslation()
  const [editing, setEditing]           = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [showAC, setShowAC]             = useState(false)

  function copyToClipboard() {
    const text = [
      `# ${ticket.title}`,
      `**Typ:** ${TICKET_TYPE_META[ticket.type].exportLabel}  |  **Bereich:** ${TICKET_AREA_META[ticket.area].exportLabel}  |  **Priorität:** ${PRIORITY_META[ticket.priority].exportLabel}${ticket.storyPoints ? `  |  **Story Points:** ${ticket.storyPoints}` : ''}${ticket.assignedTeam ? `  |  **Team:** ${ticket.assignedTeam}` : ''}`,
      '',
      ticket.description ? `## Beschreibung\n${ticket.description}` : '',
      ticket.acceptanceCriteria ? `## Akzeptanzkriterien\n${ticket.acceptanceCriteria}` : '',
      ticket.tags.length > 0 ? `**Tags:** ${ticket.tags.join(', ')}` : '',
    ].filter(Boolean).join('\n\n')
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success(t('common.copied'))
      })
      .catch((err) => toast.error(t('common.unknownError'), { description: errorMessage(err) }))
  }

  async function handleDelete() {
    try {
      await onDelete()
      toast.success(t('roadmap.toast.ticketDeleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const AreaIcon = TICKET_AREA_META[ticket.area].icon

  return (
    <div className="group px-4 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-5 dark:hover:bg-slate-800/30">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Badge variant={TICKET_TYPE_META[ticket.type].badge} label={t(`roadmap.ticketTypes.${ticket.type}`)} />
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <AreaIcon className="h-3 w-3" />
              {t(`roadmap.areas.${ticket.area}`)}
            </span>
            <PriorityIndicator priority={ticket.priority} />
            {ticket.storyPoints !== undefined && ticket.storyPoints !== null && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {ticket.storyPoints} SP
              </span>
            )}
            {ticket.assignedTeam && <Badge variant="indigo" label={ticket.assignedTeam} />}
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.title}</p>
          {ticket.description && (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 line-clamp-2 dark:text-slate-400">{ticket.description}</p>
          )}
          {ticket.acceptanceCriteria && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowAC((v) => !v)}
                aria-expanded={showAC}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAC ? 'rotate-180' : ''}`} />
                {showAC ? t('roadmap.hideAC') : t('roadmap.showAC')}
              </button>
              {showAC && (
                <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{ticket.acceptanceCriteria}</pre>
              )}
            </div>
          )}
          {ticket.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {ticket.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <IconButton
            icon={copied ? <Check className="!text-emerald-500" /> : <Copy />}
            label={t('roadmap.copyTicket')}
            onClick={copyToClipboard}
          />
          {canWrite && <IconButton icon={<Pencil />} label={t('common.edit')} onClick={() => setEditing(true)} />}
          {canWrite && <IconButton variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => setConfirmDelete(true)} />}
        </div>
      </div>

      {canWrite && (
        <>
          <TicketFormModal
            isOpen={editing}
            onClose={() => setEditing(false)}
            ticket={ticket}
            teams={teams}
            onSubmit={(data) => onUpdate(data)}
          />
          <ConfirmDialog
            isOpen={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDelete}
            title={t('roadmap.deleteTicketTitle')}
            message={t('roadmap.deleteTicketConfirm', { title: ticket.title })}
            confirmLabel={t('common.delete')}
          />
        </>
      )}
    </div>
  )
}
