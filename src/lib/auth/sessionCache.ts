// ─── ล้าง cache ตอนออกจากระบบ ─────────────────────────────────────────────────
// AppContext แคชข้อมูลทีมไว้ใน localStorage ใต้ prefix `wiq:`
// ถ้าไม่ล้าง คนต่อไปที่ใช้เครื่องเดียวกันจะเห็นข้อมูลทีมของคนก่อนหน้า
// ก่อนที่ข้อมูลชุดใหม่จะโหลดเสร็จ

const PREFIX = 'wiq:'

/** key ที่ตั้งใจเก็บไว้ข้ามการล็อกอิน — เป็นการตั้งค่าของเครื่อง ไม่ใช่ข้อมูลทีม */
const KEEP = new Set([
  'wiq:theme',   // ธีมสว่าง/มืด
])

/** ลบข้อมูลทีมที่แคชไว้ทั้งหมด เรียกตอนออกจากระบบและตอนสลับผู้ใช้ */
export function clearCachedTeamData(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX) && !KEEP.has(k)) doomed.push(k)
    }
    for (const k of doomed) localStorage.removeItem(k)
  } catch {
    // โหมด private browsing บางตัวห้ามเขียน localStorage — ไม่ใช่เรื่องคอขาดบาดตาย
  }
}
