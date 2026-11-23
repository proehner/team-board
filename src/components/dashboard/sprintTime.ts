import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { countWorkingDays } from '@/utils/date'
import { toISODate } from '@/utils/sprint'

/** Calendar days from today until `iso` (0 = today, negative = in the past). */
export function calendarDaysUntil(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), startOfDay(new Date()))
}

export type SprintTimeState = 'upcoming' | 'running' | 'endsToday' | 'overdue'

export interface SprintTimeInfo {
  state: SprintTimeState
  /** Working days in the sprint (Mon–Fri) */
  totalWorkingDays: number
  /** Working days elapsed until today (inclusive), clamped to the sprint */
  elapsedWorkingDays: number
  /** 0–100 */
  pct: number
  /** Calendar days until the end date (negative when overdue) */
  daysLeft: number
  /** Calendar days since the end date (> 0 only when overdue) */
  overdueDays: number
  /** Calendar days until the start date (> 0 only when upcoming) */
  daysToStart: number
}

/** Time progress of a sprint relative to today. Purely presentational. */
export function sprintTimeInfo(startDate: string, endDate: string): SprintTimeInfo {
  const today = toISODate(new Date())
  const totalWorkingDays = Math.max(countWorkingDays(startDate, endDate), 1)
  const daysLeft = calendarDaysUntil(endDate)
  const daysToStart = calendarDaysUntil(startDate)

  let elapsedWorkingDays = 0
  if (daysToStart <= 0) {
    const until = today < endDate ? today : endDate
    elapsedWorkingDays = Math.min(countWorkingDays(startDate, until), totalWorkingDays)
  }

  let state: SprintTimeState = 'running'
  if (daysToStart > 0) state = 'upcoming'
  else if (daysLeft < 0) state = 'overdue'
  else if (daysLeft === 0) state = 'endsToday'

  const pct = state === 'overdue' ? 100 : Math.round((elapsedWorkingDays / totalWorkingDays) * 100)

  return {
    state,
    totalWorkingDays,
    elapsedWorkingDays,
    pct,
    daysLeft,
    overdueDays: daysLeft < 0 ? -daysLeft : 0,
    daysToStart: Math.max(daysToStart, 0),
  }
}
