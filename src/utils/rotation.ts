import { addDays, parseISO } from 'date-fns'
import { chronological, localTodayISO, toISODate } from '@/utils/sprint'
import { sprintWorkingDays } from '@/utils/capacity'
import type { ResponsibilityAssignment, ResponsibilityTypeConfig, Sprint, TeamMember } from '@/types'

export type AssignmentStatus = 'active' | 'upcoming' | 'ended'

export interface Period {
  startDate: string
  endDate: string
}

const DEFAULT_PERIOD_DAYS = 14

export function assignmentStatus(a: Period, today = localTodayISO()): AssignmentStatus {
  if (a.endDate < today) return 'ended'
  if (a.startDate > today) return 'upcoming'
  return 'active'
}

export const periodsOverlap = (a: Period, b: Period): boolean => a.startDate <= b.endDate && a.endDate >= b.startDate

/** Synthetic entries are technical helpers and never count as a real assignment. */
const realAssignments = (assignments: ResponsibilityAssignment[]) => assignments.filter((a) => !a.isSynthetic)

/** Real assignments overlapping a period, optionally restricted to one type. */
export function assignmentsOverlapping(
  assignments: ResponsibilityAssignment[],
  period: Period,
  { type, excludeId }: { type?: string; excludeId?: string } = {},
): ResponsibilityAssignment[] {
  return realAssignments(assignments).filter((a) =>
    a.id !== excludeId && (type === undefined || a.type === type) && periodsOverlap(a, period),
  )
}

/** Sprints still to be staffed: not over, not completed, not cancelled – in chronological order. */
export function openSprints(sprints: Sprint[], today = localTodayISO()): Sprint[] {
  return chronological(sprints).filter((s) => s.endDate >= today && (s.status === 'Geplant' || s.status === 'Aktiv'))
}

/** First open sprint in which the responsibility isn't assigned yet. */
export function nextOpenSprint(sprints: Sprint[], assignments: ResponsibilityAssignment[], type: string): Sprint | undefined {
  return openSprints(sprints).find((s) => assignmentsOverlapping(assignments, s, { type }).length === 0)
}

/** Two weeks following the last assignment (of the type, if given) – fallback when there's no open sprint. */
export function nextFreePeriod(assignments: ResponsibilityAssignment[], type?: string): Period {
  const today = localTodayISO()
  const lastEnd = realAssignments(assignments)
    .filter((a) => type === undefined || a.type === type)
    .reduce((max, a) => (a.endDate > max ? a.endDate : max), '')
  const startDate = lastEnd >= today ? toISODate(addDays(parseISO(lastEnd), 1)) : today
  return { startDate, endDate: toISODate(addDays(parseISO(startDate), DEFAULT_PERIOD_DAYS - 1)) }
}

export interface Candidate {
  member: TeamMember
  count: number          // how often the member already had this responsibility (archived ones included)
  excluded: boolean      // doesn't take part in this rotation
  daysOff: number        // absence within the sprint, from the capacity planning
  mostlyAbsent: boolean  // absent for at least half of the sprint
  otherDuties: string[]  // other responsibilities in the same period
}

/**
 * All active members, best candidate first: participants before excluded
 * members, then present before mostly absent, fewest parallel duties in that
 * period, then fewest times on duty and longest time since the last one.
 */
export function rankCandidates({ type, members, assignments, period, sprint, reserved }: {
  type: ResponsibilityTypeConfig
  members: TeamMember[]
  assignments: ResponsibilityAssignment[]
  period?: Period
  sprint?: Sprint
  /** Duties already picked for members in the same planning round (memberId → type names). */
  reserved?: Map<string, string[]>
}): Candidate[] {
  const history = realAssignments(assignments).filter((a) => a.type === type.name)
  const sameTime = period ? assignmentsOverlapping(assignments, period).filter((a) => a.type !== type.name && !a.isArchived) : []
  const workingDays = sprint ? sprintWorkingDays(sprint) : 0

  const ranked = members.filter((m) => m.isActive).map((member) => {
    const own = history.filter((a) => a.memberId === member.id)
    const daysOff = sprint?.capacity.find((c) => c.memberId === member.id)?.daysOff ?? 0
    return {
      member,
      count: own.length,
      lastEnd: own.reduce((max, a) => (a.endDate > max ? a.endDate : max), ''),
      excluded: type.excludedMemberIds.includes(member.id),
      daysOff,
      mostlyAbsent: workingDays > 0 && daysOff * 2 >= workingDays,
      otherDuties: [
        ...sameTime.filter((a) => a.memberId === member.id).map((a) => a.type),
        ...(reserved?.get(member.id) ?? []),
      ],
    }
  })

  ranked.sort((a, b) =>
    Number(a.excluded) - Number(b.excluded)
    || Number(a.mostlyAbsent) - Number(b.mostlyAbsent)
    || a.otherDuties.length - b.otherDuties.length
    || a.count - b.count
    || a.lastEnd.localeCompare(b.lastEnd)
    || a.member.name.localeCompare(b.member.name),
  )
  return ranked.map(({ lastEnd: _lastEnd, ...c }) => c)
}

/** The suggested member: best ranked participant, if any. */
export const suggestedCandidate = (ranked: Candidate[]): Candidate | undefined => ranked.find((c) => !c.excluded)
