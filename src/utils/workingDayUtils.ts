/**
 * workingDayUtils.ts
 * Holiday-aware working-day engine.
 * All functions accept a Set<string> of ISO dates (YYYY-MM-DD) as holidays.
 * Uses UTC millisecond arithmetic to avoid timezone day-boundary issues.
 */

const DAY_MS = 86_400_000

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Returns true if the date is Mon–Fri and not in the holidays set.
 */
export function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  const dow = date.getUTCDay()  // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false
  return !holidays.has(isoFromMs(utcMidnight(date)))
}

/**
 * Subtract N working days going backward from `from`.
 * Fractional days are rounded up (2.5 → 3).
 * Skips weekends and holidays.
 */
export function subtractWorkingDaysH(from: Date, days: number, holidays: Set<string>): Date {
  const workDays = Math.ceil(days)
  let remaining = workDays
  let cursor = utcMidnight(from)

  while (remaining > 0) {
    cursor -= DAY_MS
    const dow = new Date(cursor).getUTCDay()
    const iso = isoFromMs(cursor)
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) remaining--
  }
  return new Date(cursor)
}

/**
 * Add N working days going forward from `from`.
 * Fractional days are rounded up.
 * Skips weekends and holidays.
 */
export function addWorkingDaysH(from: Date, days: number, holidays: Set<string>): Date {
  const workDays = Math.ceil(days)
  let remaining = workDays
  let cursor = utcMidnight(from)

  while (remaining > 0) {
    cursor += DAY_MS
    const dow = new Date(cursor).getUTCDay()
    const iso = isoFromMs(cursor)
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) remaining--
  }
  return new Date(cursor)
}

/**
 * Return every working day (ISO string) in [start, end] inclusive.
 * Used to build the Gantt timeline column list.
 */
export function getWorkingDaysRange(start: Date, end: Date, holidays: Set<string>): string[] {
  const days: string[] = []
  let cursor = utcMidnight(start)
  const endMs = utcMidnight(end)

  while (cursor <= endMs) {
    const dow = new Date(cursor).getUTCDay()
    const iso = isoFromMs(cursor)
    if (dow !== 0 && dow !== 6 && !holidays.has(iso)) days.push(iso)
    cursor += DAY_MS
  }
  return days
}

/**
 * Count working days in [start, end] inclusive.
 */
export function getWorkingDaysBetween(start: Date, end: Date, holidays: Set<string>): number {
  return getWorkingDaysRange(start, end, holidays).length
}
