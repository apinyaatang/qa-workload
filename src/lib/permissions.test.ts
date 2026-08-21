import { describe, it, expect } from 'vitest'
import { can, canView, landingView, VIEW_PERMISSION } from './permissions'
import { authErrorMessage } from './auth/errors'
import type { Permission, Role } from '../types/auth'
import type { ViewType } from '../types'

// test setup รันบน Node ไม่มี DOM harness — กลยุทธ์คือดันการตัดสินใจทั้งหมด
// ออกไปอยู่ใน pure module แล้วเทสต์ที่นั่น แทนที่จะติดตั้ง component test เพิ่ม

describe('ตารางสิทธิ์', () => {
  // เขียนเป็นตารางชัดๆ ครอบทั้งสอง role — จับบั๊กกลุ่ม "staff เห็นหน้า Master Data"
  // ได้โดยไม่ต้องตั้งค่าอะไรเลย
  const TABLE: Array<[Permission, boolean, boolean]> = [
    // permission             admin   staff
    ['view:team',             true,   false],
    ['view:own-work',         true,   true ],
    ['view:epics',            true,   true ],
    ['view:extra-tasks',      true,   true ],
    ['edit:epics',            true,   true ],
    ['edit:extra-tasks',      true,   true ],
    ['submit:progress',       true,   true ],
    ['sync:ado',              true,   true ],
    ['manage:master-data',    true,   false],
    ['import:data',           true,   false],
    ['manage:users',          true,   false],
    ['reset:demo-data',       true,   false],
  ]

  for (const [perm, adminOk, staffOk] of TABLE) {
    it(`${perm}: admin=${adminOk} staff=${staffOk}`, () => {
      expect(can('admin', perm)).toBe(adminOk)
      expect(can('staff', perm)).toBe(staffOk)
    })
  }

  it('ตารางเทสต์ครอบคลุมทุก permission ที่ประกาศไว้', () => {
    // กันการเพิ่ม permission ใหม่แล้วลืมมาเทสต์
    const declared = new Set(Object.values(VIEW_PERMISSION))
    const tested   = new Set(TABLE.map(([p]) => p))
    for (const p of declared) expect(tested.has(p)).toBe(true)
  })
})

describe('การกั้นหน้า', () => {
  const ADMIN_ONLY: ViewType[] = ['dashboard', 'employees', 'tasks', 'adhoc-report',
                                   'individual', 'settings', 'import']
  const SHARED: ViewType[] = ['my-projects', 'project-progress', 'extra-tasks', 'epics']

  it('admin เข้าได้ทุกหน้า', () => {
    for (const v of [...ADMIN_ONLY, ...SHARED]) expect(canView('admin', v)).toBe(true)
  })

  it('staff เข้าหน้าของ admin ไม่ได้', () => {
    for (const v of ADMIN_ONLY) expect(canView('staff', v)).toBe(false)
  })

  it('staff เข้าหน้างานของตัวเองได้', () => {
    for (const v of SHARED) expect(canView('staff', v)).toBe(true)
  })

  it('ทุก ViewType มีสิทธิ์กำกับ ไม่มีหน้าไหนหลุด', () => {
    const views: ViewType[] = [...ADMIN_ONLY, ...SHARED]
    expect(Object.keys(VIEW_PERMISSION).sort()).toEqual([...views].sort())
  })

  it('หน้าแรกหลังล็อกอินต้องเป็นหน้าที่ role นั้นเข้าได้', () => {
    for (const role of ['admin', 'staff'] as Role[]) {
      expect(canView(role, landingView(role))).toBe(true)
    }
    expect(landingView('staff')).toBe('my-projects')
  })
})

describe('แปล error ของ auth เป็นไทย', () => {
  it('แปลข้อความที่รู้จัก', () => {
    expect(authErrorMessage(new Error('Invalid login credentials')))
      .toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    expect(authErrorMessage(new Error('Email not confirmed')))
      .toContain('ยังไม่ได้ยืนยัน')
    expect(authErrorMessage('Failed to fetch'))
      .toContain('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
  })

  it('ไม่ปล่อยข้อความอังกฤษดิบออกไปให้ผู้ใช้เห็น', () => {
    const out = authErrorMessage(new Error('AuthApiError: unexpected_failure xyz'))
    expect(out).not.toContain('AuthApiError')
    expect(out).not.toContain('xyz')
  })

  it('รับค่าที่ไม่ใช่ error ได้โดยไม่ throw', () => {
    for (const v of [null, undefined, 0, {}, [], '']) {
      expect(typeof authErrorMessage(v)).toBe('string')
      expect(authErrorMessage(v).length).toBeGreaterThan(0)
    }
  })
})
