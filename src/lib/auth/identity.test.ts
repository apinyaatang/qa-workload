import { describe, it, expect } from 'vitest'
import { attributionFor } from './identity'
import type { AuthState, Profile, SessionUser } from '../../types/auth'

const user: SessionUser = { id: '3f2b7c10-0000-4000-8000-000000000001', email: 'nut@example.com' }

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: user.id, email: 'nut@example.com', fullName: 'Nutt Uttaranakorn',
    role: 'staff', isActive: true, ...over,
  }
}

describe('ตัวตนที่ใช้ผูกกับการเขียน progress', () => {
  it('ล็อกอินแล้ว → ได้ user id จริงและบันทึกได้', () => {
    const a = attributionFor({ status: 'authenticated', user, profile: profile() })
    expect(a.staffId).toBe(user.id)
    expect(a.staffName).toBe('Nutt Uttaranakorn')
    expect(a.canRecord).toBe(true)
  })

  it('ไม่เคยส่งค่า hardcode เดิมออกไปอีก', () => {
    // ค่าเดิมสองตัวนี้เคยถูกยัดลงคอลัมน์ uuid REFERENCES auth.users(id)
    const states: AuthState[] = [
      { status: 'authenticated', user, profile: profile() },
      { status: 'auth-disabled', reason: 'flag-off' },
      { status: 'auth-disabled', reason: 'not-configured' },
      { status: 'loading' },
      { status: 'signed-out' },
      { status: 'profile-missing', user },
      { status: 'deactivated', user, profile: profile({ isActive: false }) },
    ]
    for (const s of states) {
      const a = attributionFor(s)
      expect(a.staffId).not.toBe('offline')
      expect(a.staffName).not.toBe('System')
    }
  })

  it('ทุกสถานะที่ไม่ใช่ authenticated → บันทึกไม่ได้ และ staffId เป็น null', () => {
    // สำคัญ: staffId ต้องเป็น null ไม่ใช่ string ใดๆ เพราะ policy บังคับ
    // staff_id = auth.uid() — ค่าอื่นทั้งหมดถูก RLS ปฏิเสธอยู่ดี
    const notLoggedIn: AuthState[] = [
      { status: 'auth-disabled', reason: 'flag-off' },
      { status: 'auth-disabled', reason: 'not-configured' },
      { status: 'loading' },
      { status: 'signed-out' },
      { status: 'profile-missing', user },
      { status: 'deactivated', user, profile: profile({ isActive: false }) },
    ]
    for (const s of notLoggedIn) {
      const a = attributionFor(s)
      expect(a.staffId).toBeNull()
      expect(a.canRecord).toBe(false)
      expect(a.staffName.length).toBeGreaterThan(0)   // ต้องมีข้อความอธิบายเสมอ
    }
  })

  it('บัญชีที่ถูกปิดการใช้งานบันทึกไม่ได้ แม้จะมี session อยู่', () => {
    // policy บังคับ is_active_user() ด้วย — ฝั่ง client ต้องสอดคล้องกัน
    const a = attributionFor({
      status: 'deactivated', user, profile: profile({ isActive: false }),
    })
    expect(a.canRecord).toBe(false)
  })

  it('ไม่มี fullName → ใช้ email', () => {
    const a = attributionFor({
      status: 'authenticated', user, profile: profile({ fullName: null }),
    })
    expect(a.staffName).toBe('nut@example.com')
  })

  it('fullName เป็นช่องว่าง → ไม่ใช้ ตกไปที่ email', () => {
    const a = attributionFor({
      status: 'authenticated', user, profile: profile({ fullName: '   ' }),
    })
    expect(a.staffName).toBe('nut@example.com')
  })

  it('ไม่มีทั้ง fullName และ email → ใช้ user id ไม่ปล่อยให้ว่าง', () => {
    const a = attributionFor({
      status: 'authenticated', user, profile: profile({ fullName: null, email: null }),
    })
    expect(a.staffName).toBe(user.id)
  })
})
