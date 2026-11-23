import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import Select from '@/components/ui/Select'
import EmptyState from '@/components/ui/EmptyState'
import { Hint } from '@/components/rotation/AssignmentFormModal'
import { formatDateShort } from '@/utils/date'
import {
  assignmentsOverlapping, nextFreePeriod, openSprints, rankCandidates, suggestedCandidate, type Period,
} from '@/utils/rotation'
import { CalendarPlus, RefreshCw, Wand2 } from 'lucide-react'
import type { Sprint } from '@/types'

const CUSTOM = '__custom__'

interface PlanRow {
  include: boolean
  memberId: string
  suggestedId: string
}

/**
 * Plans all responsibilities for one sprint (or a custom period) at once.
 * Suggestions are fair per responsibility and spread the load, so nobody gets
 * two duties in the same period while others are free.
 */
export default function RotationPlanModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const types = useStore((s) => s.responsibilityTypes)
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const assignments = useStore((s) => s.assignments)
  const addAssignment = useStore((s) => s.addAssignment)

  const [target, setTarget] = useState('')
  const [custom, setCustom] = useState<Period>(() => nextFreePeriod(assignments))
  const [rows, setRows] = useState<Record<string, PlanRow>>({})
  const [saving, setSaving] = useState(false)

  const candidatesSprints = openSprints(sprints)
  const sprint: Sprint | undefined = sprints.find((s) => s.id === target)
  const customInvalid = target === CUSTOM && !!custom.startDate && !!custom.endDate && custom.endDate < custom.startDate
  const period: Period | undefined = target === CUSTOM
    ? (custom.startDate && custom.endDate && custom.endDate >= custom.startDate ? custom : undefined)
    : sprint && { startDate: sprint.startDate, endDate: sprint.endDate }

  // Default target: the first open sprint with a responsibility still unassigned
  useEffect(() => {
    if (!isOpen) return
    const withGap = candidatesSprints.find((s) =>
      types.some((rt) => assignmentsOverlapping(assignments, s, { type: rt.name }).length === 0),
    )
    setTarget(withGap?.id ?? candidatesSprints[0]?.id ?? CUSTOM)
    setCustom(nextFreePeriod(assignments))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Fresh suggestions whenever the period changes
  useEffect(() => {
    if (!isOpen) return
    setRows(buildSuggestions())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target, period?.startDate, period?.endDate])

  function buildSuggestions(): Record<string, PlanRow> {
    if (!period) return {}
    const reserved = new Map<string, string[]>()
    const next: Record<string, PlanRow> = {}
    for (const rt of types) {
      const taken = assignmentsOverlapping(assignments, period, { type: rt.name }).length > 0
      const pick = suggestedCandidate(rankCandidates({ type: rt, members, assignments, period, sprint, reserved }))?.member.id ?? ''
      if (pick && !taken) reserved.set(pick, [...(reserved.get(pick) ?? []), rt.name])
      next[rt.name] = { include: !taken && !!pick, memberId: pick, suggestedId: pick }
    }
    return next
  }

  const setRow = (type: string, patch: Partial<PlanRow>) =>
    setRows((r) => ({ ...r, [type]: { ...r[type], ...patch } }))

  const selected = types.filter((rt) => rows[rt.name]?.include && rows[rt.name]?.memberId)

  async function handleSubmit() {
    if (!period || selected.length === 0 || saving) return
    setSaving(true)
    let created = 0
    try {
      for (const rt of selected) {
        const row = rows[rt.name]
        await addAssignment({
          type: rt.name, memberId: row.memberId, sprintId: sprint?.id,
          startDate: period.startDate, endDate: period.endDate, notes: '',
          isAutoSuggested: row.memberId === row.suggestedId, isSynthetic: false, isArchived: false,
        })
        created++
      }
      toast.success(t('rotation.assignmentsCreated', { count: created }))
      onClose()
    } catch (err) {
      toast.error(t('common.saveError'), {
        description: [created > 0 ? t('rotation.partiallyCreated', { count: created }) : '', errorMessage(err)].filter(Boolean).join(' · '),
      })
    } finally {
      setSaving(false)
    }
  }

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—'

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) onClose() }}
      title={t('rotation.planTitle')}
      description={t('rotation.planHintShort')}
      icon={<CalendarPlus />}
      size="lg"
      dismissible={false}
      footer={
        <>
          <Button
            variant="ghost"
            icon={<RefreshCw />}
            onClick={() => setRows(buildSuggestions())}
            disabled={!period || saving}
            aria-label={t('rotation.resetSuggestions')}
            title={t('rotation.resetSuggestions')}
            className="mr-auto"
          >
            <span className="hidden sm:inline">{t('rotation.resetSuggestions')}</span>
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!period || selected.length === 0}>
            {t('rotation.createAssignments', { count: selected.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/60">
          <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
          {t('rotation.planFairnessHint')}
        </p>

        {/* Period */}
        <div className="space-y-3">
          <Field label={t('rotation.period')} htmlFor="plan-period">
            <Select id="plan-period" value={target} onChange={(e) => setTarget(e.target.value)}>
              {candidatesSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatDateShort(s.startDate)} – {formatDateShort(s.endDate)})
                </option>
              ))}
              <option value={CUSTOM}>{t('rotation.customPeriod')}</option>
            </Select>
          </Field>
          {target === CUSTOM && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('sprints.startDate')} htmlFor="plan-start">
                <input id="plan-start" type="date" value={custom.startDate} onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))} className="form-input" />
              </Field>
              <Field label={t('sprints.endDate')} htmlFor="plan-end" error={customInvalid ? t('rotation.endDateAfterStart') : undefined}>
                <input id="plan-end" type="date" value={custom.endDate} onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))} className="form-input" />
              </Field>
            </div>
          )}
        </div>

        {/* One row per responsibility */}
        {types.length === 0 ? (
          <EmptyState compact icon={<CalendarPlus />} title={t('rotation.noTypes')} />
        ) : period && (
          <div>
            <p className="form-label">{t('rotation.planAssignmentsLabel')}</p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {types.map((rt) => {
                const row = rows[rt.name]
                if (!row) return null
                const existing = assignmentsOverlapping(assignments, period, { type: rt.name })
                // Duties picked in the other rows count as "already busy"
                const reserved = new Map<string, string[]>()
                for (const other of types) {
                  const r = rows[other.name]
                  if (other.id !== rt.id && r?.include && r.memberId) reserved.set(r.memberId, [...(reserved.get(r.memberId) ?? []), other.name])
                }
                const ranked = rankCandidates({ type: rt, members, assignments, period, sprint, reserved })
                const chosen = ranked.find((c) => c.member.id === row.memberId)
                const options = [...ranked].sort((a, b) => a.member.name.localeCompare(b.member.name))
                const checkboxId = `plan-include-${rt.id}`

                return (
                  <li key={rt.id} className={`space-y-1.5 px-4 py-3 transition-colors ${row.include ? '' : 'bg-slate-50/70 dark:bg-slate-800/30'}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label htmlFor={checkboxId} className="flex min-w-[11rem] flex-1 cursor-pointer items-center gap-2.5">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => setRow(rt.name, { include: e.target.checked })}
                          className="h-4 w-4 rounded"
                        />
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                        <span className={`text-sm font-medium ${row.include ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>{rt.name}</span>
                      </label>
                      {row.include ? (
                        <Select
                          size="sm"
                          value={row.memberId}
                          onChange={(e) => setRow(rt.name, { memberId: e.target.value })}
                          aria-label={`${rt.name} – ${t('sprintDetail.memberColumn')}`}
                          wrapperClassName="w-full sm:w-64"
                        >
                          <option value="">{t('rotation.selectMember')}</option>
                          {options.map((c) => (
                            <option key={c.member.id} value={c.member.id}>
                              {c.member.name} ({c.count}×)
                              {c.member.id === row.suggestedId ? ` · ${t('rotation.suggestedShort')}` : ''}
                              {c.excluded ? ` · ${t('rotation.notParticipating')}` : ''}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {existing.length > 0
                            ? t('rotation.alreadyAssigned', { list: existing.map((a) => memberName(a.memberId)).join(', ') })
                            : t('rotation.skipped')}
                        </span>
                      )}
                    </div>
                    {row.include && (
                      <div className="space-y-1 pl-[1.625rem]">
                        {row.memberId && row.memberId === row.suggestedId && (
                          <p className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                            <Wand2 className="h-3.5 w-3.5" /> {t('rotation.suggestionReason', { count: chosen?.count ?? 0 })}
                          </p>
                        )}
                        {existing.length > 0 && (
                          <Hint warning>{t('rotation.alreadyAssigned', { list: existing.map((a) => memberName(a.memberId)).join(', ') })}</Hint>
                        )}
                        {chosen?.excluded && <Hint warning>{t('rotation.excludedHint', { name: chosen.member.name })}</Hint>}
                        {chosen && chosen.daysOff > 0 && sprint && (
                          <Hint warning>{t('rotation.absenceHint', { name: chosen.member.name, count: chosen.daysOff, sprint: sprint.name })}</Hint>
                        )}
                        {chosen && chosen.otherDuties.length > 0 && (
                          <Hint>{t('rotation.otherDutiesHint', { name: chosen.member.name, duties: chosen.otherDuties.join(', ') })}</Hint>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
