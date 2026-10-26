import { addDays, differenceInCalendarDays, format, isMonday, isWeekend, nextMonday, parseISO } from 'date-fns'
import { countWorkingDays } from '@/utils/date'
import type { Sprint } from '@/types'

const DEFAULT_SPRINT_WEEKS = 2
const MAX_SPRINT_WEEKS = 6

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd')

/** Today as yyyy-MM-dd in local time (todayISO() in date.ts is UTC-based). */
export const localTodayISO = (): string => toISODate(new Date())

function skipWeekend(d: Date): Date {
  let r = d
  while (isWeekend(r)) r = addDays(r, 1)
  return r
}

/** End date of an n-week sprint: the last weekday before the same weekday n weeks later. */
export function endDateForWeeks(startDate: string, weeks: number): string {
  let end = addDays(parseISO(startDate), weeks * 7 - 1)
  while (isWeekend(end)) end = addDays(end, -1)
  return toISODate(end)
}

/** Number of weeks if the range is a whole-week sprint (as produced by endDateForWeeks), else null. */
export function sprintWeeks(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null
  for (let w = 1; w <= MAX_SPRINT_WEEKS; w++) {
    if (endDateForWeeks(startDate, w) === endDate) return w
  }
  return null
}

/** Moves the end date along with a changed start date, keeping the sprint length. */
export function shiftEndDate(oldStart: string, oldEnd: string, newStart: string): string {
  const weeks = sprintWeeks(oldStart, oldEnd)
  if (weeks) return endDateForWeeks(newStart, weeks)
  const length = differenceInCalendarDays(parseISO(oldEnd), parseISO(oldStart))
  return toISODate(addDays(parseISO(newStart), Math.max(length, 0)))
}

export function chronological(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt))
}

function latestSprint(sprints: Sprint[]): Sprint | undefined {
  return [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt.localeCompare(a.createdAt))[0]
}

/** Increments the last number in the latest sprint's name ("Sprint 41" → "Sprint 42", "S09" → "S10"). */
export function suggestSprintName(sprints: Sprint[]): string {
  const latest = latestSprint(sprints)
  const match = latest?.name.match(/(\d+)(?!.*\d)/)
  if (latest && match && match.index !== undefined) {
    const next = String(Number(match[1]) + 1).padStart(match[1].length, '0')
    return latest.name.slice(0, match.index) + next + latest.name.slice(match.index + match[1].length)
  }
  return `Sprint ${sprints.length + 1}`
}

/** Next sprint starts on the first weekday after the latest sprint and has the same length. */
export function suggestNextSprintDates(sprints: Sprint[]): { startDate: string; endDate: string } {
  const latest = latestSprint(sprints)
  if (!latest) {
    const today = new Date()
    const startDate = toISODate(isMonday(today) ? today : nextMonday(today))
    return { startDate, endDate: endDateForWeeks(startDate, DEFAULT_SPRINT_WEEKS) }
  }
  const startDate = toISODate(skipWeekend(addDays(parseISO(latest.endDate), 1)))
  return { startDate, endDate: shiftEndDate(latest.startDate, latest.endDate, startDate) }
}

/** Non-cancelled sprints whose period overlaps the given range. */
export function overlappingSprints(sprints: Sprint[], startDate: string, endDate: string, excludeId?: string): Sprint[] {
  if (!startDate || !endDate) return []
  return sprints.filter((s) =>
    s.id !== excludeId && s.status !== 'Abgebrochen' && s.startDate <= endDate && s.endDate >= startDate,
  )
}

/** The most recent sprint with capacity data that starts before the given date (fallback: any). */
export function capacitySourceFor(sprints: Sprint[], startDate: string, excludeId?: string): Sprint | undefined {
  const candidates = chronological(sprints).filter((s) => s.id !== excludeId && s.capacity.length > 0)
  return candidates.filter((s) => s.startDate < startDate).pop() ?? candidates.pop()
}

export interface SprintTiming {
  phase: 'upcoming' | 'running' | 'ended'
  workingDays: number
  elapsedWorkingDays: number   // including today
  remainingWorkingDays: number // after today
  daysUntilStart: number       // calendar days, only > 0 while upcoming
}

export function sprintTiming(sprint: Pick<Sprint, 'startDate' | 'endDate'>, today = localTodayISO()): SprintTiming {
  const workingDays = countWorkingDays(sprint.startDate, sprint.endDate)
  if (today < sprint.startDate) {
    return {
      phase: 'upcoming', workingDays, elapsedWorkingDays: 0, remainingWorkingDays: workingDays,
      daysUntilStart: differenceInCalendarDays(parseISO(sprint.startDate), parseISO(today)),
    }
  }
  if (today > sprint.endDate) {
    return { phase: 'ended', workingDays, elapsedWorkingDays: workingDays, remainingWorkingDays: 0, daysUntilStart: 0 }
  }
  const elapsed = countWorkingDays(sprint.startDate, today)
  return { phase: 'running', workingDays, elapsedWorkingDays: elapsed, remainingWorkingDays: workingDays - elapsed, daysUntilStart: 0 }
}
