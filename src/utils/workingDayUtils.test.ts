import { describe, it, expect } from 'vitest'
import {
  isWorkingDay,
  subtractWorkingDaysH,
  addWorkingDaysH,
  getWorkingDaysRange,
  getWorkingDaysBetween,
} from './workingDayUtils'

const NO_HOLIDAYS = new Set<string>()

// ─── isWorkingDay ─────────────────────────────────────────────────────────────

describe('isWorkingDay', () => {
  it('returns true for a regular Monday', () => {
    expect(isWorkingDay(new Date('2026-05-11'), NO_HOLIDAYS)).toBe(true)
  })

  it('returns false for Saturday', () => {
    expect(isWorkingDay(new Date('2026-05-09'), NO_HOLIDAYS)).toBe(false)
  })

  it('returns false for Sunday', () => {
    expect(isWorkingDay(new Date('2026-05-10'), NO_HOLIDAYS)).toBe(false)
  })

  it('returns false for a weekday that is a public holiday', () => {
    const holidays = new Set(['2026-05-11'])  // Monday declared as holiday
    expect(isWorkingDay(new Date('2026-05-11'), holidays)).toBe(false)
  })

  it('returns true for a weekday not in holidays', () => {
    const holidays = new Set(['2026-05-12'])  // different day
    expect(isWorkingDay(new Date('2026-05-11'), holidays)).toBe(true)
  })
})

// ─── subtractWorkingDaysH ─────────────────────────────────────────────────────

describe('subtractWorkingDaysH', () => {
  it('skips weekends — spec example: June 1 − 10 workdays = May 18', () => {
    const result = subtractWorkingDaysH(new Date('2026-06-01'), 10, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-18')
  })

  it('1 workday back from Monday = previous Friday', () => {
    const result = subtractWorkingDaysH(new Date('2026-05-11'), 1, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-08')
  })

  it('rounds fractional days up: 2.5 → 3 workdays', () => {
    const result = subtractWorkingDaysH(new Date('2026-05-13'), 2.5, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-08')
  })

  it('skips a holiday day in addition to weekends', () => {
    // May 18 would normally be the result, but declare it a holiday
    // → should land on May 15 (Friday) instead
    const holidays = new Set(['2026-05-18'])
    const result = subtractWorkingDaysH(new Date('2026-06-01'), 10, holidays)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-15')
  })

  it('skips multiple holidays', () => {
    // 1 workday back from May 13 (Wed); May 12 and May 11 are both holidays
    const holidays = new Set(['2026-05-12', '2026-05-11'])
    const result = subtractWorkingDaysH(new Date('2026-05-13'), 1, holidays)
    // May 12 skipped (holiday), May 11 skipped (holiday), lands on May 8 (Fri)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-08')
  })

  it('0 days returns same date', () => {
    const result = subtractWorkingDaysH(new Date('2026-05-20'), 0, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-20')
  })

  it('crosses month boundary correctly', () => {
    const result = subtractWorkingDaysH(new Date('2026-05-05'), 5, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-28')
  })
})

// ─── addWorkingDaysH ──────────────────────────────────────────────────────────

describe('addWorkingDaysH', () => {
  it('1 workday forward from Friday = next Monday', () => {
    const result = addWorkingDaysH(new Date('2026-05-08'), 1, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-11')
  })

  it('skips weekend when adding days', () => {
    // From Thursday May 7 + 2 workdays → skips Sat/Sun → Mon May 11
    const result = addWorkingDaysH(new Date('2026-05-07'), 2, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-11')
  })

  it('skips a holiday when adding days', () => {
    // From Friday May 8 + 1 workday → Mon May 11 but it's a holiday → Tue May 12
    const holidays = new Set(['2026-05-11'])
    const result = addWorkingDaysH(new Date('2026-05-08'), 1, holidays)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-12')
  })

  it('fractional days ceil: 1.5 → 2 workdays', () => {
    // From Mon May 11 + 2 workdays → Wed May 13
    const result = addWorkingDaysH(new Date('2026-05-11'), 1.5, NO_HOLIDAYS)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-13')
  })
})

// ─── getWorkingDaysRange ──────────────────────────────────────────────────────

describe('getWorkingDaysRange', () => {
  it('returns only Mon–Fri in a one-week range', () => {
    // May 11 (Mon) to May 17 (Sun) → Mon–Fri = 5 days
    const days = getWorkingDaysRange(new Date('2026-05-11'), new Date('2026-05-17'), NO_HOLIDAYS)
    expect(days).toEqual([
      '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
    ])
  })

  it('excludes holiday from range', () => {
    const holidays = new Set(['2026-05-13'])  // Wed
    const days = getWorkingDaysRange(new Date('2026-05-11'), new Date('2026-05-15'), holidays)
    expect(days).toEqual(['2026-05-11', '2026-05-12', '2026-05-14', '2026-05-15'])
  })

  it('returns empty array when start > end', () => {
    const days = getWorkingDaysRange(new Date('2026-05-15'), new Date('2026-05-11'), NO_HOLIDAYS)
    expect(days).toEqual([])
  })

  it('returns single day for same start/end on a weekday', () => {
    const days = getWorkingDaysRange(new Date('2026-05-11'), new Date('2026-05-11'), NO_HOLIDAYS)
    expect(days).toEqual(['2026-05-11'])
  })

  it('returns empty for same start/end on weekend', () => {
    const days = getWorkingDaysRange(new Date('2026-05-09'), new Date('2026-05-09'), NO_HOLIDAYS)
    expect(days).toEqual([])
  })
})

// ─── getWorkingDaysBetween ────────────────────────────────────────────────────

describe('getWorkingDaysBetween', () => {
  it('counts 5 working days in Mon–Fri week', () => {
    expect(getWorkingDaysBetween(new Date('2026-05-11'), new Date('2026-05-15'), NO_HOLIDAYS)).toBe(5)
  })

  it('excludes holiday from count', () => {
    const holidays = new Set(['2026-05-13'])
    expect(getWorkingDaysBetween(new Date('2026-05-11'), new Date('2026-05-15'), holidays)).toBe(4)
  })

  it('returns 0 when range starts after end', () => {
    expect(getWorkingDaysBetween(new Date('2026-05-15'), new Date('2026-05-11'), NO_HOLIDAYS)).toBe(0)
  })
})
