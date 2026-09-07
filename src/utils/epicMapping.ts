// ─── สะพานเชื่อม Epic → PlanningProject ───────────────────────────────────────
//
// เดิมโค้ดชุดนี้อยู่ใน EpicView.tsx และใช้ที่นั่นที่เดียว
// ถูกย้ายมาไว้ตรงกลางเพราะหน้า Monitor and Assign ต้องใช้ตัวเดียวกัน
// ถ้าปล่อยให้ต่างคนต่างแปลง สองหน้าจะคำนวณ workload จากข้อมูลคนละชุดทันที
// ที่มีคนแก้การ map ฝั่งใดฝั่งหนึ่ง

import type { Epic } from '../types/epic'
import type { PlanningProject } from '../types/planning'

export function stripBuzzebees(path: string): string {
  return path.replace(/^Buzzebees\\/i, '').trim()
}

/**
 * แปลง Epic เป็นรูปแบบ PlanningProject
 *
 * ทำให้ Epic ใช้ตรรกะเดิมของ Planning ได้ทั้งหมดโดยไม่ต้องเขียนใหม่ —
 * calcAllTesterWorkloads, TesterGanttView และการคำนวณ workload ทุกตัว
 * รับ PlanningProject เป็น input อยู่แล้ว
 *
 * จุดที่ต้องรู้: `tester` map มาจาก `testOwner` ของ Epic
 * → workload ทั้งหมดคิดตาม Test Owner ไม่ใช่ Test Lead
 */
export function epicToProject(e: Epic): PlanningProject {
  return {
    id: e.id, iteration: stripBuzzebees(e.iteration), projectName: e.feature,
    itemType: e.itemType, feature: stripBuzzebees(e.project), tags: '',
    status: e.state, testLead: e.testLead, priority: '',
    tester: e.testOwner,
    goLiveDate: e.targetDate ?? e.uatDate ?? e.sitDate,
    uatDate: e.uatDate ?? (e.targetDate ? null : e.sitDate),
    testingPercent: e.testingPercent, testerFlag: e.testerFlag,
    testerNote: e.testerNote, testEstimateDay: e.testEstimateDay,
    testDate: e.testDate, remarkToPmos: '', pm: '', baNote: '',
    quotationNo: String(e.epicNo), epicNo: String(e.epicNo),
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

// ─── การจัดกลุ่มตาม Status ────────────────────────────────────────────────────

const DEPLOYED_STATES = new Set(['Deployed', 'Go-live Commercial'])

/**
 * Status ที่ถือว่าเป็น "งานที่ยังเดินอยู่"
 *
 * ใช้ทั้งแท็บ Epic Table, Gantt View และหน้า Monitor and Assign
 * Status ที่ไม่อยู่ในลิสต์นี้ (Closed, Removed, On hold, Retired) ไม่ถูกนับ
 *
 * เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่และช่องว่างหัวท้าย เพราะค่าที่ ADO ส่งมาสะกด
 * ไม่ตรงกันเป๊ะเสมอไป — ถ้าเทียบตรงๆ แถวจะหายไปเงียบๆ โดยไม่มีอะไรบอก
 * (ของจริงสะกด "Requirement Gathering" G ตัวใหญ่)
 */
const ACTIVE_STATES = new Set([
  'active',
  'development',
  'new',
  'requirement gathering',
  // ADO ไม่มี state ชื่อ "Test UAT" — ข้อมูลจริงแยกเป็น 'Test' และ 'UAT'
  'test',
  'uat',
  'wait for deploy',
])

export function normalizeState(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function isActiveEpic(e: Epic): boolean {
  return ACTIVE_STATES.has(normalizeState(e.state ?? ''))
}

export function isDeployedEpic(e: Epic): boolean {
  return DEPLOYED_STATES.has(e.state)
}
