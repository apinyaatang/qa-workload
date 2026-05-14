import { describe, it, expect } from 'vitest'
import {
  subtractWorkingDays,
  calcTestDate,
  getBaseDate,
  cleanProjectName,
  parseCsvDate,
  parsePlanningCsv,
} from './planningCsvParser'

// ─── subtractWorkingDays ──────────────────────────────────────────────────────

describe('subtractWorkingDays', () => {
  it('matches the spec example: June 1 - 10 days = May 18', () => {
    const uat    = new Date('2026-06-01')   // Monday
    const result = subtractWorkingDays(uat, 10)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-18')
  })

  it('skips exactly the 4 weekends days in the spec example', () => {
    // May 23-24, May 30-31 = 4 weekend days between May 18 and June 1
    const uat    = new Date('2026-06-01')
    const result = subtractWorkingDays(uat, 10)
    const skipped = countWeekendDays(result, uat)
    expect(skipped).toBe(4)
  })

  it('1 working day back from Monday = previous Friday', () => {
    const mon    = new Date('2026-05-11')   // Monday
    const result = subtractWorkingDays(mon, 1)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-08')  // Friday
  })

  it('rounds fractional days up: 2.5 → 3 working days', () => {
    const wed    = new Date('2026-05-13')   // Wednesday
    const result = subtractWorkingDays(wed, 2.5)
    // 3 days back: Tue, Mon, Fri = May 8 (Fri)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-08')
  })

  it('handles 0 days — returns same date', () => {
    const date   = new Date('2026-05-20')
    const result = subtractWorkingDays(date, 0)
    expect(result.toISOString().slice(0, 10)).toBe('2026-05-20')
  })

  it('crosses month boundary correctly', () => {
    // 5 working days back from May 5 (Tue) should be Apr 28 (Tue)
    const may5   = new Date('2026-05-05')
    const result = subtractWorkingDays(may5, 5)
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-28')
  })
})

// ─── calcTestDate ─────────────────────────────────────────────────────────────

describe('calcTestDate', () => {
  it('returns correct ISO date — UAT Date present', () => {
    expect(calcTestDate('2026-06-01', null, 10)).toBe('2026-05-18')
  })

  it('returns null when both uatDate and goLiveDate are null', () => {
    expect(calcTestDate(null, null, 10)).toBeNull()
  })

  it('returns null when estimateDays is null', () => {
    expect(calcTestDate('2026-06-01', null, null)).toBeNull()
  })

  it('returns null when estimateDays is 0', () => {
    expect(calcTestDate('2026-06-01', null, 0)).toBeNull()
  })

  it('handles fractional estimate (2.5 → 3 days)', () => {
    const result = calcTestDate('2026-05-13', null, 2.5)   // Wed - 3 days
    expect(result).toBe('2026-05-08')
  })

  // ── Fallback: UAT Date null → use Go Live Date ────────────────────────────
  it('falls back to goLiveDate when uatDate is null', () => {
    // goLiveDate = June 1, estimate = 10 → same result as UAT version
    expect(calcTestDate(null, '2026-06-01', 10)).toBe('2026-05-18')
  })

  it('prefers uatDate over goLiveDate when both are present', () => {
    // UAT = June 1 (10 days → May 18), GoLive = June 15 (10 days → Jun 1)
    // Should use UAT
    expect(calcTestDate('2026-06-01', '2026-06-15', 10)).toBe('2026-05-18')
  })

  it('returns null when both dates are null even with valid estimate', () => {
    expect(calcTestDate(null, null, 5)).toBeNull()
  })

  // ── Holiday awareness ─────────────────────────────────────────────────────
  it('skips a holiday in the working-day count', () => {
    // Without holiday: June 1 - 10 = May 18
    // With May 18 as holiday: should land on May 15 instead
    const holidays = new Set(['2026-05-18'])
    expect(calcTestDate('2026-06-01', null, 10, holidays)).toBe('2026-05-15')
  })
})

// ─── getBaseDate ──────────────────────────────────────────────────────────────

describe('getBaseDate', () => {
  it('returns uatDate when it is present', () => {
    expect(getBaseDate('2026-06-01', '2026-06-15')).toBe('2026-06-01')
  })

  it('returns goLiveDate when uatDate is null', () => {
    expect(getBaseDate(null, '2026-06-15')).toBe('2026-06-15')
  })

  it('returns null when both are null', () => {
    expect(getBaseDate(null, null)).toBeNull()
  })

  it('returns uatDate even when goLiveDate is null', () => {
    expect(getBaseDate('2026-06-01', null)).toBe('2026-06-01')
  })
})

// ─── cleanProjectName ─────────────────────────────────────────────────────────

describe('cleanProjectName', () => {
  it('strips Buzzebees\\ prefix', () => {
    expect(cleanProjectName('Buzzebees\\Project\\AIA Club')).toBe('Project\\AIA Club')
  })

  it('is case-insensitive for the prefix', () => {
    expect(cleanProjectName('buzzebees\\ProjectX')).toBe('ProjectX')
    expect(cleanProjectName('BUZZEBEES\\ProjectX')).toBe('ProjectX')
  })

  it('leaves names without the prefix unchanged', () => {
    expect(cleanProjectName('My Project')).toBe('My Project')
  })

  it('trims surrounding whitespace', () => {
    expect(cleanProjectName('  Buzzebees\\ProjectX  ')).toBe('ProjectX')
  })

  it('handles empty string', () => {
    expect(cleanProjectName('')).toBe('')
  })
})

// ─── parseCsvDate ─────────────────────────────────────────────────────────────

describe('parseCsvDate', () => {
  it('parses M/D/YYYY', () => {
    expect(parseCsvDate('2/11/2026')).toBe('2026-02-11')
  })

  it('parses MM/DD/YYYY', () => {
    expect(parseCsvDate('05/19/2026')).toBe('2026-05-19')
  })

  it('returns null for empty string', () => {
    expect(parseCsvDate('')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(parseCsvDate('13/32/2026')).toBeNull()
  })

  it('returns null for wrong format', () => {
    expect(parseCsvDate('2026-05-19')).toBeNull()
  })

  it('parses single-digit month/day', () => {
    expect(parseCsvDate('5/7/2026')).toBe('2026-05-07')
  })
})

// ─── parsePlanningCsv ─────────────────────────────────────────────────────────

describe('parsePlanningCsv', () => {
  //                                              [Iteration,Proj name,ItemType,Feature,Tags,Status,TestBuddy,Priority,Tester,GoLive,UAT,Testing%,TesterFlag,TesterNote,TestingDate,TestingEnd,Estimate,Remark,PM,BANote,QuotNo,FinishTo,StartDate,PMOBuddy,EpicNo,ID]
  const VALID_CSV = [
    'Iteration,Project name,Item Type,Feature,Tags,Status,Test Buddy,Priority,Tester,Go Live Date,UAT Date,Testing (%),Tester flag,Tester Note,Testing Date,Testing End date,Test Estimate (day),Remark to PMOs,PM,BA Note,Quotation No.,Testing Finish to,Testing Start date,PMO Buddy,Epic No.,ID',
    '225,My Project,New,Feature A,tag1,Active,Lead Person,High,Tester A,6/10/2026,6/1/2026,50,,,,,10,Remark,PM A,BA Note,QT001,,,Look-pla,,1001',
    '226,Project B,Bug,,tag2,Done,Lead B,Medium,Tester B,,,0,,,,,,,PM B,,,,,  ,,1002',
  ].join('\n')

  it('parses valid rows without errors', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.totalRows).toBe(2)
    expect(result.validRows).toBe(2)
    expect(result.errorRows).toBe(0)
  })

  it('maps Test Buddy → testLead', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.rows[0].data.testLead).toBe('Lead Person')
  })

  it('calculates testDate correctly', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.rows[0].data.testDate).toBe('2026-05-18')
  })

  it('sets testDate null when both UAT Date and Go Live Date are empty', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.rows[1].data.testDate).toBeNull()
  })

  it('flags row with missing ID as invalid', () => {
    const csv = VALID_CSV.split('\n')
    // Remove ID from last row (replace last comma-value with empty)
    const badRow = csv[2].replace(',1002', ',')
    const result = parsePlanningCsv([csv[0], csv[1], badRow].join('\n'))
    expect(result.rows[1].isValid).toBe(false)
    expect(result.rows[1].errors).toContain('ID is required')
  })

  it('flags row with missing Project name as invalid', () => {
    const csv = VALID_CSV.split('\n')
    const badRow = csv[1].replace('My Project', '')
    const result = parsePlanningCsv([csv[0], badRow, csv[2]].join('\n'))
    expect(result.rows[0].isValid).toBe(false)
    expect(result.rows[0].errors).toContain('Project name is required')
  })

  it('converts testingPercent to number', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.rows[0].data.testingPercent).toBe(50)
  })

  it('sets testingPercent to 0 when value is "0"', () => {
    const result = parsePlanningCsv(VALID_CSV)
    expect(result.rows[1].data.testingPercent).toBe(0)
  })

  it('strips Buzzebees\\ prefix from project name during import', () => {
    const csv = [
      'Iteration,Project name,Item Type,Feature,Tags,Status,Test Buddy,Priority,Tester,Go Live Date,UAT Date,Testing (%),Tester flag,Tester Note,Testing Date,Testing End date,Test Estimate (day),Remark to PMOs,PM,BA Note,Quotation No.,Testing Finish to,Testing Start date,PMO Buddy,Epic No.,ID',
      '225,Buzzebees\\My Project,New,,,Active,Lead,High,TesterA,,,0,,,,,,,PM A,,,,,,,1005',
    ].join('\n')
    const result = parsePlanningCsv(csv)
    expect(result.rows[0].data.projectName).toBe('My Project')
  })

  it('uses Go Live Date for testDate when UAT Date is absent', () => {
    // Row with no UAT Date but has Go Live Date = 6/1/2026, estimate = 10
    const csv = [
      'Iteration,Project name,Item Type,Feature,Tags,Status,Test Buddy,Priority,Tester,Go Live Date,UAT Date,Testing (%),Tester flag,Tester Note,Testing Date,Testing End date,Test Estimate (day),Remark to PMOs,PM,BA Note,Quotation No.,Testing Finish to,Testing Start date,PMO Buddy,Epic No.,ID',
      '225,My Project,New,,,Active,Lead,High,TesterA,6/1/2026,,0,,,,,10,,PM A,,,,,,,1006',
    ].join('\n')
    const result = parsePlanningCsv(csv)
    expect(result.rows[0].data.testDate).toBe('2026-05-18')
  })

  it('accepts holidays option and shifts testDate past holidays', () => {
    const csv = [
      'Iteration,Project name,Item Type,Feature,Tags,Status,Test Buddy,Priority,Tester,Go Live Date,UAT Date,Testing (%),Tester flag,Tester Note,Testing Date,Testing End date,Test Estimate (day),Remark to PMOs,PM,BA Note,Quotation No.,Testing Finish to,Testing Start date,PMO Buddy,Epic No.,ID',
      '225,My Project,New,,,Active,Lead,High,TesterA,,6/1/2026,0,,,,,10,,PM A,,,,,,,1007',
    ].join('\n')
    const holidays = new Set(['2026-05-18'])  // normal result would be May 18
    const result = parsePlanningCsv(csv, { holidays })
    expect(result.rows[0].data.testDate).toBe('2026-05-15')
  })
})

// ─── helper ───────────────────────────────────────────────────────────────────

function countWeekendDays(from: Date, to: Date): number {
  let count = 0
  const cursor = new Date(from)
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1)
    const dow = cursor.getDay()
    if (dow === 0 || dow === 6) count++
  }
  return count
}
