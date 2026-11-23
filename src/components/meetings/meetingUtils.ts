import type { TFunction } from 'i18next'
import type { Meeting } from '@/types'

/** Index = JS weekday (0 = Sunday) — matches `Meeting.dayOfWeek`. */
export const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/** Display order for weekday pickers (Monday first). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function weekdayLabel(t: TFunction, day: number) {
  return t(`meetings.days.${DAY_KEYS[day]}`)
}

export function weekdayShort(t: TFunction, day: number) {
  return t(`meetings.daysShort.${DAY_KEYS[day]}`)
}

export function formatSchedule(t: TFunction, m: Pick<Meeting, 'dayOfWeek' | 'meetingTime'>) {
  const parts: string[] = []
  if (m.dayOfWeek != null) parts.push(weekdayLabel(t, m.dayOfWeek))
  if (m.meetingTime) parts.push(m.meetingTime)
  return parts.join(', ')
}

/** True when the meeting certainly takes place today (daily, or weekly on today's weekday). */
export function isMeetingToday(m: Pick<Meeting, 'recurrence' | 'dayOfWeek'>, now = new Date()) {
  if (m.recurrence === 'daily') return now.getDay() !== 0 && now.getDay() !== 6
  if (m.recurrence === 'weekly') return m.dayOfWeek === now.getDay()
  return false
}

/** Sort key: weekday (Mon→Sun, none last), then time, then title. */
export function compareMeetings(a: Meeting, b: Meeting) {
  const da = a.dayOfWeek == null ? 99 : WEEKDAY_ORDER.indexOf(a.dayOfWeek)
  const db = b.dayOfWeek == null ? 99 : WEEKDAY_ORDER.indexOf(b.dayOfWeek)
  if (da !== db) return da - db
  const ta = a.meetingTime ?? '99:99'
  const tb = b.meetingTime ?? '99:99'
  if (ta !== tb) return ta.localeCompare(tb)
  return a.title.localeCompare(b.title)
}
