import { useState, type FormEvent } from 'react'
import { useStore } from '@/store'
import Page from '@/components/ui/Page'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import DropdownMenu from '@/components/ui/DropdownMenu'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import ReadOnlyBanner from '@/components/ui/ReadOnlyBanner'
import Meter, { type MeterTone } from '@/components/dashboard/Meter'
import { usePagePermission } from '@/hooks/usePagePermission'
import { toast, errorMessage } from '@/store/toast'
import { formatDate } from '@/utils/date'
import {
  Plus, Activity, Lock, Trash2, Send, MoreHorizontal, CheckCircle2, CalendarDays, Users, Zap, X,
  Angry, Frown, Meh, Smile, Laugh, ShieldCheck, MessageSquareText,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PulseCheck } from '@/types'

const DEFAULT_QUESTIONS = [
  'Wie zufrieden bist du mit deiner aktuellen Arbeitslast?',
  'Wie gut fühlt sich die Teamkommunikation an?',
  'Wie motiviert bist du aktuell?',
]
const MAX_QUESTIONS = 5

const MOOD_ICONS = { 1: Angry, 2: Frown, 3: Meh, 4: Smile, 5: Laugh } as const

function scoreTone(avg: number): MeterTone {
  return avg >= 4 ? 'emerald' : avg >= 3 ? 'amber' : 'red'
}
const TONE_TEXT: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
}
const RATING_SELECTED: Record<number, string> = {
  1: 'bg-red-50 text-red-600 ring-red-400 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/70',
  2: 'bg-red-50 text-red-500 ring-red-300 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/50',
  3: 'bg-amber-50 text-amber-600 ring-amber-400 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/70',
  4: 'bg-emerald-50 text-emerald-600 ring-emerald-400 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/60',
  5: 'bg-emerald-50 text-emerald-700 ring-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/80',
}

function MoodIcon({ value, className = '' }: { value: number; className?: string }) {
  const Icon = MOOD_ICONS[Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5]
  return <Icon className={className} aria-hidden />
}

function averageOf(pc: PulseCheck): number | null {
  if (pc.responseCount === 0 || pc.averageRatings.length === 0) return null
  return pc.averageRatings.reduce((s, v) => s + v, 0) / pc.averageRatings.length
}

export default function PulsePage() {
  const { t } = useTranslation()
  const { canWrite, isReadOnly } = usePagePermission('pulse')
  const sprints = useStore((s) => s.sprints)
  const pulseChecks = useStore((s) => s.pulseChecks)
  const createPulse = useStore((s) => s.createPulse)
  const respondPulse = useStore((s) => s.respondPulse)
  const closePulse = useStore((s) => s.closePulse)
  const deletePulse = useStore((s) => s.deletePulse)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRespondModal, setShowRespondModal] = useState<PulseCheck | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PulseCheck | null>(null)
  const [closeTarget, setCloseTarget] = useState<PulseCheck | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newQuestions, setNewQuestions] = useState<string[]>(DEFAULT_QUESTIONS)
  const [newSprintId, setNewSprintId] = useState('')
  const [ratings, setRatings] = useState<number[]>([])
  const [creating, setCreating] = useState(false)
  const [responding, setResponding] = useState(false)
  const [votedIds, setVotedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pulse_voted_ids')
      return stored ? new Set<string>(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  function markVoted(id: string) {
    setVotedIds((prev) => {
      const next = new Set(prev).add(id)
      try { localStorage.setItem('pulse_voted_ids', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  function openCreate() {
    setNewTitle('Pulse Check')
    setNewQuestions([...DEFAULT_QUESTIONS])
    setNewSprintId(sprints.find((s) => s.status === 'Aktiv')?.id ?? '')
    setShowCreateModal(true)
  }

  const validQuestions = newQuestions.filter((q) => q.trim())
  const canCreate = !!newTitle.trim() && validQuestions.length > 0

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault()
    if (!canCreate || creating) return
    setCreating(true)
    try {
      await createPulse({ title: newTitle.trim(), questions: validQuestions, sprintId: newSprintId || undefined })
      setShowCreateModal(false)
      toast.success(t('pulse.created'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setCreating(false)
    }
  }

  function openRespond(pc: PulseCheck) {
    setRatings(new Array(pc.questions.length).fill(0))
    setShowRespondModal(pc)
  }

  const answeredCount = ratings.filter((r) => r > 0).length
  const allAnswered = ratings.length > 0 && answeredCount === ratings.length

  async function handleRespond() {
    if (!showRespondModal || !allAnswered || responding) return
    setResponding(true)
    try {
      await respondPulse(showRespondModal.id, ratings)
      markVoted(showRespondModal.id)
      setShowRespondModal(null)
      toast.success(t('pulse.thanks'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
    } finally {
      setResponding(false)
    }
  }

  async function handleClose() {
    if (!closeTarget) return
    try {
      await closePulse(closeTarget.id)
      toast.success(t('pulse.closedToast'))
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      throw err
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePulse(deleteTarget.id)
      toast.success(t('common.deleted'))
    } catch (err) {
      toast.error(t('common.deleteError'), { description: errorMessage(err) })
      throw err
    }
  }

  const open = pulseChecks.filter((p) => !p.closedAt)
  const closed = pulseChecks.filter((p) => !!p.closedAt)
  const totalResponses = pulseChecks.reduce((s, p) => s + p.responseCount, 0)
  const latestWithResults = [...pulseChecks]
    .filter((p) => averageOf(p) !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const latestAvg = latestWithResults ? averageOf(latestWithResults) : null

  const newCheckButton = (
    <Button variant="primary" icon={<Plus />} onClick={openCreate}>{t('pulse.newCheck')}</Button>
  )

  return (
    <Page>
      <PageHeader
        icon={Activity}
        title={t('pulse.title')}
        subtitle={t('pulse.subtitle')}
        actions={canWrite ? newCheckButton : undefined}
      />

      <div className="space-y-6">
        {isReadOnly && <ReadOnlyBanner />}

        {pulseChecks.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={<Activity />}
              title={t('pulse.noChecks')}
              description={t('pulse.noChecksSubtitle')}
              action={canWrite ? newCheckButton : undefined}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatCard icon={Activity} tone="emerald" label={t('pulse.statActive')} value={open.length} hint={t('pulse.statClosed', { count: closed.length })} />
              <StatCard icon={Users} tone="indigo" label={t('pulse.statResponses')} value={totalResponses} hint={t('pulse.statResponsesHint', { count: pulseChecks.length })} />
              <StatCard
                className="col-span-2 sm:col-span-1"
                icon={latestAvg !== null ? MOOD_ICONS[Math.min(5, Math.max(1, Math.round(latestAvg))) as 1 | 2 | 3 | 4 | 5] : Meh}
                tone={latestAvg === null ? 'slate' : latestAvg >= 4 ? 'emerald' : latestAvg >= 3 ? 'amber' : 'rose'}
                label={t('pulse.statMood')}
                value={latestAvg !== null ? <>{latestAvg.toFixed(1)}<span className="text-base font-medium text-slate-400 dark:text-slate-500"> / 5</span></> : '—'}
                hint={latestWithResults?.title}
              />
            </div>

            {open.length > 0 && (
              <section>
                <SectionHeader title={t('pulse.active')} count={open.length} />
                <div className="space-y-4">
                  {open.map((pc) => (
                    <PulseCard
                      key={pc.id}
                      pc={pc}
                      onRespond={() => openRespond(pc)}
                      onClose={canWrite ? () => setCloseTarget(pc) : undefined}
                      onDelete={canWrite ? () => setDeleteTarget(pc) : undefined}
                      hasVoted={votedIds.has(pc.id)}
                    />
                  ))}
                </div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <SectionHeader title={t('pulse.completed')} count={closed.length} />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {closed.map((pc) => (
                    <PulseCard key={pc.id} pc={pc} onDelete={canWrite ? () => setDeleteTarget(pc) : undefined} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* ── Create ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => !creating && setShowCreateModal(false)}
        title={t('pulse.newCheck')}
        description={t('pulse.createDescription')}
        icon={<Activity />}
        dismissible={!creating}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>{t('common.cancel')}</Button>
            <Button type="submit" form="pulse-create-form" variant="primary" loading={creating} disabled={!canCreate}>{t('common.create')}</Button>
          </>
        }
      >
        <form id="pulse-create-form" onSubmit={handleCreate} className="space-y-5">
          <Field label={t('pulse.titleLabel')} htmlFor="pulse-title" required>
            <input id="pulse-title" type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="form-input" autoFocus />
          </Field>
          <Field label={t('pulse.sprintOptional')} htmlFor="pulse-sprint">
            <Select id="pulse-sprint" value={newSprintId} onChange={(e) => setNewSprintId(e.target.value)}>
              <option value="">{t('pulse.noSprint')}</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <fieldset>
            <legend className="form-label flex w-full items-center justify-between">
              <span>{t('pulse.questionsLabel')}</span>
              <span className="text-xs font-normal tabular-nums text-slate-400">{newQuestions.length}/{MAX_QUESTIONS}</span>
            </legend>
            <ol className="space-y-2">
              {newQuestions.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{i + 1}</span>
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setNewQuestions((qs) => qs.map((x, j) => (j === i ? e.target.value : x)))}
                    className="form-input flex-1"
                    placeholder={t('pulse.questionLabel', { number: i + 1 })}
                    aria-label={t('pulse.questionLabel', { number: i + 1 })}
                  />
                  {newQuestions.length > 1 && (
                    <IconButton
                      icon={<X />}
                      label={t('pulse.removeQuestion', { number: i + 1 })}
                      variant="danger"
                      onClick={() => setNewQuestions((qs) => qs.filter((_, j) => j !== i))}
                    />
                  )}
                </li>
              ))}
            </ol>
            {newQuestions.length < MAX_QUESTIONS && (
              <Button variant="ghost" size="sm" icon={<Plus />} className="mt-2" onClick={() => setNewQuestions((qs) => [...qs, ''])}>
                {t('pulse.addQuestionLabel')}
              </Button>
            )}
          </fieldset>
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/50">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {t('pulse.anonymousNote')}
          </p>
        </form>
      </Modal>

      {/* ── Respond ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!showRespondModal}
        onClose={() => !responding && setShowRespondModal(null)}
        title={showRespondModal?.title ?? ''}
        description={
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {t('pulse.anonymousAnswerNote')}
          </span>
        }
        icon={<MessageSquareText />}
        dismissible={!responding}
        footer={
          <>
            <span className="mr-auto self-center text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {t('pulse.answeredProgress', { answered: answeredCount, total: ratings.length })}
            </span>
            <Button variant="secondary" onClick={() => setShowRespondModal(null)} disabled={responding}>{t('common.cancel')}</Button>
            <Button variant="primary" icon={<Send />} onClick={handleRespond} loading={responding} disabled={!allAnswered}>
              {t('pulse.submitAnonymously')}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {showRespondModal?.questions.map((q, i) => (
            <fieldset key={i}>
              <legend className="mb-3 flex items-start gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-2xs font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">{i + 1}</span>
                {q}
              </legend>
              <div role="radiogroup" aria-label={q} className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((v) => {
                  const selected = ratings[i] === v
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${v} / 5`}
                      onClick={() => setRatings((r) => r.map((x, j) => (j === i ? v : x)))}
                      className={`flex flex-col items-center gap-1 rounded-xl py-2.5 ring-1 ring-inset transition-all ${
                        selected
                          ? `${RATING_SELECTED[v]} ring-2 shadow-sm`
                          : 'bg-white text-slate-400 ring-slate-200 hover:bg-slate-50 hover:text-slate-600 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                      }`}
                    >
                      <MoodIcon value={v} className="h-6 w-6" />
                      <span className="text-xs font-semibold tabular-nums">{v}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-1.5 flex justify-between px-1 text-2xs text-slate-400 dark:text-slate-500">
                <span>{t('pulse.veryBad')}</span>
                <span>{t('pulse.veryGood')}</span>
              </div>
            </fieldset>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleClose}
        title={t('pulse.closeCheck')}
        message={t('pulse.closeConfirm', { title: closeTarget?.title ?? '' })}
        confirmLabel={t('pulse.closeCheck')}
        variant="warning"
      />
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('pulse.deleteCheck')}
        message={t('pulse.deleteConfirm', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
      />
    </Page>
  )
}

function PulseCard({ pc, onRespond, onClose, onDelete, hasVoted }: { pc: PulseCheck; onRespond?: () => void; onClose?: () => void; onDelete?: () => void; hasVoted?: boolean }) {
  const { t } = useTranslation()
  const sprint = useStore((s) => s.sprints.find((sp) => sp.id === pc.sprintId))
  const isClosed = !!pc.closedAt
  const avg = averageOf(pc)

  const menuItems = [
    ...(!isClosed && onClose ? [{ label: t('pulse.closeCheck'), icon: <Lock />, onClick: onClose }] : []),
    ...(!isClosed && onClose && onDelete ? [{ type: 'divider' as const }] : []),
    ...(onDelete ? [{ label: t('common.delete'), icon: <Trash2 />, danger: true, onClick: onDelete }] : []),
  ]

  return (
    <article className="surface flex min-w-0 flex-col p-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{pc.title}</h3>
            {isClosed
              ? <Badge label={t('pulse.closed')} icon={<Lock />} />
              : <Badge label={t('pulse.active')} variant="success" dot />}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(pc.createdAt)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t('pulse.responses', { count: pc.responseCount })}</span>
            {sprint && <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5" />{sprint.name}</span>}
          </p>
        </div>
        {avg !== null && (
          <div
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/60 ${TONE_TEXT[scoreTone(avg)]}`}
            title={t('pulse.overallAverage')}
          >
            <MoodIcon value={avg} className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{avg.toFixed(1)}</span>
          </div>
        )}
        {menuItems.length > 0 && (
          <DropdownMenu
            width="w-48"
            trigger={(p) => <IconButton {...p} icon={<MoreHorizontal />} label={t('common.moreActions')} />}
            items={menuItems}
          />
        )}
      </header>

      {pc.responseCount > 0 ? (
        <ul className="mt-4 space-y-3">
          {pc.questions.map((q, i) => {
            const qAvg = pc.averageRatings[i] ?? 0
            const tone = scoreTone(qAvg)
            return (
              <li key={i}>
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <span className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300" title={q}>{q}</span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                    <MoodIcon value={qAvg} className={`h-3.5 w-3.5 ${TONE_TEXT[tone]}`} />
                    {qAvg.toFixed(1)}
                    <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ 5</span>
                  </span>
                </div>
                <Meter value={(qAvg / 5) * 100} tone={tone} size="sm" label={q} />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {t('pulse.noResponses')}
        </p>
      )}

      {!isClosed && (
        <footer className="mt-5 flex items-center border-t border-slate-100 pt-4 dark:border-slate-800">
          {hasVoted ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              {t('pulse.alreadyVoted')}
            </span>
          ) : onRespond ? (
            <Button variant="primary" size="sm" icon={<Send />} onClick={onRespond}>{t('pulse.participate')}</Button>
          ) : null}
        </footer>
      )}
    </article>
  )
}
