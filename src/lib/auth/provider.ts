// ─── ขอบเขตของระบบ auth ───────────────────────────────────────────────────────
//
//  ★ นี่คือไฟล์เดียวในโปรเจคที่รู้ว่า auth ทำงานอย่างไร ★
//
//  หน้า LoginPage, AuthGate และ AuthContext ไม่ import supabase เลยแม้แต่ที่เดียว
//  ทุกอย่างคุยผ่าน interface `AuthPort` ข้างล่างนี้
//
//  วันที่ย้ายไป Azure Entra / SSO: เขียน `entraAuthPort` ที่ implement AuthPort
//  แล้วเปลี่ยนบรรทัด export ท้ายไฟล์ — ไม่ต้องแตะ component ใดเลย
//  (Entra เป็นคำตอบที่ถูกในระยะยาว เพราะทุกคนมี identity อยู่แล้วผ่าน Azure DevOps
//   แต่ต้องขอ app registration จาก IT ซึ่งไม่ควรมาบล็อก login ที่ปล่อยได้อาทิตย์นี้)

import { supabase, isConfigured } from '../supabase'
import type { Profile, SessionUser } from '../../types/auth'

export interface AuthPort {
  /** พร้อมใช้งานหรือไม่ — false = โหมด offline/demo ข้าม auth ทั้งหมด */
  readonly available: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  /** session ปัจจุบัน (null = ไม่ได้ล็อกอิน) */
  getUser(): Promise<SessionUser | null>
  /** profile จาก database — null = ล็อกอินผ่านแต่ไม่มีแถวใน profiles */
  getProfile(userId: string): Promise<Profile | null>
  /** subscribe การเปลี่ยนสถานะ คืน unsubscribe */
  onChange(cb: (user: SessionUser | null) => void): () => void
}

// ── Supabase implementation ──────────────────────────────────────────────────

/**
 * ทุกเมธอดต้องผ่าน guard นี้ก่อน
 *
 * `supabase` ถูก cast เป็น SupabaseClient แต่มีค่าเป็น null จริงๆ ตอนไม่ได้ตั้งค่า
 * (ดู src/lib/supabase.ts) — TypeScript จึงไม่เตือน แต่การเรียก .auth จะ crash
 * ทันทีในโหมด demo
 */
function client() {
  if (!isConfigured || !supabase) {
    throw new Error('Supabase not configured — auth unavailable in offline mode')
  }
  return supabase
}

const supabaseAuthPort: AuthPort = {
  available: isConfigured,

  async signIn(email, password) {
    const { error } = await client().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    // ปล่อย error ดิบขึ้นไป ให้ชั้นบนแปลผ่าน authErrorMessage()
    // ห้าม log — password อยู่ในสโคปเดียวกัน
    if (error) throw error
  },

  async signOut() {
    if (!isConfigured) return
    await client().auth.signOut()
  },

  async getUser() {
    if (!isConfigured) return null
    const { data, error } = await client().auth.getSession()
    if (error || !data.session?.user) return null
    const u = data.session.user
    return { id: u.id, email: u.email ?? null }
  },

  async getProfile(userId) {
    const { data, error } = await (client() as any)
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw new Error(`[auth/getProfile] ${error.message}`)
    if (!data) return null

    return {
      id:       data.id,
      email:    data.email     ?? null,
      fullName: data.full_name ?? null,
      role:     data.role === 'admin' ? 'admin' : 'staff',
      isActive: data.is_active !== false,
    }
  },

  onChange(cb) {
    if (!isConfigured) return () => {}
    const { data } = client().auth.onAuthStateChange((_event, session) => {
      cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null)
    })
    return () => data.subscription.unsubscribe()
  },
}

/** สลับ implementation ที่บรรทัดนี้เมื่อย้ายไป Entra SSO */
export const authPort: AuthPort = supabaseAuthPort
