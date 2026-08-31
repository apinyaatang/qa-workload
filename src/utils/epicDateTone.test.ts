import { describe, it, expect } from 'vitest'
import { dateTone, toneClass, localIsoDate, utcDateFromIso } from './epicDateTone'
import { addWorkingDaysH } from './workingDayUtils'

// วันนี้สมมติ = จันทร์ 31 ส.ค. 2026
const TODAY = '2026-08-31'
// ไปข้างหน้า 3 วันทำการ → พฤหัส 3 ก.ย.
const WARN_UNTIL = '2026-09-03'

describe('สีของวันที่ในตาราง Epic', () => {
  it('วันนี้ → ส้ม', () => {
    expect(dateTone(TODAY, TODAY, WARN_UNTIL)).toBe('orange')
  })

  it('เลยกำหนดแล้ว → แดง', () => {
    expect(dateTone('2026-08-30', TODAY, WARN_UNTIL)).toBe('red')
    expect(dateTone('2026-08-20', TODAY, WARN_UNTIL)).toBe('red')
    expect(dateTone('2026-01-28', TODAY, WARN_UNTIL)).toBe('red')
  })

  it('ใกล้ครบกำหนดไม่เกิน 3 วันทำการ → เหลือง', () => {
    expect(dateTone('2026-09-01', TODAY, WARN_UNTIL)).toBe('yellow')
    expect(dateTone('2026-09-02', TODAY, WARN_UNTIL)).toBe('yellow')
    expect(dateTone(WARN_UNTIL,   TODAY, WARN_UNTIL)).toBe('yellow')   // ขอบพอดี = รวมด้วย
  })

  it('อนาคตไกล → ปกติ ไม่ใช่แดง', () => {
    // เคสที่เคยผิด: วันที่ยังมาไม่ถึงถูกทำเป็นแดงทั้งหมด
    expect(dateTone('2026-09-04', TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone('2026-09-20', TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone('2026-09-22', TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone('2026-10-01', TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone('2027-12-31', TODAY, WARN_UNTIL)).toBeNull()
  })

  it('ไม่มีวันที่ → ปกติ ไม่ throw', () => {
    expect(dateTone(null,      TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone(undefined, TODAY, WARN_UNTIL)).toBeNull()
    expect(dateTone('',        TODAY, WARN_UNTIL)).toBeNull()
  })

  it('ลำดับความสำคัญ: วันนี้ชนะทั้งแดงและเหลืองเสมอ', () => {
    // ถ้าเรียงเงื่อนไขผิด วันนี้จะตกไปเป็นเหลือง เพราะ today <= warnUntil ก็จริง
    expect(dateTone(TODAY, TODAY, TODAY)).toBe('orange')
  })

  it('ความเร่งด่วนไล่จาก แดง(อดีต) > ส้ม(วันนี้) > เหลือง(ใกล้) > ปกติ(ไกล)', () => {
    const seq = ['2026-08-28', TODAY, '2026-09-02', '2026-10-01']
    expect(seq.map(d => dateTone(d, TODAY, WARN_UNTIL)))
      .toEqual(['red', 'orange', 'yellow', null])
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

describe('การนับ 3 วันทำการไปข้างหน้า', () => {
  const noHolidays = new Set<string>()
  // workingDayUtils คิดด้วย UTC ทั้งหมด — เข้า UTC ออก UTC
  const warnUntil = (fromIso: string, holidays = noHolidays) =>
    addWorkingDaysH(utcDateFromIso(fromIso), 3, holidays).toISOString().slice(0, 10)

  it('จากจันทร์ 31 ส.ค. ไป 3 วันทำการ = พฤหัส 3 ก.ย.', () => {
    expect(warnUntil('2026-08-31')).toBe(WARN_UNTIL)
  })

  it('จากศุกร์ ต้องข้ามเสาร์-อาทิตย์', () => {
    // ศุกร์ 28 ส.ค. → จันทร์ 31, อังคาร 1, พุธ 2
    expect(warnUntil('2026-08-28')).toBe('2026-09-02')
  })

  it('วันหยุดนักขัตฤกษ์ถูกข้ามด้วย', () => {
    // อังคาร 1 ก.ย. เป็นวันหยุด → จันทร์ 31 นับ อังคาร(ข้าม) พุธ พฤหัส ศุกร์
    expect(warnUntil('2026-08-31', new Set(['2026-09-01']))).toBe('2026-09-04')
  })
})

describe('วันที่ตามเวลาท้องถิ่น (บั๊ก timezone)', () => {
  it('localIsoDate ให้วันตามเครื่อง ไม่ใช่ตาม UTC', () => {
    // 30 ส.ค. 17:30 UTC = 31 ส.ค. 00:30 ที่ไทย (UTC+7)
    // toISOString จะให้ 2026-08-30 ซึ่งผิดไป 1 วันสำหรับผู้ใช้ในไทย
    const d = new Date(2026, 7, 31, 0, 30, 0)   // สร้างด้วยเวลาท้องถิ่นเสมอ
    expect(localIsoDate(d)).toBe('2026-08-31')
  })

  it('utcDateFromIso ให้เที่ยงคืน UTC พอดี', () => {
    expect(utcDateFromIso('2026-08-31').toISOString()).toBe('2026-08-31T00:00:00.000Z')
  })

  it('ไป-กลับแล้วได้วันเดิม', () => {
    for (const iso of ['2026-01-01', '2026-08-31', '2026-12-31']) {
      expect(utcDateFromIso(iso).toISOString().slice(0, 10)).toBe(iso)
    }
  })
})
