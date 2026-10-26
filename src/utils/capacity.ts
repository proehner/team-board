import i18n from '@/i18n'
import { countWorkingDays } from '@/utils/date'
import type { CapacityActivity, Sprint, SprintMemberCapacity } from '@/types'

export interface MemberCapacitySummary {
  sprintHoursPerDay: number      // activities that count as sprint capacity (e.g. development)
  otherHoursPerDay: number       // all other activities (reviews, team lead, PO, SM, …)
  unassignedHoursPerDay: number  // hoursPerDay minus all activities; negative = overbooked
  availableDays: number          // sprint working days minus the member's days off
  sprintHours: number            // sprintHoursPerDay × availableDays
  otherHours: number             // otherHoursPerDay × availableDays
}

/** Working days of the sprint (Mon–Fri) minus team days off such as public holidays. */
export function sprintWorkingDays(sprint: Pick<Sprint, 'startDate' | 'endDate' | 'teamDaysOff'>): number {
  return Math.max(0, countWorkingDays(sprint.startDate, sprint.endDate) - sprint.teamDaysOff)
}

export function summarizeMemberCapacity(
  capacity: SprintMemberCapacity,
  activities: CapacityActivity[],
  workingDays: number,
): MemberCapacitySummary {
  let sprintHoursPerDay = 0
  let otherHoursPerDay = 0
  for (const a of activities) {
    const h = capacity.activities[a.id] ?? 0
    if (a.countsToSprint) sprintHoursPerDay += h
    else otherHoursPerDay += h
  }
  const availableDays = Math.max(0, workingDays - capacity.daysOff)
  return {
    sprintHoursPerDay,
    otherHoursPerDay,
    unassignedHoursPerDay: capacity.hoursPerDay - sprintHoursPerDay - otherHoursPerDay,
    availableDays,
    sprintHours: sprintHoursPerDay * availableDays,
    otherHours: otherHoursPerDay * availableDays,
  }
}

/** Total sprint capacity in hours over all (still existing) members of a sprint. */
export function sprintCapacityHours(sprint: Sprint, activities: CapacityActivity[], memberIds: Set<string>): number {
  const workingDays = sprintWorkingDays(sprint)
  return sprint.capacity
    .filter((c) => memberIds.has(c.memberId))
    .reduce((sum, c) => sum + summarizeMemberCapacity(c, activities, workingDays).sprintHours, 0)
}

export const formatNumber = (n: number, maxFractionDigits = 1): string =>
  n.toLocaleString(i18n.language, { maximumFractionDigits: maxFractionDigits })

/** Parses user input like "4,5" or "4.5"; empty input counts as 0. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  const trimmed = input.trim().replace(',', '.')
  if (trimmed === '') return 0
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : null
}
