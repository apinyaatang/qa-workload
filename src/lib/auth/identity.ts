// ─── ตัวตนที่ใช้ผูกกับการเขียนข้อมูล ──────────────────────────────────────────
// pure function ล้วน — การตัดสินใจทั้งหมดของ Phase 3 อยู่ที่นี่ เทสต์ได้โดยไม่ต้อง mock

import type { AuthState } from '../../types/auth'

export interface Attribution {
  /** user id จริงจาก auth.users — null เมื่อยังไม่เปิด login */
  staffId: string | null
  /** ชื่อที่แสดงในประวัติและใน Teams card */
  staffName: string
  /**
   * บันทึกลงตาราง progress_updates ได้หรือไม่
   *
   * false เมื่อไม่มี user id จริง — policy "progress_updates: own insert"
   * บังคับ staff_id = auth.uid() ไว้ การพยายามเขียนจะถูก RLS ปฏิเสธ
   * จึงข้ามการเขียนไปเลยแทนที่จะให้ผู้ใช้เจอ error ที่แก้ไม่ได้
   */
  canRecord: boolean
}

const ANONYMOUS_LABEL = 'ไม่ระบุผู้บันทึก (ยังไม่เปิดระบบ login)'

/**
 * แปลง AuthState → ตัวตนที่ใช้ผูกกับการเขียน
 *
 * เลิกใช้ค่า hardcode `staffId: 'offline'` และ `updatedBy: 'System'`
 * ซึ่งเดิมถูกยัดลงคอลัมน์ uuid ที่อ้าง auth.users(id) — ใส่ไม่ได้อยู่แล้ว
 */
export function attributionFor(state: AuthState): Attribution {
  if (state.status === 'authenticated') {
    const { profile, user } = state
    return {
      staffId:   user.id,
      staffName: profile.fullName?.trim() || profile.email?.trim() || user.id,
      canRecord: true,
    }
  }

  // ทุกสถานะที่เหลือ (auth-disabled / loading / signed-out / profile-missing /
  // deactivated) ไม่มี user id ที่ผ่าน RLS ได้ — ระบุตัวคนไม่ได้จริง
  return { staffId: null, staffName: ANONYMOUS_LABEL, canRecord: false }
}
