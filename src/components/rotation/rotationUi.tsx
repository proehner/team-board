import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import { localTodayISO } from '@/utils/sprint'
import { assignmentStatus as getStatus, type AssignmentStatus } from '@/utils/rotation'
import type { ResponsibilityAssignment } from '@/types'

export type MemberLike = { id: string; name: string; avatarColor: string }
export type SprintLike = { id: string; name: string }

const STATUS_ORDER: Record<AssignmentStatus, number> = { active: 0, upcoming: 1, ended: 2 }

/** Running first (ending soonest), then upcoming (starting soonest), then history (newest first). */
export function compareAssignments(a: ResponsibilityAssignment, b: ResponsibilityAssignment): number {
  const sa = getStatus(a), sb = getStatus(b)
  if (sa !== sb) return STATUS_ORDER[sa] - STATUS_ORDER[sb]
  if (sa === 'upcoming') return a.startDate.localeCompare(b.startDate)
  if (sa === 'active')   return a.endDate.localeCompare(b.endDate)
  return b.endDate.localeCompare(a.endDate)
}

/** Calendar days from today until the given date (0 = today). */
export const daysFromToday = (iso: string) => differenceInCalendarDays(parseISO(iso), parseISO(localTodayISO()))

/** Share (0–1) of a running assignment's period that has already passed. */
export function elapsedShare(a: ResponsibilityAssignment): number {
  const total = differenceInCalendarDays(parseISO(a.endDate), parseISO(a.startDate)) + 1
  const done = -daysFromToday(a.startDate) + 1
  return Math.min(1, Math.max(0, done / Math.max(total, 1)))
}

const STATUS_VARIANT: Record<AssignmentStatus, BadgeVariant> = { active: 'success', upcoming: 'info', ended: 'default' }

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const { t } = useTranslation()
  return <Badge label={t(`rotation.status_${status}`)} variant={STATUS_VARIANT[status]} dot={status === 'active'} />
}

/** "noch 5 Tage" / "endet heute" for running, "beginnt in 3 Tagen" for upcoming assignments. */
export function TimingText({ a }: { a: ResponsibilityAssignment }) {
  const { t } = useTranslation()
  const status = getStatus(a)
  if (status === 'active') {
    const remaining = daysFromToday(a.endDate) + 1
    return <>{remaining <= 1 ? t('rotation.endsToday') : t('rotation.daysLeft', { count: remaining })}</>
  }
  if (status === 'upcoming') return <>{t('rotation.startsIn', { count: daysFromToday(a.startDate) })}</>
  return null
}
