// ─── Calendar helpers in Europe/Berlin (month ends, calendar years) ──────────

const berlinParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

/** Offset of Europe/Berlin to UTC at the given instant (ms, e.g. +1h / +2h). */
export function berlinOffset(t: number): number {
  const p = Object.fromEntries(berlinParts.formatToParts(t).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000
}

/** First instant of the given month in Europe/Berlin (month may overflow, e.g. 12 → January next year). */
export function berlinMonthStart(year: number, month: number): number {
  const utc = Date.UTC(year, month, 1)
  return utc - berlinOffset(utc)
}

/** The last `count` month ends (Europe/Berlin) that lie before `at`, oldest first. */
export function monthEndsBefore(at: number, count: number): { date: string; at: number }[] {
  const local = new Date(at + berlinOffset(at))
  const result: { date: string; at: number }[] = []
  for (let i = 0; result.length < count && i <= count; i++) {
    const end = berlinMonthStart(local.getUTCFullYear(), local.getUTCMonth() - i) - 1
    if (end >= at) continue
    const d = new Date(end + berlinOffset(end))
    result.push({ date: d.toISOString().slice(0, 10), at: end })
  }
  return result.reverse()
}


/** Calendar date (yyyy-MM-dd) of an instant in Europe/Berlin. */
export function berlinDate(t: number): string {
  return new Date(t + berlinOffset(t)).toISOString().slice(0, 10)
}

/** Year and month (0-based) of an instant in Europe/Berlin. */
export function berlinYearMonth(t: number): { year: number; month: number } {
  const d = new Date(t + berlinOffset(t))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() }
}
