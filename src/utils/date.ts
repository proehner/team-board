import { format, parseISO, differenceInDays, isWithinInterval, addDays } from 'date-fns'
import { de } from 'date-fns/locale'

export const formatDate = (iso: string): string =>
  format(parseISO(iso), 'dd. MMM yyyy', { locale: de })

export const formatDateShort = (iso: string): string =>
  format(parseISO(iso), 'dd.MM.yyyy')

export const formatDateInput = (iso: string): string => iso.substring(0, 10)

export const sprintDurationDays = (start: string, end: string): number =>
  differenceInDays(parseISO(end), parseISO(start)) + 1

export const isCurrentlyActive = (start: string, end: string): boolean => {
  const now = new Date()
  try {
    return isWithinInterval(now, { start: parseISO(start), end: parseISO(end) })
  } catch {
    return false
  }
}

export const isUpcoming = (start: string, daysAhead = 30): boolean => {
  const now = new Date()
  const s = parseISO(start)
  return s >= now && s <= addDays(now, daysAhead)
}

export const todayISO = (): string => new Date().toISOString().split('T')[0]

export const daysUntil = (iso: string): number =>
  differenceInDays(parseISO(iso), new Date())

export const isOverdue = (iso: string): boolean => daysUntil(iso) < 0
