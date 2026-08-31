import { describe, it, expect } from 'vitest'
import { dateTone, toneClass } from './epicDateTone'
import { subtractWorkingDaysH } from './workingDayUtils'

// วันนี้สมมติ = ศุกร์ 21 ส.ค. 2026
const TODAY = '2026-08-21'
// ย้อน 3 วันทำการจากศุกร์ → อังคาร 18 ส.ค. (ข้ามเสาร์-อาทิตย์ไม่มีในช่วงนี้)
const WARN_FROM = '2026-08-18'

describe('สีของวันที่ในตาราง Epic', () => {
  it('วันนี้ → ส้ม', () => {
    expect(dateTone(TODAY, TODAY, WARN_FROM)).toBe('orange')
  })

  it('อนาคต → แดง (กลับทางกับ traffic light ทั่วไปโดยเจตนา)', () => {
    expect(dateTone('2026-08-22', TODAY, WARN_FROM)).toBe('red')
    expect(dateTone('2026-09-15', TODAY, WARN_FROM)).toBe('red')
    expect(dateTone('2027-01-01', TODAY, WARN_FROM)).toBe('red')
  })

  it('เพิ่งผ่านมาไม่เกิน 3 วันทำการ → เหลือง', () => {
    expect(dateTone('2026-08-20', TODAY, WARN_FROM)).toBe('yellow')
    expect(dateTone('2026-08-19', TODAY, WARN_FROM)).toBe('yellow')
    expect(dateTone(WARN_FROM,    TODAY, WARN_FROM)).toBe('yellow')   // ขอบพอดี = รวมด้วย
  })

  it('เก่ากว่า 3 วันทำการ → ปกติ', () => {
    expect(dateTone('2026-08-17', TODAY, WARN_FROM)).toBeNull()
    expect(dateTone('2026-02-05', TODAY, WARN_FROM)).toBeNull()
  })

  it('ไม่มีวันที่ → ปกติ ไม่ throw', () => {
    expect(dateTone(null,      TODAY, WARN_FROM)).toBeNull()
    expect(dateTone(undefined, TODAY, WARN_FROM)).toBeNull()
    expect(dateTone('',        TODAY, WARN_FROM)).toBeNull()
  })

  it('ลำดับความสำคัญ: วันนี้ชนะ "อนาคต" และชนะ "เพิ่งผ่านมา" เสมอ', () => {
    // ถ้าเรียงเงื่อนไขผิด วันนี้จะตกไปเป็นเหลือง เพราะ today >= warnFrom ก็จริง
    expect(dateTone(TODAY, TODAY, TODAY)).toBe('orange')
  })

  it('ทุกสีมี class ของตัวเอง และไม่มีสีไหนได้ class ว่าง', () => {
    for (const tone of ['red', 'orange', 'yellow'] as const) {
      expect(toneClass(tone).length).toBeGreaterThan(0)
      expect(toneClass(tone)).toContain('dark:')   // ต้องรองรับ dark mode ด้วย
    }
    expect(toneClass(null)).toBe('')
  })

  it('สามสีต้องไม่ซ้ำ class กัน', () => {
    const classes = (['red', 'orange', 'yellow'] as const).map(toneClass)
    expect(new Set(classes).size).toBe(3)
  })
})

describe('การนับ 3 วันทำการย้อนหลัง', () => {
  const noHolidays = new Set<string>()
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  it('จากวันจันทร์ ย้อน 3 วันทำการ ต้องข้ามเสาร์-อาทิตย์', () => {
    // จันทร์ 24 ส.ค. 2026 → ศุกร์ 21, พฤหัส 20, พุธ 19
    const monday = new Date('2026-08-24T00:00:00')
    expect(iso(subtractWorkingDaysH(monday, 3, noHolidays))).toBe('2026-08-19')
  })

  it('วันหยุดนักขัตฤกษ์ถูกข้ามด้วย', () => {
    const monday = new Date('2026-08-24T00:00:00')
    // ทำให้ศุกร์ 21 เป็นวันหยุด → ต้องเลื่อนไปอังคาร 18
    const holidays = new Set(['2026-08-21'])
    expect(iso(subtractWorkingDaysH(monday, 3, holidays))).toBe('2026-08-18')
  })
})
