import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ticket as TicketIcon, Globe, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Avatar from '@/components/ui/Avatar'
import type { TeamMember, TicketCategory, TicketPriority } from '@/types'
import { useAuthStore } from '@/store/auth'
import { getMemberDisplayNames } from '@/utils/members'

export interface NewTicketData {
  title: string
  description?: string
  priority: TicketPriority
  assigneeIds: string[]
  categoryId?: string
  isGlobal: boolean
}

interface CreateTicketModalProps {
  isOpen: boolean
  onClose: () => void
  pool: TeamMember[]
  categories: TicketCategory[]
  /** Optional context line (e.g. the topic title) */
  context?: string
  /** Persist; throw to keep the dialog open */
  onCreate: (data: NewTicketData) => Promise<void>
}

export default function CreateTicketModal({ isOpen, onClose, pool, categories, context, onCreate }: CreateTicketModalProps) {
  const { t } = useTranslation()
  const uid = useId()
  const formId = `${uid}-form`
  const teams = useAuthStore((s) => s.teams)
  const displayNames = getMemberDisplayNames(pool, teams)

  const [title, setTitle]             = useState('')
  const [desc, setDesc]               = useState('')
  const [priority, setPriority]       = useState<TicketPriority>('medium')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [categoryId, setCategoryId]   = useState<string | null>(null)
  const [isGlobal, setIsGlobal]       = useState(false)
  const [saving, setSaving]           = useState(false)

  // Fresh form every time the dialog opens
  useEffect(() => {
    if (!isOpen) return
    setTitle(''); setDesc(''); setPriority('medium'); setAssigneeIds([])
    setCategoryId(null); setIsGlobal(false); setSaving(false)
  }, [isOpen])

  const dirty = !!(title || desc || assigneeIds.length || categoryId || isGlobal || priority !== 'medium')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({
        title:       title.trim(),
        description: desc.trim() || undefined,
        priority,
        assigneeIds,
        categoryId:  categoryId ?? undefined,
        isGlobal,
      })
      onClose()
    } catch {
      // caller shows a toast
    } finally {
      setSaving(false)
    }
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!dirty}
      icon={<TicketIcon />}
      title={t('meetings.createTicket')}
      description={context}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button type="submit" form={formId} variant="primary" loading={saving} disabled={!title.trim()}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('tickets.titleLabel')} htmlFor={`${uid}-title`} required>
          <input
            id={`${uid}-title`}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('tickets.titlePlaceholder')}
            className="form-input"
          />
        </Field>

        <Field label={t('tickets.descriptionLabel')} htmlFor={`${uid}-desc`} optional>
          <textarea
            id={`${uid}-desc`}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('tickets.descriptionPlaceholder')}
            rows={3}
            className="form-textarea"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('tickets.filterByPriority')} htmlFor={`${uid}-prio`}>
            <Select id={`${uid}-prio`} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              {(['low', 'medium', 'high'] as TicketPriority[]).map((p) => (
                <option key={p} value={p}>{t(`tickets.priority.${p}`)}</option>
              ))}
            </Select>
          </Field>
          {categories.length > 0 && (
            <Field label={t('tickets.filterByCategory')} htmlFor={`${uid}-cat`}>
              <Select id={`${uid}-cat`} value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value || null)}>
                <option value="">{t('tickets.noCategory')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {pool.length > 0 && (
          <fieldset>
            <legend className="form-label">{t('tickets.assigneesLabel')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {pool.map((m) => {
                const selected = assigneeIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleAssignee(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                      selected
                        ? 'bg-indigo-50 text-indigo-700 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/40'
                        : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Avatar name={m.name} color={m.avatarColor} size="2xs" />
                    {displayNames.get(m.id) ?? m.name}
                    {selected && <Check className="h-3 w-3" />}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <label htmlFor={`${uid}-global`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
          <input
            id={`${uid}-global`}
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              {t('tickets.globalLabel')}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{t('tickets.globalHint')}</span>
          </span>
        </label>
      </form>
    </Modal>
  )
}
