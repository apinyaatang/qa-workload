import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authPort } from '../lib/auth/provider'
import { authErrorMessage } from '../lib/auth/errors'
import { clearCachedTeamData } from '../lib/auth/sessionCache'
import { can as canWithRole } from '../lib/permissions'
import type { AuthState, Permission, Role, SessionUser } from '../types/auth'

/**
 * เปิด/ปิดการบังคับล็อกอิน
 *
 * ตั้งเป็น false ไว้โดยเจตนา — Phase 1 มีผลกระทบระดับ "ทั้งระบบ"
 * และต้องรัน supabase/migrations/02_authenticated_policies.sql ให้ผ่านก่อน
 * ไม่งั้นวินาทีที่คนแรกล็อกอินสำเร็จ ทุก SELECT จะคืน [] แบบเงียบๆ
 *
 * ลำดับการเปิด: ดู docs/AUTH_ROLLOUT.md
 */
const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === 'true'

/** ระยะเวลาเช็คซ้ำว่า profile ยังใช้งานได้อยู่ (ms) */
const ACTIVE_RECHECK_MS = 5 * 60 * 1000

interface AuthContextValue {
  state: AuthState
  /** role ที่ใช้ตัดสินสิทธิ์ — ตอน auth ปิดอยู่จะเป็น admin */
  role: Role
  /** ทางเดียวที่ควรใช้เช็คสิทธิ์ใน component */
  can: (permission: Permission) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const disabledReason: 'not-configured' | 'flag-off' | null =
    !authPort.available ? 'not-configured' : !REQUIRE_AUTH ? 'flag-off' : null

  const [state, setState] = useState<AuthState>(
    disabledReason
      ? { status: 'auth-disabled', reason: disabledReason }
      : { status: 'loading' },
  )

  // กัน setState หลัง unmount
  // ต้องตั้งค่ากลับเป็น true ตอน mount ด้วย ไม่ใช่แค่ตอนประกาศ ref
  // เพราะ StrictMode รัน mount → unmount → mount ในโหมด dev
  // ถ้าตั้งแต่ตอนประกาศเพียงครั้งเดียว cleanup รอบแรกจะปิดตายทุก setState
  // แล้วหน้าจอจะค้างที่ "กำลังตรวจสอบสิทธิ์…" ตลอดไป
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  /**
   * แปลง session user → AuthState
   *
   * ลำดับการตัดสินตายตัว และตั้งใจให้ "ล้มไปทางที่ปลอดภัย":
   * ถ้าอ่าน profile ไม่สำเร็จ จะได้ profile-missing (เข้าใช้งานไม่ได้)
   * ไม่ใช่ authenticated — สถานะ active มีสองแหล่งความจริง (Supabase ban
   * และ flag ใน profile) การล้มต้องล้มไปทางล็อกอินไม่ได้เสมอ
   */
  const resolve = useCallback(async (user: SessionUser | null): Promise<AuthState> => {
    if (!user) return { status: 'signed-out' }
    try {
      const profile = await authPort.getProfile(user.id)
      if (!profile)          return { status: 'profile-missing', user }
      if (!profile.isActive) return { status: 'deactivated', user, profile }
      return { status: 'authenticated', user, profile }
    } catch {
      return { status: 'profile-missing', user }
    }
  }, [])

  // ── โหลด session ตอนเปิดแอป + subscribe การเปลี่ยนสถานะ ──
  useEffect(() => {
    if (disabledReason) return

    let cancelled = false

    ;(async () => {
      const user = await authPort.getUser()
      const next = await resolve(user)
      if (!cancelled && alive.current) setState(next)
    })()

    const unsub = authPort.onChange(async user => {
      const next = await resolve(user)
      if (!cancelled && alive.current) setState(next)
    })

    return () => { cancelled = true; unsub() }
  }, [disabledReason, resolve])

  // ── เช็คเป็นระยะว่ายังใช้งานได้อยู่ ──
  // Supabase ban หยุดการออก token ใหม่ได้ แต่หยุด token ที่ออกไปแล้วไม่ได้
  // ถ้าไม่เช็คซ้ำ คนที่ถูกปิดสิทธิ์จะนั่งมองตารางว่างๆ จนกว่า token จะหมดอายุ
  useEffect(() => {
    if (state.status !== 'authenticated') return
    const userId = state.user.id

    const timer = setInterval(async () => {
      try {
        const profile = await authPort.getProfile(userId)
        if (!alive.current) return
        if (!profile) {
          setState({ status: 'profile-missing', user: { id: userId, email: null } })
        } else if (!profile.isActive) {
          setState({ status: 'deactivated', user: { id: userId, email: profile.email }, profile })
        }
      } catch {
        // network สะดุดชั่วคราวไม่ควรเด้งคนออกจากระบบ — รอบถัดไปเช็คใหม่
      }
    }, ACTIVE_RECHECK_MS)

    return () => clearInterval(timer)
  }, [state])

  const signIn = useCallback(async (email: string, password: string) => {
    // ล้างข้อมูลทีมของคนก่อนหน้าก่อนเสมอ ไม่ใช่ตอนออกจากระบบเท่านั้น
    // เพราะคนก่อนหน้าอาจปิดแท็บทิ้งไปโดยไม่ได้กดออกจากระบบ
    clearCachedTeamData()
    try {
      await authPort.signIn(email, password)
      // ไม่ต้อง setState — onChange จะยิงเอง
    } catch (e) {
      // แปลที่นี่ ไม่ใช่ที่ LoginPage — หน้า login จึงไม่ต้องรู้จัก Supabase เลย
      // และข้อความอังกฤษดิบไม่มีทางหลุดไปถึงผู้ใช้
      throw new Error(authErrorMessage(e))
    }
  }, [])

  const signOut = useCallback(async () => {
    await authPort.signOut()
    clearCachedTeamData()
    if (alive.current) setState({ status: 'signed-out' })
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const role: Role =
      state.status === 'authenticated'  ? state.profile.role
      : state.status === 'auth-disabled' ? 'admin'   // โหมด demo ใช้งานได้เต็มที่
      : 'staff'                                      // สถานะอื่นยังไม่ได้ใช้งานอยู่แล้ว

    return {
      state,
      role,
      can: (permission: Permission) => canWithRole(role, permission),
      signIn,
      signOut,
    }
  }, [state, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth ต้องอยู่ภายใน <AuthProvider>')
  return ctx
}
