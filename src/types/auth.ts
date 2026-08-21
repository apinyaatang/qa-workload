// ─── Auth types ───────────────────────────────────────────────────────────────
// สัญญาของระบบสิทธิ์ทั้งหมดอยู่ในไฟล์นี้ที่เดียว

export type Role = 'admin' | 'staff'

/** profile แถวหนึ่งในตาราง public.profiles */
export interface Profile {
  id:       string
  email:    string | null
  fullName: string | null
  role:     Role
  isActive: boolean
}

/** ผู้ใช้ที่ auth provider คืนมา — ตั้งใจให้แคบ ไม่ผูกกับ Supabase */
export interface SessionUser {
  id:    string
  email: string | null
}

/**
 * สถานะ auth เป็น discriminated union ไม่ใช่กองของ field ที่ null ได้
 *
 * เหตุผล: สถานะ `authenticated` การันตีเชิงโครงสร้างว่ามี profile อยู่แล้ว
 * — TypeScript บังคับให้เข้าถึง profile ได้เฉพาะเมื่อเช็ค status แล้ว
 * ทำให้ไม่มีลำดับ event ใดที่พาไปสู่ "ล็อกอินแล้วแต่ไม่มี profile" ได้
 *
 * และทำให้ `profile-missing` กับ `deactivated` กลายเป็นสถานะที่ต้องจัดการ
 * ไม่ใช่หน้าจอว่างเปล่าที่ไม่มีใครอธิบายได้
 */
export type AuthState =
  /** กำลังอ่าน session จาก storage — ยังไม่รู้ว่าใคร */
  | { status: 'loading' }
  /**
   * ข้ามระบบ auth ทั้งหมด เกิดได้ 2 กรณี:
   *   • ไม่ได้ตั้งค่า Supabase → โหมด demo
   *   • VITE_REQUIRE_AUTH ยังไม่เปิด → ยังไม่ถึงเวลาเปิด login
   * ในสถานะนี้ทุกคนได้สิทธิ์ admin เพื่อให้ระบบทำงานเหมือนก่อนมี auth
   */
  | { status: 'auth-disabled'; reason: 'not-configured' | 'flag-off' }
  /** ไม่มี session หรือเพิ่งออกจากระบบ */
  | { status: 'signed-out' }
  /** ล็อกอินผ่าน แต่ไม่มีแถวใน profiles — trigger ไม่ทำงานหรือถูกลบแถวไป */
  | { status: 'profile-missing'; user: SessionUser }
  /** ล็อกอินผ่าน มี profile แต่ถูกปิดการใช้งาน */
  | { status: 'deactivated';     user: SessionUser; profile: Profile }
  /** ใช้งานได้เต็มที่ — มี profile และ is_active = true แน่นอน */
  | { status: 'authenticated';   user: SessionUser; profile: Profile }

/**
 * สิ่งที่ทำได้ ตั้งชื่อเป็นคำกริยา:action ไม่ใช่ชื่อหน้าจอ
 *
 * ตั้งใจให้เป็นระดับความสามารถ ไม่ใช่สำเนาซ้อนของ RLS policy
 * — RLS ตัดสินว่า "แถวไหน" ตารางนี้ตัดสินว่า "ทำอะไรได้"
 */
export type Permission =
  | 'view:team'           // ข้อมูลรวมของทีม — dashboard, รายงาน
  | 'view:own-work'       // งานของตัวเอง
  | 'view:epics'
  | 'view:extra-tasks'
  | 'edit:epics'
  | 'edit:extra-tasks'
  | 'submit:progress'
  | 'sync:ado'
  | 'manage:master-data'  // ตาราง master ทั้งหมด
  | 'import:data'         // import CSV — เขียนทับข้อมูลทั้งชุด
  | 'manage:users'
  | 'reset:demo-data'     // ปุ่มอันตราย: ยัดข้อมูลปลอมกลับเข้า state
