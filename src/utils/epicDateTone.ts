// ─── สีของวันที่ในตาราง Epic ──────────────────────────────────────────────────
//
// ใช้กับ Test date / UAT Date / Target Date (ไม่รวม SIT Date)
//
// เกณฑ์ที่ตกลงไว้ — เรียงตามลำดับความสำคัญ ตรวจจากเฉพาะเจาะจงที่สุดก่อน:
//
//   วันที่ = วันนี้                       → ส้ม
//   วันที่ > วันนี้                       → แดง   (ยังมาไม่ถึง)
//   วันที่ >= วันนี้ - 3 วันทำการ (และ < วันนี้) → เหลือง (เพิ่งผ่านมา)
//   เก่ากว่านั้น                          → ปกติ
//
// ⚠️ สังเกตว่า "อนาคต = แดง" ซึ่งกลับทางกับ traffic light ทั่วไป
//    เป็นเกณฑ์ที่ยืนยันมาแล้ว ไม่ใช่ความผิดพลาด — อย่าไป "แก้" ให้เป็นแบบเดิม
//    ความหมายคือ งานที่ยังมาไม่ถึงกำหนดคือสิ่งที่ต้องจับตา ส่วนที่ผ่านไปแล้วจางลง
//
// การนับ 3 วันทำการข้ามเสาร์-อาทิตย์และวันหยุดตาม master data

export type DateTone = 'red' | 'orange' | 'yellow' | null

/**
 * @param iso        วันที่ของแถว (YYYY-MM-DD) — null/'' ได้
 * @param todayIso   วันนี้ (YYYY-MM-DD)
 * @param warnFromIso ขอบเขตล่างของโซนเหลือง = วันนี้ - 3 วันทำการ (YYYY-MM-DD)
 */
export function dateTone(
  iso: string | null | undefined,
  todayIso: string,
  warnFromIso: string,
): DateTone {
  if (!iso) return null
  if (iso === todayIso) return 'orange'
  if (iso > todayIso)   return 'red'
  if (iso >= warnFromIso) return 'yellow'
  return null
}

/** class ของ Tailwind สำหรับแต่ละสี — ครอบทั้ง light และ dark mode */
export function toneClass(tone: DateTone): string {
  switch (tone) {
    case 'red':    return 'text-red-600 dark:text-red-400 font-semibold'
    case 'orange': return 'text-orange-600 dark:text-orange-400 font-semibold'
    case 'yellow': return 'text-yellow-600 dark:text-yellow-400 font-semibold'
    default:       return ''
  }
}
