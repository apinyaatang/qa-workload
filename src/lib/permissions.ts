// ─── ตารางสิทธิ์ ──────────────────────────────────────────────────────────────
//
//  ★ จุดเดียวในระบบที่เขียนว่า role ไหนทำอะไรได้ ★
//
//  ห้ามกระจาย `role === 'admin'` ไปทั่วโค้ด — เช็คผ่าน can() เท่านั้น
//  เพราะการกระจายทำให้ไม่มีใครตอบได้ว่า "staff เห็นอะไรบ้าง" โดยไม่ต้องอ่านทั้ง repo
//
//  ⚠️  ตารางนี้เป็นเรื่อง UX เท่านั้นจนกว่าจะถึง Phase 5
//      วันนี้ staff คนไหนก็ยัง curl เข้า REST endpoint อ่านและเขียนทุกตารางได้
//      การซ่อนปุ่มไม่ใช่ความปลอดภัย — RLS เท่านั้นที่เป็น

import type { Permission, Role } from '../types/auth'
import type { ViewType } from '../types'

/**
 * มีแค่ 2 role โดยเจตนา
 *
 * role `lead` ดูน่าสนใจเพราะข้อมูลมี field "test lead" อยู่ แต่ field พวกนั้น
 * เป็น free text ไม่ใช่ตัวตนที่ผูกกับบัญชี — role นี้จะไม่มีข้อมูลรองรับ
 */
const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    'view:team',
    'view:own-work',
    'view:epics',
    'view:extra-tasks',
    'edit:epics',
    'edit:extra-tasks',
    'submit:progress',
    'sync:ado',
    'manage:master-data',
    'import:data',
    'manage:users',
    'reset:demo-data',
  ]),

  staff: new Set<Permission>([
    'view:own-work',
    'view:epics',
    'view:extra-tasks',
    'edit:epics',
    'edit:extra-tasks',
    'submit:progress',
    'sync:ado',
    // ไม่ได้: view:team, manage:master-data, import:data, manage:users, reset:demo-data
  ]),
}

/** pure function — เทสต์ได้โดยไม่ต้อง mock อะไรเลย */
export function can(role: Role, permission: Permission): boolean {
  return GRANTS[role].has(permission)
}

/**
 * หน้าไหนต้องมีสิทธิ์อะไร
 *
 * ตารางนี้ถูกใช้ทั้งใน Sidebar (ซ่อนเมนู) และใน switch ที่ render หน้า (กันจริง)
 * เพราะการซ่อนปุ่มไม่ได้หยุดคนที่เปิด devtools เรียก setActiveView() เอง
 */
export const VIEW_PERMISSION: Record<ViewType, Permission> = {
  'dashboard':        'view:team',
  'employees':        'view:team',
  'tasks':            'view:team',
  'adhoc-report':     'view:team',
  'individual':       'view:team',
  'settings':         'manage:master-data',
  'import':           'import:data',
  'my-projects':      'view:own-work',
  'project-progress': 'view:own-work',
  'extra-tasks':      'view:extra-tasks',
  'epics':            'view:epics',
}

export function canView(role: Role, view: ViewType): boolean {
  return can(role, VIEW_PERMISSION[view])
}

/** หน้าแรกหลังล็อกอิน — staff เข้ามาเจองานของตัวเอง ไม่ใช่ dashboard ของทีม */
export function landingView(role: Role): ViewType {
  return role === 'admin' ? 'dashboard' : 'my-projects'
}
