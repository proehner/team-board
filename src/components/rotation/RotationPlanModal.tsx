import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Hint } from '@/components/rotation/AssignmentFormModal'
import { formatDateShort } from '@/utils/date'
import {
  assignmentsOverlapping, nextFreePeriod, openSprints, rankCandidates, suggestedCandidate, type Period,
} from '@/utils/rotation'
import { RefreshCw, Wand2 } from 'lucide-react'
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
  const [error, setError] = useState('')

  const candidatesSprints = openSprints(sprints)
  const sprint: Sprint | undefined = sprints.find((s) => s.id === target)
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
    setError('')
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
    if (!period || selected.length === 0) return
    setSaving(true)
    setError('')
    try {
      for (const rt of selected) {
        const row = rows[rt.name]
        await addAssignment({
          type: rt.name, memberId: row.memberId, sprintId: sprint?.id,
          startDate: period.startDate, endDate: period.endDate, notes: '',
          isAutoSuggested: row.memberId === row.suggestedId, isSynthetic: false, isArchived: false,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '—'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('rotation.planTitle')}
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={() => setRows(buildSuggestions())}
            disabled={!period}
            className="mr-auto"
          >
            {t('rotation.resetSuggestions')}
          </Button>
          {error && <p className="flex-1 text-sm text-red-600">{error}</p>}
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving} disabled={!period || selected.length === 0}>
            {t('rotation.createAssignments', { count: selected.length })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('rotation.planHint')}</p>

        {/* Period */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('rotation.period')}</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="form-input">
            {candidatesSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDateShort(s.startDate)} – {formatDateShort(s.endDate)})
              </option>
            ))}
            <option value={CUSTOM}>{t('rotation.customPeriod')}</option>
          </select>
          {target === CUSTOM && (
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={custom.startDate} onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))} className="form-input" />
              <input type="date" value={custom.endDate} onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))} className="form-input" />
            </div>
          )}
        </div>

        {/* One row per responsibility */}
        {types.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">{t('rotation.noTypes')}</p>
        ) : period && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
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

              return (
                <div key={rt.id} className={`px-4 py-3 space-y-1.5 ${row.include ? '' : 'bg-slate-50/60 dark:bg-slate-900/40'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 min-w-[11rem] flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.include}
                        onChange={(e) => setRow(rt.name, { include: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: rt.color }} />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{rt.name}</span>
                    </label>
                    {row.include ? (
                      <select
                        value={row.memberId}
                        onChange={(e) => setRow(rt.name, { memberId: e.target.value })}
                        className="form-input w-full sm:w-64 py-1.5"
                      >
                        <option value="">{t('rotation.selectMember')}</option>
                        {options.map((c) => (
                          <option key={c.member.id} value={c.member.id}>
                            {c.member.name} ({c.count}×)
                            {c.member.id === row.suggestedId ? ` · ${t('rotation.suggestedShort')}` : ''}
                            {c.excluded ? ` · ${t('rotation.notParticipating')}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {existing.length > 0
                          ? t('rotation.alreadyAssigned', { list: existing.map((a) => memberName(a.memberId)).join(', ') })
                          : t('rotation.skipped')}
                      </span>
                    )}
                  </div>
                  {row.include && (
                    <div className="pl-6 space-y-1">
                      {row.memberId && row.memberId === row.suggestedId && (
                        <p className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                          <Wand2 className="w-3.5 h-3.5" /> {t('rotation.suggestionReason', { count: chosen?.count ?? 0 })}
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
