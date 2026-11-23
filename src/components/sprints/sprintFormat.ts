import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { SprintGoalMet, SprintStatus } from '@/types'
import type { BadgeVariant } from '@/components/ui/Badge'

/** "28. Sep. – 09. Okt. 2026" (year only once when both dates are in the same year). */
export function formatSprintRange(start: string, end: string): string {
  const s = parseISO(start)
  const e = parseISO(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  return `${format(s, sameYear ? 'dd. MMM' : 'dd. MMM yyyy', { locale: de })} – ${format(e, 'dd. MMM yyyy', { locale: de })}`
}

export const SPRINT_STATUS_VARIANTS: Record<SprintStatus, BadgeVariant> = {
  Geplant: 'default',
  Aktiv: 'indigo',
  Abgeschlossen: 'success',
  Abgebrochen: 'danger',
}

export const GOAL_MET_VARIANTS: Record<SprintGoalMet, BadgeVariant> = {
  Ja: 'success',
  Teilweise: 'warning',
  Nein: 'danger',
}

/** Completed share of the capacity in percent, or null when not computable. */
export function completedTimePct(capacityHours?: number, remainingHours?: number): number | null {
  return capacityHours && capacityHours > 0 && remainingHours !== undefined && remainingHours !== null
    ? Math.round(((capacityHours - remainingHours) / capacityHours) * 100)
    : null
}
