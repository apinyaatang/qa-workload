// ─── สีของวันที่ในตาราง Epic ──────────────────────────────────────────────────
//
// ใช้กับ Test date / UAT Date / Target Date (ไม่รวม SIT Date)
//
// เกณฑ์ — เรียงตามลำดับความสำคัญ ตรวจจากเฉพาะเจาะจงที่สุดก่อน:
//
//   วันที่ = วันนี้                        → ส้ม     (ครบกำหนดวันนี้)
//   วันที่ < วันนี้                        → แดง     (เลยกำหนดแล้ว)
//   วันที่ <= วันนี้ + 3 วันทำการ           → เหลือง  (ใกล้ครบกำหนด)
//   ไกลกว่านั้น                            → ปกติ
//
// ความเร่งด่วนไล่จาก แดง > ส้ม > เหลือง > ปกติ
// วันที่ในอนาคตไกลคือเรื่องปกติ ไม่ต้องเน้นสี
//
// การนับ 3 วันทำการข้ามเสาร์-อาทิตย์และวันหยุดตาม master data

export type DateTone = 'red' | 'orange' | 'yellow' | null

/**
 * วันที่ของ "วันนี้" ตามเวลาท้องถิ่น เป็น YYYY-MM-DD
 *
 * ห้ามใช้ new Date().toISOString().slice(0,10) แทน — มันให้วันที่ตาม UTC
 * ที่ไทย (UTC+7) ช่วงเที่ยงคืนถึง 07:00 จะได้วันของเมื่อวาน
 * ทำให้ทั้งตารางเทียบวันผิดไป 1 วันในช่วงเวลานั้น
 */
export function localIsoDate(d: Date = new Date()): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * แปลง YYYY-MM-DD เป็น Date ที่ตรงเที่ยงคืน UTC
 *
 * workingDayUtils คำนวณด้วย UTC ทั้งหมด (getUTCDay / Date.UTC) การส่ง Date
 * ที่สร้างจากเวลาท้องถิ่นเข้าไปตรงๆ จะทำให้มันมองเป็นวันก่อนหน้า
 */
export function utcDateFromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/**
 * @param iso          วันที่ของแถว (YYYY-MM-DD) — null/'' ได้
 * @param todayIso     วันนี้ (YYYY-MM-DD)
 * @param warnUntilIso ขอบบนของโซนเหลือง = วันนี้ + 3 วันทำการ (YYYY-MM-DD)
 */
export function dateTone(
  iso: string | null | undefined,
  todayIso: string,
  warnUntilIso: string,
): DateTone {
  if (!iso) return null
  if (iso === todayIso)    return 'orange'
  if (iso < todayIso)      return 'red'
  if (iso <= warnUntilIso) return 'yellow'
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
