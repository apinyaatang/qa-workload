// ─── แปล error ของ auth เป็นไทย ───────────────────────────────────────────────
// Supabase throw ข้อความอังกฤษ แต่ UI เป็นไทยทั้งหมดและแสดงข้อความดิบนั้นตรงๆ
// ไฟล์นี้เป็น pure function ล้วน — เทสต์ได้โดยไม่ต้องต่อ network

const MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i,        'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/email not confirmed/i,              'อีเมลนี้ยังไม่ได้ยืนยัน — ติดต่อ Admin'],
  [/user not found/i,                   'ไม่พบผู้ใช้นี้ในระบบ'],
  [/user (is )?banned/i,                'บัญชีนี้ถูกระงับการใช้งาน — ติดต่อ Admin'],
  [/email logins are disabled/i,        'ระบบปิดการเข้าสู่ระบบด้วยอีเมลอยู่ — ติดต่อ Admin'],
  [/signups? not allowed|signup is disabled/i, 'ระบบปิดการสมัครสมาชิก — ติดต่อ Admin เพื่อขอสิทธิ์'],
  [/over_request_rate_limit|too many requests/i, 'ลองเข้าสู่ระบบบ่อยเกินไป — รอสักครู่แล้วลองใหม่'],
  [/password should be at least (\d+)/i, 'รหัสผ่านสั้นเกินไป'],
  [/network|fetch failed|failed to fetch/i, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ต'],
  [/timeout|timed out/i,                'เซิร์ฟเวอร์ตอบกลับช้าเกินไป — ลองใหม่อีกครั้ง'],
]

const FALLBACK = 'เข้าสู่ระบบไม่สำเร็จ — ลองใหม่อีกครั้ง หรือติดต่อ Admin'

/** แปลง error อะไรก็ได้ให้เป็นข้อความไทยที่แสดงให้ผู้ใช้เห็นได้ */
export function authErrorMessage(err: unknown): string {
  const raw =
    typeof err === 'string'          ? err
    : err instanceof Error           ? err.message
    : typeof (err as any)?.message === 'string' ? (err as any).message
    : ''

  if (!raw) return FALLBACK
  for (const [re, th] of MAP) if (re.test(raw)) return th
  return FALLBACK
}
