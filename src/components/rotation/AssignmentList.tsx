import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ChevronRight, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import IconButton from '@/components/ui/IconButton'
import { formatDateShort } from '@/utils/date'
import { assignmentStatus as getStatus, type AssignmentStatus } from '@/utils/rotation'
import type { ResponsibilityAssignment, ResponsibilityTypeConfig } from '@/types'
import { StatusBadge, TimingText, compareAssignments, type MemberLike, type SprintLike } from './rotationUi'

interface RowProps {
  a: ResponsibilityAssignment
  member?: MemberLike
  sprint?: SprintLike | null
  color: string
  /** Show the responsibility name (list view) or the status (grouped view) */
  showType: boolean
  canWrite: boolean
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
}

/** One assignment as a dense, clickable list row. */
export function AssignmentRow({ a, member, sprint, color, showType, canWrite, onEdit, onDelete }: RowProps) {
  const { t } = useTranslation()
  const status = getStatus(a)
  const durationDays = differenceInCalendarDays(parseISO(a.endDate), parseISO(a.startDate)) + 1
  const ended = status === 'ended'

  return (
    <li className={`group relative flex items-center gap-3 py-3 pl-3 pr-3 transition-colors sm:gap-4 sm:pl-4 ${canWrite ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''}`}>
      {canWrite && (
        <button
          type="button"
          onClick={() => onEdit(a)}
          aria-label={`${t('rotation.editAssignment')}: ${a.type} · ${member?.name ?? '—'}`}
          className="absolute inset-0 focus-visible:!ring-inset"
        />
      )}
      <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: color, opacity: ended ? 0.4 : 1 }} aria-hidden />
      <Avatar
        name={member?.name ?? '?'}
        color={member?.avatarColor ?? '#94a3b8'}
        size="sm"
        className={ended ? 'opacity-60 grayscale' : ''}
      />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${ended ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
          {member?.name ?? '—'}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {showType ? <span className="truncate">{a.type}</span> : <StatusBadge status={status} />}
          {sprint && <Badge label={sprint.name} variant="outline" />}
          {a.isAutoSuggested && (
            <span className="inline-flex items-center gap-1 text-indigo-500 dark:text-indigo-400" title={t('rotation.autoSuggestedTitle')}>
              <Wand2 className="h-3 w-3" /> {t('rotation.suggestedShort')}
            </span>
          )}
          {a.notes && <span className="hidden max-w-[16rem] truncate italic text-slate-400 md:inline" title={a.notes}>{a.notes}</span>}
        </div>
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
          {formatDateShort(a.startDate)} – {formatDateShort(a.endDate)}
        </p>
        <p className="mt-0.5 whitespace-nowrap text-slate-400 dark:text-slate-500">
          <span className="hidden sm:inline">{t('rotation.durationDays', { count: durationDays })}</span>
          {!ended && (
            <span className={status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}>
              <span className="hidden sm:inline"> · </span><TimingText a={a} />
            </span>
          )}
        </p>
      </div>
      {canWrite && (
        <div className="relative z-10 hidden shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:flex [@media(hover:none)]:opacity-100">
          <IconButton size="sm" icon={<Pencil />} label={t('common.edit')} onClick={() => onEdit(a)} />
          <IconButton size="sm" variant="danger" icon={<Trash2 />} label={t('common.delete')} onClick={() => onDelete(a)} />
        </div>
      )}
    </li>
  )
}

const STATUS_GROUPS: AssignmentStatus[] = ['active', 'upcoming', 'ended']

/** Flat list, sectioned by status (running · upcoming · history). */
export function ListView({
  assignments, allMembers, sprints, colorOf, canWrite, onEdit, onDelete,
}: {
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  sprints: SprintLike[]
  colorOf: (type: string) => string
  canWrite: boolean
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="surface overflow-hidden">
      {STATUS_GROUPS.map((status) => {
        const items = assignments.filter((a) => getStatus(a) === status)
        if (items.length === 0) return null
        return (
          <section key={status} className="border-t border-slate-100 first:border-t-0 dark:border-slate-800">
            <h3 className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="section-label">{t(`rotation.group_${status}`)}</span>
              <span className="text-2xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">{items.length}</span>
            </h3>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((a) => (
                <AssignmentRow
                  key={a.id}
                  a={a}
                  member={allMembers.find((m) => m.id === a.memberId)}
                  sprint={a.sprintId ? sprints.find((s) => s.id === a.sprintId) : null}
                  color={colorOf(a.type)}
                  showType
                  canWrite={canWrite}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** One collapsible card per responsibility. */
export function GroupedView({
  responsibilityTypes, assignments, allMembers, sprints, collapsedGroups, canWrite, onToggleGroup, onEdit, onDelete, onAdd,
}: {
  responsibilityTypes: ResponsibilityTypeConfig[]
  assignments: ResponsibilityAssignment[]
  allMembers: MemberLike[]
  sprints: SprintLike[]
  collapsedGroups: Set<string>
  canWrite: boolean
  onToggleGroup: (name: string) => void
  onEdit: (a: ResponsibilityAssignment) => void
  onDelete: (a: ResponsibilityAssignment) => void
  onAdd: (type: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      {responsibilityTypes.map((rt) => {
        const group = assignments.filter((a) => a.type === rt.name).sort(compareAssignments)
        const collapsed = collapsedGroups.has(rt.name)
        const activeCount = group.filter((a) => getStatus(a) === 'active').length

        return (
          <section key={rt.id} className="surface overflow-hidden">
            <div className="flex items-center gap-2 pr-2.5">
              <button
                type="button"
                onClick={() => onToggleGroup(rt.name)}
                aria-expanded={!collapsed}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left focus-visible:!ring-inset"
              >
                <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} />
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rt.color }} />
                <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{rt.name}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-px text-2xs font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {group.length}
                </span>
                {activeCount > 0 && <Badge label={t('rotation.status_active')} variant="success" dot className="hidden sm:inline-flex" />}
              </button>
              {canWrite && (
                <IconButton size="sm" icon={<Plus />} label={t('rotation.newAssignment')} onClick={() => onAdd(rt.name)} />
              )}
            </div>
            {!collapsed && (
              group.length === 0 ? (
                <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  {t('rotation.noAssignmentsForFilter')}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                  {group.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      a={a}
                      member={allMembers.find((m) => m.id === a.memberId)}
                      sprint={a.sprintId ? sprints.find((s) => s.id === a.sprintId) : null}
                      color={rt.color}
                      showType={false}
                      canWrite={canWrite}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              )
            )}
          </section>
        )
      })}
    </div>
  )
}
