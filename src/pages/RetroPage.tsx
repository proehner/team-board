import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import Avatar from '@/components/ui/Avatar'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import { usePagePermission } from '@/hooks/usePagePermission'
import { formatDate, todayISO } from '@/utils/date'
import {
  Plus, MessageSquare, Trash2, ChevronRight, Lock, Calendar, Zap, ThumbsUp, TrendingUp, ListTodo, ListFilter,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Retrospective } from '@/types'

interface RetroFormData {
  title: string
  date: string
  sprintId: string
  facilitatorId: string
}

export default function RetroPage() {
  const { t } = useTranslation()
  const uid = useId()
  const { canWrite, isReadOnly } = usePagePermission('retro')
  const navigate = useNavigate()
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const retrospectives = useStore((s) => s.retrospectives)
  const addRetrospective = useStore((s) => s.addRetrospective)
  const deleteRetrospective = useStore((s) => s.deleteRetrospective)

  const [showModal, setShowModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Retrospective | null>(null)
  const [filterSprint, setFilterSprint] = useState('')
  const [form, setForm] = useState<RetroFormData>(defaultForm())
  const [saving, setSaving] = useState(false)

  function defaultForm(): RetroFormData {
    const activeSprint = sprints.find((s) => s.status === 'Aktiv')
    return {
      title: activeSprint ? `${activeSprint.name} Retrospektive` : 'Retrospektive',
      date: todayISO(),
      sprintId: activeSprint?.id ?? '',
      facilitatorId: '',
    }
  }

  function openCreate() {
    setForm(defaultForm())
    setShowModal(true)
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true)
    try {
      const id = await addRetrospective({
        title: form.title,
        date: form.date,
        sprintId: form.sprintId || undefined,
        facilitatorId: form.facilitatorId || undefined,
        isFinalized: false,
      })
      setShowModal(false)
      toast.success(t('retro.createdToast'))
      navigate(`/retro/${id}`)
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteRetrospective(deleteTarget.id)
      toast.success(t('retro.deletedToast', { title: deleteTarget.title }))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const sorted = [...retrospectives]
    .filter((r) => !filterSprint || r.sprintId === filterSprint)
    .sort((a, b) => b.date.localeCompare(a.date))

  const sprintOptions = [...sprints].sort((a, b) => b.startDate.localeCompare(a.startDate))
  const isFiltered = !!filterSprint
  const id = (name: string) => `${uid}-${name}`

  return (
    <Page>
      <PageHeader
        icon={MessageSquare}
        title={t('retro.title')}
        subtitle={t('retro.count', { count: retrospectives.length })}
        actions={canWrite && (
          <Button variant="primary" icon={<Plus />} onClick={openCreate}>
            {t('retro.newRetro')}
          </Button>
        )}
      >
        {retrospectives.length > 0 && sprints.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              size="sm"
              icon={<Zap />}
              value={filterSprint}
              onChange={(e) => setFilterSprint(e.target.value)}
              aria-label={t('retro.filterLabel')}
              wrapperClassName="w-full sm:w-56"
            >
              <option value="">{t('retro.allSprints')}</option>
              {sprintOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {isFiltered && (
              <>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {t('retro.resultCount', { count: sorted.length })}
                </span>
                <Button variant="ghost" size="xs" onClick={() => setFilterSprint('')}>{t('common.resetFilters')}</Button>
              </>
            )}
          </div>
        )}
      </PageHeader>

      {isReadOnly && <ReadOnlyBanner className="mb-6" />}

      {/* Retro list */}
      {retrospectives.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={<MessageSquare />}
            title={t('retro.noRetros')}
            description={t('retro.noRetrosSubtitle')}
            action={canWrite ? <Button variant="primary" icon={<Plus />} onClick={openCreate}>{t('retro.newRetro')}</Button> : undefined}
          />
          <RetroHowTo />
        </div>
      ) : sorted.length === 0 ? (
        <div className="surface">
          <EmptyState
            compact
            icon={<ListFilter />}
            title={t('retro.noRetrosForSprint')}
            action={<Button variant="secondary" size="sm" onClick={() => setFilterSprint('')}>{t('common.resetFilters')}</Button>}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((retro) => {
            const sprint = retro.sprintId ? sprints.find((s) => s.id === retro.sprintId) : null
            const facilitator = retro.facilitatorId ? members.find((m) => m.id === retro.facilitatorId) : null
            const wellCount = retro.items.filter((i) => i.type === 'GutGelaufen').length
            const improvCount = retro.items.filter((i) => i.type === 'Verbesserung').length
            const actionCount = retro.items.filter((i) => i.type === 'Aktionspunkt').length
            const doneActions = retro.items.filter((i) => i.type === 'Aktionspunkt' && i.status === 'Erledigt').length

            return (
              <article key={retro.id} className="surface-interactive group relative flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/retro/${retro.id}`}
                      className="rounded-sm font-semibold text-slate-900 transition-colors after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:text-indigo-700 dark:text-slate-100 dark:hover:text-indigo-300"
                    >
                      {retro.title}
                    </Link>
                    {retro.isFinalized && <Badge label={t('retroDetail.finalized')} variant="success" icon={<Lock />} />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      {formatDate(retro.date)}
                    </span>
                    {sprint && (
                      <span className="inline-flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        {sprint.name}
                      </span>
                    )}
                    {facilitator && (
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={facilitator.name} color={facilitator.avatarColor} size="2xs" />
                        {facilitator.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CountPill icon={<ThumbsUp />} tone="emerald" count={wellCount} label={t('retroDetail.wentWell')} />
                    <CountPill icon={<TrendingUp />} tone="amber" count={improvCount} label={t('retroDetail.improvements')} />
                    <CountPill
                      icon={<ListTodo />}
                      tone="violet"
                      count={actionCount}
                      label={t('retroDetail.actionItems')}
                      extra={actionCount > 0 ? <ActionProgress done={doneActions} total={actionCount} /> : undefined}
                    />
                  </div>
                </div>
                <div className="relative flex shrink-0 items-center gap-1">
                  {canWrite && (
                    <IconButton
                      variant="danger"
                      icon={<Trash2 />}
                      label={t('retro.deleteRetro')}
                      onClick={() => setDeleteTarget(retro)}
                      className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    />
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" aria-hidden />
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        dismissible={!saving}
        icon={<MessageSquare />}
        title={t('retro.newRetro')}
        description={t('retro.newRetroDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form={id('form')} loading={saving} disabled={!form.title.trim()}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <form id={id('form')} onSubmit={handleSubmit} className="space-y-5">
          <Field label={t('retro.titleLabel')} htmlFor={id('title')} required>
            <input
              id={id('title')}
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="form-input"
              autoFocus
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('retro.dateLabel')} htmlFor={id('date')}>
              <input
                id={id('date')}
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="form-input"
              />
            </Field>
            <Field label={t('retro.sprintLabel')} htmlFor={id('sprint')} optional>
              <Select id={id('sprint')} value={form.sprintId} onChange={(e) => setForm((f) => ({ ...f, sprintId: e.target.value }))}>
                <option value="">{t('pulse.noSprint')}</option>
                {sprintOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t('retro.facilitatorLabel')} htmlFor={id('facilitator')} optional>
            <Select id={id('facilitator')} value={form.facilitatorId} onChange={(e) => setForm((f) => ({ ...f, facilitatorId: e.target.value }))}>
              <option value="">{t('retro.noFacilitator')}</option>
              {members.filter((m) => m.isActive).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t('retro.deleteRetro')}
        message={t('retro.deleteConfirm')}
        confirmLabel={t('common.delete')}
      />
    </Page>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  amber:   'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  violet:  'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
} as const

function CountPill({ icon, tone, count, label, extra }: {
  icon: ReactNode
  tone: keyof typeof TONES
  count: number
  label: string
  extra?: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset [&_svg]:h-3.5 [&_svg]:w-3.5 ${
        count > 0 ? TONES[tone] : 'bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-700/60'
      }`}
    >
      {icon}
      <span className="tabular-nums font-semibold">{count}</span>
      <span>{label}</span>
      {extra}
    </span>
  )
}

function ActionProgress({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation()
  return (
    <span className="ml-0.5 inline-flex items-center gap-1.5 border-l border-violet-300/60 pl-2 dark:border-violet-400/30" title={t('retro.actionsDone', { done, total })}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-violet-200/70 dark:bg-violet-400/20">
        <span className="block h-full rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="tabular-nums">{done}/{total}</span>
    </span>
  )
}

/** Short explanation of the three board columns, shown below the empty state. */
function RetroHowTo() {
  const { t } = useTranslation()
  const steps = [
    { icon: <ThumbsUp />, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10', title: t('retroDetail.wentWell'), text: t('retro.howToWentWell') },
    { icon: <TrendingUp />, tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10', title: t('retroDetail.improvements'), text: t('retro.howToImprovements') },
    { icon: <ListTodo />, tone: 'text-violet-600 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10', title: t('retroDetail.actionItems'), text: t('retro.howToActions') },
  ]
  return (
    <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-800">
      {steps.map((s) => (
        <div key={s.title} className="flex items-start gap-3 bg-white p-5 first:rounded-bl-xl last:rounded-br-xl dark:bg-slate-900 max-sm:first:rounded-bl-none max-sm:last:rounded-b-xl">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4 ${s.tone}`}>{s.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{s.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
