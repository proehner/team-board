import { addDays, format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { Sprint, SprintSettings } from '@/types'

// ─── Sprint naming & scheduling ───────────────────────────────────────────────
// Sprint names follow a configurable pattern, by default "{YYYY}_{KW1}_{KW2}"
// (e.g. "2026_38_39"): the ISO week year followed by the calendar weeks the
// sprint spans. Sprints start on a configurable weekday (default Monday) and
// end on a configurable weekday of the last week (default Friday).

export const DEFAULT_SPRINT_SETTINGS: SprintSettings = {
  namePattern:   '{YYYY}_{KW1}_{KW2}',
  durationWeeks: 2,
  startWeekday:  1,
  endWeekday:    5,
}

/** Placeholders supported in `namePattern`, used for the settings help text. */
export const SPRINT_NAME_PLACEHOLDERS = ['{YYYY}', '{YY}', '{KW1}', '{KW2}', '{NR}'] as const

const toISO = (d: Date): string => format(d, 'yyyy-MM-dd')

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
const isoWeekday = (d: Date): number => (d.getDay() === 0 ? 7 : d.getDay())

/** Moves a date to the given ISO weekday within its own ISO week (Mon–Sun). */
const snapToWeekday = (d: Date, weekday: number): Date => addDays(d, weekday - isoWeekday(d))

/** Number of days a sprint spans, from its start weekday to its end weekday. */
function sprintSpanDays(settings: SprintSettings): number {
  const weeks = Math.max(1, settings.durationWeeks)
  const withinWeek = (settings.endWeekday - settings.startWeekday + 7) % 7
  return (weeks - 1) * 7 + withinWeek
}

/** End date (ISO) of a sprint starting on `startISO`, per the configuration. */
export function sprintEndDate(startISO: string, settings: SprintSettings): string {
  if (!startISO) return ''
  try {
    return toISO(addDays(parseISO(startISO), sprintSpanDays(settings)))
  } catch {
    return ''
  }
}

/**
 * Builds a sprint name from the configured pattern.
 * `{KWn}` is the calendar week of the n-th week of the sprint, `{YYYY}` /
 * `{YY}` the ISO week year of the first week, `{NR}` a sequential number.
 */
export function buildSprintName(startISO: string, settings: SprintSettings, sprintNumber = 1): string {
  if (!startISO) return ''
  let start: Date
  try {
    start = parseISO(startISO)
    if (isNaN(start.getTime())) return ''
  } catch {
    return ''
  }

  return settings.namePattern
    .replace(/\{KW(\d+)\}/g, (_m, n: string) => {
      const week = getISOWeek(addDays(start, (Math.max(1, Number(n)) - 1) * 7))
      return String(week).padStart(2, '0')
    })
    .replace(/\{YYYY\}/g, String(getISOWeekYear(start)))
    .replace(/\{YY\}/g, String(getISOWeekYear(start)).slice(-2))
    .replace(/\{NR\}/g, String(sprintNumber))
}

export interface SprintSuggestion {
  name: string
  startDate: string
  endDate: string
}

/**
 * Suggests the sprint following the most recent one: it continues directly
 * after the latest sprint's start date, snapped to the configured start
 * weekday. Sprints that already lie in the past (or whose slot is taken) are
 * skipped, so the suggestion is always the current or next upcoming sprint.
 */
export function suggestNextSprint(
  sprints: Sprint[],
  settings: SprintSettings,
  today: Date = new Date(),
): SprintSuggestion {
  const weeks = Math.max(1, settings.durationWeeks)
  const span  = sprintSpanDays(settings)
  const todayISO = toISO(today)

  const latest = sprints
    .filter((s) => !!s.startDate)
    .reduce<Sprint | null>((acc, s) => (!acc || s.startDate > acc.startDate ? s : acc), null)

  let start: Date
  if (latest) {
    // Continue the cadence: one sprint length after the latest sprint's start.
    start = snapToWeekday(addDays(parseISO(latest.startDate), weeks * 7), settings.startWeekday)
  } else {
    // No sprints yet → start in the current week.
    start = snapToWeekday(today, settings.startWeekday)
  }

  const usedStarts = new Set(sprints.map((s) => s.startDate))
  const usedNames  = new Set(sprints.map((s) => s.name))

  // Skip slots that are already over or already taken (max. ~5 years of slots).
  for (let i = 0; i < 130; i++) {
    const startISO = toISO(start)
    const endISO   = toISO(addDays(start, span))
    const name     = buildSprintName(startISO, settings, sprints.length + 1)
    const isPast   = endISO < todayISO
    if (!isPast && !usedStarts.has(startISO) && !usedNames.has(name)) {
      return { name, startDate: startISO, endDate: endISO }
    }
    start = addDays(start, weeks * 7)
  }

  const startISO = toISO(start)
  return {
    name: buildSprintName(startISO, settings, sprints.length + 1),
    startDate: startISO,
    endDate: toISO(addDays(start, span)),
  }
}
