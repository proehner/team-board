import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { toast, errorMessage } from '@/store/toast'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import EmptyState from '@/components/ui/EmptyState'
import CapacityBar from '@/components/sprints/CapacityBar'
import CapacityActivitiesModal from '@/components/sprints/CapacityActivitiesModal'
import { countWorkingDays } from '@/utils/date'
import { sprintWorkingDays, summarizeMemberCapacity, formatNumber, parseAmount } from '@/utils/capacity'
import { capacitySourceFor } from '@/utils/sprint'
import { Users, Settings2, X, Clock, CalendarDays, Layers, ArrowRight, Copy, UserPlus } from 'lucide-react'
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
  const [busy, setBusy] = useState(false)

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

  /** Runs a store action; shows a toast on error (and optionally on success). Returns whether it succeeded. */
  async function run(action: () => Promise<void>, successMessage?: string): Promise<boolean> {
    try {
      await action()
      if (successMessage) toast.success(successMessage)
      return true
    } catch (err) {
      toast.error(t('common.saveError'), { description: errorMessage(err) })
      return false
    }
  }

  async function runBusy(action: () => Promise<void>, successMessage?: string) {
    setBusy(true)
    try { return await run(action, successMessage) } finally { setBusy(false) }
  }

  const saveMember = (memberId: string, data: SprintMemberCapacityUpdate) =>
    run(() => setMemberCapacity(sprint.id, memberId, data))

  function handleAdd(value: string) {
    if (!value) return
    const ids = value === ALL_MEMBERS ? addableMembers.map((m) => m.id) : [value]
    runBusy(() => addMembersToSprint(sprint.id, ids), t('capacity.membersAdded', { count: ids.length }))
  }

  function handleCopy(sourceId: string) {
    const source = sprints.find((s) => s.id === sourceId)
    if (!source) return
    if (sprint.capacity.length > 0) setCopySource(source)
    else runBusy(() => copySprintCapacity(sprint.id, source.id), t('capacity.copied', { name: source.name }))
  }

  return (
    <section className="surface">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="flex min-w-0 max-w-2xl items-start gap-3">
          <div className="mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{t('capacity.title')}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('capacity.subtitle')}</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {addableMembers.length > 0 && (
              <Select
                size="sm"
                icon={<UserPlus />}
                value=""
                onChange={(e) => handleAdd(e.target.value)}
                disabled={busy}
                aria-label={t('capacity.addMember')}
                wrapperClassName="w-full sm:w-48"
              >
                <option value="">{t('capacity.addMember')}</option>
                {addableMembers.length > 1 && (
                  <option value={ALL_MEMBERS}>{t('capacity.addAllMembers', { count: addableMembers.length })}</option>
                )}
                {addableMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            )}
            {copySources.length > 0 && (
              <Select
                size="sm"
                icon={<Copy />}
                value=""
                onChange={(e) => handleCopy(e.target.value)}
                disabled={busy}
                aria-label={t('capacity.copyFrom')}
                wrapperClassName="w-full sm:w-44"
              >
                <option value="">{t('capacity.copyFrom')}</option>
                {copySources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
            <Button variant="secondary" size="sm" icon={<Settings2 />} onClick={() => setShowActivities(true)}>
              {t('capacity.activities')}
            </Button>
          </div>
        )}
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
        <SummaryBox icon={<CalendarDays />} label={t('capacity.workingDays')} value={formatNumber(workingDays)}>
          <span className="inline-flex flex-wrap items-center gap-1" title={t('capacity.teamDaysOffHint')}>
            {t('capacity.weekdays', { count: weekdays })} −
            <NumberCell
              value={sprint.teamDaysOff}
              max={weekdays}
              readOnly={!canWrite}
              label={t('capacity.teamDaysOff')}
              onCommit={(v) => run(() => updateSprint(sprint.id, { teamDaysOff: v }))}
              className="w-10 py-0.5"
            />
            {t('capacity.teamDaysOff')}
          </span>
        </SummaryBox>
        <SummaryBox
          icon={<Clock />}
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
              type="button"
              onClick={() => run(() => updateSprint(sprint.id, { capacityHours: roundedSprintHours }), t('capacity.appliedToBurndown', { hours: roundedSprintHours }))}
              className="mt-1.5 flex items-start gap-1 rounded text-left font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
              title={t('capacity.applyToBurndownHint')}
            >
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" /> {t('capacity.applyToBurndown', { hours: roundedSprintHours })}
            </button>
          )}
        </SummaryBox>
        <SummaryBox icon={<Layers />} label={t('capacity.otherActivities')} value={`${formatNumber(totalOtherHours)} h`}>
          {otherActivityNames.join(', ')}
        </SummaryBox>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState
            compact
            icon={<Users />}
            title={t('capacity.empty')}
            description={canWrite ? t('capacity.emptyHint') : undefined}
            className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
            action={canWrite && (previousSource || addableMembers.length > 0) ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {previousSource && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Copy />}
                    loading={busy}
                    onClick={() => runBusy(() => copySprintCapacity(sprint.id, previousSource.id), t('capacity.copied', { name: previousSource.name }))}
                  >
                    {t('capacity.copyFromSprint', { name: previousSource.name })}
                  </Button>
                )}
                {addableMembers.length > 0 && (
                  <Button variant="secondary" size="sm" icon={<UserPlus />} disabled={busy} onClick={() => handleAdd(ALL_MEMBERS)}>
                    {t('capacity.addAllMembers', { count: addableMembers.length })}
                  </Button>
                )}
              </div>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100 scrollbar-thin dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                <th rowSpan={2} className="px-4 py-2 text-left align-bottom font-medium">{t('sprintDetail.memberColumn')}</th>
                <th rowSpan={2} className="px-2 py-2 text-right align-bottom font-medium" title={t('capacity.hoursPerDayHint')}>{t('capacity.hoursPerDay')}</th>
                {activities.length > 0 && (
                  <th colSpan={activities.length} className="border-b border-slate-200 px-2 pb-1.5 pt-2 text-center font-medium dark:border-slate-700">
                    {t('capacity.activitiesPerDay')}
                  </th>
                )}
                <th rowSpan={2} className="min-w-[6rem] px-2 py-2 text-left align-bottom font-medium">{t('capacity.distribution')}</th>
                <th rowSpan={2} className="px-2 py-2 text-right align-bottom font-medium">{t('capacity.daysOff')}</th>
                <th rowSpan={2} className="px-4 py-2 text-right align-bottom font-medium">{t('capacity.sprintHours')}</th>
                {canWrite && <th rowSpan={2} className="w-10"><span className="sr-only">{t('common.actions')}</span></th>}
              </tr>
              <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                {activities.map((a) => (
                  <th
                    key={a.id}
                    className={`px-2 pb-2 pt-1.5 text-right font-medium ${a.countsToSprint ? 'text-indigo-700 dark:text-indigo-300' : ''}`}
                    title={a.countsToSprint ? t('capacity.countsToSprintLong') : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5 leading-tight">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map(({ member, capacity, summary }) => (
                <tr key={member.id} className="group align-top transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-[10rem] items-start gap-2.5">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {member.name}
                          {!member.isActive && <span className="ml-1 text-xs font-normal text-slate-400">({t('common.inactive')})</span>}
                        </p>
                        <NotesInput
                          value={capacity.notes}
                          readOnly={!canWrite}
                          placeholder={t('capacity.notesPlaceholder')}
                          label={t('capacity.notesFor', { name: member.name })}
                          onCommit={(notes) => saveMember(member.id, { notes })}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <NumberCell
                      value={capacity.hoursPerDay}
                      max={24}
                      readOnly={!canWrite}
                      label={`${member.name}: ${t('capacity.hoursPerDay')}`}
                      onCommit={(v) => saveMember(member.id, { hoursPerDay: v })}
                    />
                  </td>
                  {activities.map((a) => (
                    <td key={a.id} className={`px-2 py-2.5 text-right ${a.countsToSprint ? 'bg-indigo-50/50 dark:bg-indigo-500/[0.06]' : ''}`}>
                      <NumberCell
                        value={capacity.activities[a.id] ?? 0}
                        max={24}
                        readOnly={!canWrite}
                        label={`${member.name}: ${a.name}`}
                        onCommit={(v) => saveMember(member.id, { activities: { [a.id]: v } })}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2.5">
                    <CapacityBar capacity={capacity} activities={activities} className="mt-2" />
                    <p className={`mt-1.5 whitespace-nowrap text-xs ${summary.unassignedHoursPerDay < 0 ? 'font-medium text-red-600 dark:text-red-400' : summary.unassignedHoursPerDay > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {summary.unassignedHoursPerDay < 0
                        ? t('capacity.overbookedHours', { hours: formatNumber(-summary.unassignedHoursPerDay) })
                        : summary.unassignedHoursPerDay > 0
                          ? t('capacity.unassignedHours', { hours: formatNumber(summary.unassignedHoursPerDay) })
                          : t('capacity.fullyPlanned')}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <NumberCell
                      value={capacity.daysOff}
                      max={366}
                      readOnly={!canWrite}
                      label={`${member.name}: ${t('capacity.daysOff')}`}
                      onCommit={(v) => saveMember(member.id, { daysOff: v })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <p className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(summary.sprintHours)} h</p>
                    <p className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                      {t('capacity.daysTimesHours', { days: formatNumber(summary.availableDays), hours: formatNumber(summary.sprintHoursPerDay) })}
                    </p>
                  </td>
                  {canWrite && (
                    <td className="py-2.5 pr-3">
                      <IconButton
                        size="xs"
                        variant="danger"
                        icon={<X />}
                        label={t('capacity.removeMember')}
                        onClick={() => setRemoveTarget(member)}
                        className="mt-1 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                <td className="px-4 py-3"><span className="section-label">{t('capacity.teamTotal')}</span></td>
                <td />
                {activities.map((a) => (
                  <td key={a.id} className={`whitespace-nowrap px-2 py-3 text-right tabular-nums ${a.countsToSprint ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                    {formatNumber(rows.reduce((sum, r) => sum + (r.capacity.activities[a.id] ?? 0), 0))}
                  </td>
                ))}
                <td />
                <td className="px-2 py-3 text-right tabular-nums">{formatNumber(totalDaysOff)}</td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-900 dark:text-slate-100">{formatNumber(totalSprintHours)} h</td>
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
        onConfirm={async () => {
          if (!copySource) return
          const ok = await run(() => copySprintCapacity(sprint.id, copySource.id), t('capacity.copied', { name: copySource.name }))
          if (!ok) throw new Error('copy failed')
        }}
        title={t('capacity.copyTitle')}
        message={t('capacity.copyConfirm', { name: copySource?.name })}
        confirmLabel={t('capacity.copyAction')}
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return
          const ok = await run(() => removeMemberFromSprint(sprint.id, removeTarget.id), t('capacity.memberRemoved', { name: removeTarget.name }))
          if (!ok) throw new Error('remove failed')
        }}
        title={t('capacity.removeMember')}
        message={t('capacity.removeMemberConfirm', { name: removeTarget?.name })}
        confirmLabel={t('common.remove')}
      />
    </section>
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
    <div
      className={`rounded-xl p-4 ring-1 ring-inset ${
        highlight
          ? 'bg-indigo-50/70 ring-indigo-500/15 dark:bg-indigo-500/10 dark:ring-indigo-400/20'
          : 'bg-slate-50/80 ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/50'
      }`}
    >
      <div
        className={`mb-1.5 flex items-center gap-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5 ${
          highlight ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {icon}
        <span className="leading-tight">{label}</span>
      </div>
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${highlight ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
      {children && <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  )
}

// ─── NumberCell ───────────────────────────────────────────────────────────────
// Inline number input that saves on blur / Enter. Accepts "4,5" and "4.5".
// Inside the table, Enter / Shift+Enter moves to the same column in the next / previous row.

const cellInputCls =
  'rounded-md border border-transparent bg-slate-100/80 px-1.5 text-right text-sm tabular-nums text-slate-900 transition-colors ' +
  'placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/15 ' +
  'dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-indigo-400 dark:focus:bg-slate-900 dark:focus:ring-indigo-400/20'

function NumberCell({ value, onCommit, max, label, readOnly = false, className = 'w-12 py-1' }: {
  value: number
  onCommit: (v: number) => void
  max: number
  label: string
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
    return (
      <span className={`inline-block py-1 tabular-nums ${value ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
        {value ? formatNumber(value, 2) : '–'}
      </span>
    )
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
      aria-label={label}
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
      className={`${cellInputCls} ${className}`}
    />
  )
}

// ─── NotesInput ───────────────────────────────────────────────────────────────

function NotesInput({ value, onCommit, placeholder, label, readOnly = false }: {
  value: string
  onCommit: (v: string) => void
  placeholder: string
  label: string
  readOnly?: boolean
}) {
  const [text, setText] = useState(value)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(value)
  }, [value])

  if (readOnly) {
    return value ? <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={value}>{value}</p> : null
  }

  return (
    <input
      type="text"
      value={text}
      placeholder={placeholder}
      aria-label={label}
      title={text || undefined}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => { focusedRef.current = true }}
      onBlur={() => {
        focusedRef.current = false
        if (text !== value) onCommit(text)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className="w-full border-b border-transparent bg-transparent px-0 py-0.5 text-xs text-slate-500 placeholder:text-slate-300 hover:border-slate-200 focus:border-indigo-400 focus:outline-none dark:text-slate-400 dark:placeholder:text-slate-600 dark:hover:border-slate-700 dark:focus:border-indigo-500"
    />
  )
}
