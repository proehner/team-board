import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CapacityBar from '@/components/sprints/CapacityBar'
import CapacityActivitiesModal from '@/components/sprints/CapacityActivitiesModal'
import { countWorkingDays } from '@/utils/date'
import { sprintWorkingDays, summarizeMemberCapacity, formatNumber, parseAmount } from '@/utils/capacity'
import { capacitySourceFor } from '@/utils/sprint'
import { Users, Settings2, Trash2, Clock, CalendarDays, Layers, ArrowRight, Copy, UserPlus } from 'lucide-react'
import type { Sprint, SprintMemberCapacityUpdate, TeamMember } from '@/types'

const ALL_MEMBERS = '__all__'

/**
 * Capacity planning of a sprint, modelled after Azure DevOps: every member has
 * a working time per day that is split into activities (development, reviews,
 * team lead, …). Only activities flagged as "sprint capacity" count towards
 * the plannable hours of the sprint.
 */
export default function SprintCapacitySection({ sprint, canWrite }: { sprint: Sprint; canWrite: boolean }) {
  const { t } = useTranslation()
  const members = useStore((s) => s.members)
  const sprints = useStore((s) => s.sprints)
  const activities = useStore((s) => s.capacityActivities)
  const updateSprint = useStore((s) => s.updateSprint)
  const setMemberCapacity = useStore((s) => s.setMemberCapacity)
  const addMembersToSprint = useStore((s) => s.addMembersToSprint)
  const copySprintCapacity = useStore((s) => s.copySprintCapacity)
  const removeMemberFromSprint = useStore((s) => s.removeMemberFromSprint)

  const [showActivities, setShowActivities] = useState(false)
  const [copySource, setCopySource] = useState<Sprint | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [error, setError] = useState('')

  const weekdays = countWorkingDays(sprint.startDate, sprint.endDate)
  const workingDays = sprintWorkingDays(sprint)

  const rows = sprint.capacity
    .flatMap((capacity) => {
      const member = members.find((m) => m.id === capacity.memberId)
      return member ? [{ member, capacity, summary: summarizeMemberCapacity(capacity, activities, workingDays) }] : []
    })
    .sort((a, b) => a.member.name.localeCompare(b.member.name))

  const totalSprintHours = rows.reduce((sum, r) => sum + r.summary.sprintHours, 0)
  const totalOtherHours = rows.reduce((sum, r) => sum + r.summary.otherHours, 0)
  const totalDaysOff = rows.reduce((sum, r) => sum + r.capacity.daysOff, 0)
  const avgSprintHoursPerDay = rows.length > 0
    ? rows.reduce((sum, r) => sum + r.summary.sprintHoursPerDay, 0) / rows.length
    : 0
  const roundedSprintHours = Math.round(totalSprintHours)

  const sprintActivityNames = activities.filter((a) => a.countsToSprint).map((a) => a.name)
  const otherActivityNames = activities.filter((a) => !a.countsToSprint).map((a) => a.name)

  const addableMembers = members
    .filter((m) => m.isActive && !sprint.capacity.some((c) => c.memberId === m.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const previousSource = capacitySourceFor(sprints, sprint.startDate, sprint.id)
  const copySources = sprints
    .filter((s) => s.id !== sprint.id && s.capacity.length > 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  async function run(action: () => Promise<void>) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  const saveMember = (memberId: string, data: SprintMemberCapacityUpdate) =>
    run(() => setMemberCapacity(sprint.id, memberId, data))

  function handleAdd(value: string) {
    if (!value) return
    const ids = value === ALL_MEMBERS ? addableMembers.map((m) => m.id) : [value]
    run(() => addMembersToSprint(sprint.id, ids))
  }

  function handleCopy(sourceId: string) {
    const source = sprints.find((s) => s.id === sourceId)
    if (!source) return
    if (sprint.capacity.length > 0) setCopySource(source)
    else run(() => copySprintCapacity(sprint.id, source.id))
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4" /> {t('capacity.title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('capacity.subtitle')}</p>
          </div>
          {canWrite && (
            <div className="flex items-center gap-2 flex-wrap">
              {addableMembers.length > 0 && (
                <select value="" onChange={(e) => handleAdd(e.target.value)} className="form-input w-auto py-1.5">
                  <option value="">{t('capacity.addMember')}</option>
                  {addableMembers.length > 1 && (
                    <option value={ALL_MEMBERS}>{t('capacity.addAllMembers', { count: addableMembers.length })}</option>
                  )}
                  {addableMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {copySources.length > 0 && (
                <select value="" onChange={(e) => handleCopy(e.target.value)} className="form-input w-auto py-1.5">
                  <option value="">{t('capacity.copyFrom')}</option>
                  {copySources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <Button variant="secondary" size="sm" icon={<Settings2 className="w-3.5 h-3.5" />} onClick={() => setShowActivities(true)}>
                {t('capacity.activities')}
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryBox icon={<CalendarDays className="w-4 h-4" />} label={t('capacity.workingDays')} value={formatNumber(workingDays)}>
            <span className="inline-flex items-center gap-1 flex-wrap" title={t('capacity.teamDaysOffHint')}>
              {t('capacity.weekdays', { count: weekdays })} −
              <NumberCell
                value={sprint.teamDaysOff}
                max={weekdays}
                readOnly={!canWrite}
                onCommit={(v) => run(() => updateSprint(sprint.id, { teamDaysOff: v }))}
                className="w-10 py-0"
              />
              {t('capacity.teamDaysOff')}
            </span>
          </SummaryBox>
          <SummaryBox
            icon={<Clock className="w-4 h-4" />}
            label={t('capacity.sprintCapacity')}
            value={`${formatNumber(totalSprintHours)} h`}
            highlight
          >
            <span>
              {sprintActivityNames.length > 0 ? sprintActivityNames.join(', ') : t('capacity.noSprintActivity')}
              {rows.length > 0 && <> · {t('capacity.avgPerPerson', { hours: formatNumber(avgSprintHoursPerDay) })}</>}
            </span>
            {canWrite && rows.length > 0 && sprint.capacityHours !== roundedSprintHours && (
              <button
                onClick={() => run(() => updateSprint(sprint.id, { capacityHours: roundedSprintHours }))}
                className="flex items-start gap-1 mt-1 text-left text-indigo-600 dark:text-indigo-400 hover:underline"
                title={t('capacity.applyToBurndownHint')}
              >
                <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" /> {t('capacity.applyToBurndown', { hours: roundedSprintHours })}
              </button>
            )}
          </SummaryBox>
          <SummaryBox icon={<Layers className="w-4 h-4" />} label={t('capacity.otherActivities')} value={`${formatNumber(totalOtherHours)} h`}>
            {otherActivityNames.join(', ')}
          </SummaryBox>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('capacity.empty')}</p>
          {canWrite && (previousSource || addableMembers.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              {previousSource && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Copy className="w-3.5 h-3.5" />}
                  onClick={() => run(() => copySprintCapacity(sprint.id, previousSource.id))}
                >
                  {t('capacity.copyFromSprint', { name: previousSource.name })}
                </Button>
              )}
              {addableMembers.length > 0 && (
                <Button variant="secondary" size="sm" icon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => handleAdd(ALL_MEMBERS)}>
                  {t('capacity.addAllMembers', { count: addableMembers.length })}
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th rowSpan={2} className="text-left px-4 py-2 align-bottom">{t('sprintDetail.memberColumn')}</th>
                <th rowSpan={2} className="text-right px-2 py-2 align-bottom" title={t('capacity.hoursPerDayHint')}>{t('capacity.hoursPerDay')}</th>
                {activities.length > 0 && (
                  <th colSpan={activities.length} className="px-2 pt-2 pb-1 text-center font-medium border-b border-slate-200 dark:border-slate-700">
                    {t('capacity.activitiesPerDay')}
                  </th>
                )}
                <th rowSpan={2} className="text-left px-2 py-2 align-bottom min-w-[6rem]">{t('capacity.distribution')}</th>
                <th rowSpan={2} className="text-right px-2 py-2 align-bottom">{t('capacity.daysOff')}</th>
                <th rowSpan={2} className="text-right px-4 py-2 align-bottom">{t('capacity.sprintHours')}</th>
                {canWrite && <th rowSpan={2} className="w-8" />}
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {activities.map((a) => (
                  <th
                    key={a.id}
                    className={`text-right px-2 pb-2 pt-1 ${a.countsToSprint ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                    title={a.countsToSprint ? t('capacity.countsToSprintLong') : undefined}
                  >
                    <span className="inline-flex items-center gap-1 leading-tight">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, capacity, summary }) => (
                <tr key={member.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-2 min-w-[9rem]">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {member.name}
                          {!member.isActive && <span className="ml-1 text-xs font-normal text-slate-400">({t('common.inactive')})</span>}
                        </p>
                        <NotesInput
                          value={capacity.notes}
                          readOnly={!canWrite}
                          placeholder={t('capacity.notesPlaceholder')}
                          onCommit={(notes) => saveMember(member.id, { notes })}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <NumberCell value={capacity.hoursPerDay} max={24} readOnly={!canWrite} onCommit={(v) => saveMember(member.id, { hoursPerDay: v })} />
                  </td>
                  {activities.map((a) => (
                    <td key={a.id} className={`px-2 py-2 text-right ${a.countsToSprint ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}>
                      <NumberCell
                        value={capacity.activities[a.id] ?? 0}
                        max={24}
                        readOnly={!canWrite}
                        onCommit={(v) => saveMember(member.id, { activities: { [a.id]: v } })}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <CapacityBar capacity={capacity} activities={activities} className="mt-2" />
                    <p className={`text-xs mt-1 whitespace-nowrap ${summary.unassignedHoursPerDay < 0 ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      {summary.unassignedHoursPerDay < 0
                        ? t('capacity.overbookedHours', { hours: formatNumber(-summary.unassignedHoursPerDay) })
                        : summary.unassignedHoursPerDay > 0
                          ? t('capacity.unassignedHours', { hours: formatNumber(summary.unassignedHoursPerDay) })
                          : t('capacity.fullyPlanned')}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <NumberCell value={capacity.daysOff} max={366} readOnly={!canWrite} onCommit={(v) => saveMember(member.id, { daysOff: v })} />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{formatNumber(summary.sprintHours)} h</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t('capacity.daysTimesHours', { days: formatNumber(summary.availableDays), hours: formatNumber(summary.sprintHoursPerDay) })}
                    </p>
                  </td>
                  {canWrite && (
                    <td className="pr-3 py-2">
                      <button
                        onClick={() => setRemoveTarget(member)}
                        title={t('common.remove')}
                        className="p-1.5 mt-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <td className="px-4 py-2.5 uppercase tracking-wide">{t('capacity.teamTotal')}</td>
                <td />
                {activities.map((a) => (
                  <td key={a.id} className="px-2 py-2.5 text-right whitespace-nowrap">
                    {formatNumber(rows.reduce((sum, r) => sum + (r.capacity.activities[a.id] ?? 0), 0))}
                  </td>
                ))}
                <td />
                <td className="px-2 py-2.5 text-right">{formatNumber(totalDaysOff)}</td>
                <td className="px-4 py-2.5 text-right text-slate-900 dark:text-slate-100">{formatNumber(totalSprintHours)} h</td>
                {canWrite && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <CapacityActivitiesModal isOpen={showActivities} onClose={() => setShowActivities(false)} />

      <ConfirmDialog
        isOpen={!!copySource}
        onClose={() => setCopySource(null)}
        onConfirm={() => { if (copySource) run(() => copySprintCapacity(sprint.id, copySource.id)) }}
        title={t('capacity.copyTitle')}
        message={t('capacity.copyConfirm', { name: copySource?.name })}
        confirmLabel={t('capacity.copyAction')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => { if (removeTarget) run(() => removeMemberFromSprint(sprint.id, removeTarget.id)) }}
        title={t('capacity.removeMember')}
        message={t('capacity.removeMemberConfirm', { name: removeTarget?.name })}
        confirmLabel={t('common.remove')}
      />
    </div>
  )
}

// ─── SummaryBox ───────────────────────────────────────────────────────────────

function SummaryBox({ icon, label, value, highlight = false, children }: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${highlight ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}`}>
        {icon}
        <span className="text-xs font-medium leading-tight">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {children && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  )
}

// ─── NumberCell ───────────────────────────────────────────────────────────────
// Inline number input that saves on blur / Enter. Accepts "4,5" and "4.5".
// Inside the table, Enter / Shift+Enter moves to the same column in the next / previous row.

function NumberCell({ value, onCommit, max, readOnly = false, className = 'w-12 py-1' }: {
  value: number
  onCommit: (v: number) => void
  max: number
  readOnly?: boolean
  className?: string
}) {
  const display = (n: number) => (n ? formatNumber(n, 2) : '')
  const [text, setText] = useState(display(value))
  const focusedRef = useRef(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(display(value))
  }, [value])

  if (readOnly) {
    return <span className="inline-block py-1 text-slate-700 dark:text-slate-300">{value ? formatNumber(value, 2) : '–'}</span>
  }

  function commit() {
    focusedRef.current = false
    const v = parseAmount(text)
    if (cancelRef.current || v === null || v > max) {
      cancelRef.current = false
      setText(display(value))
      return
    }
    setText(display(v))
    if (v !== value) onCommit(v)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => { focusedRef.current = true; e.target.select() }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const cell = e.currentTarget.closest('td')
          const row = cell?.parentElement
          const targetRow = e.shiftKey ? row?.previousElementSibling : row?.nextElementSibling
          const target = cell && row && targetRow?.children[Array.from(row.children).indexOf(cell)]?.querySelector('input')
          // Moving the focus blurs this input, which saves it
          if (target) target.focus()
          else e.currentTarget.blur()
        }
        if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur() }
      }}
      className={`form-input px-1.5 text-right ${className}`}
    />
  )
}

// ─── NotesInput ───────────────────────────────────────────────────────────────

function NotesInput({ value, onCommit, placeholder, readOnly = false }: {
  value: string
  onCommit: (v: string) => void
  placeholder: string
  readOnly?: boolean
}) {
  const [text, setText] = useState(value)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(value)
  }, [value])

  if (readOnly) {
    return value ? <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{value}</p> : null
  }

  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => { focusedRef.current = true }}
      onBlur={() => {
        focusedRef.current = false
        if (text !== value) onCommit(text)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="w-full bg-transparent px-0 py-0.5 text-xs text-slate-500 dark:text-slate-400 placeholder-slate-300 dark:placeholder-slate-600 border-b border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-400 focus:outline-none"
    />
  )
}
