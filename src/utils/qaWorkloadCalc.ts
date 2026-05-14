/**
 * qaWorkloadCalc.ts
 * Daily workload calculation for QA testers based on overlapping
 * Testing and Feedback-UAT phases on each working day.
 *
 * Status rules (per worst day):
 *   Overloaded      — concurrent > 3 AND any overlapping task has itemType = "New Project"
 *   High Load       — concurrent > 3 AND only CR / CR FOC / Internal request
 *   Normal          — concurrent 2–3
 *   Underutilized   — concurrent = 1
 *   Idle            — concurrent = 0
 */
import type { PlanningProject } from '../types/planning'
import type { Employee } from '../types'
import { addWorkingDaysH } from './workingDayUtils'
import { buildEmployeeMap, resolveEmployee } from './staffCsvParser'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QaWorkloadStatus = 'Overloaded' | 'High Load' | 'Normal' | 'Underutilized' | 'Idle'

export interface DailyLoad {
  date: string          // ISO YYYY-MM-DD
  count: number         // # overlapping phases
  hasNewProject: boolean
  status: QaWorkloadStatus
}

export interface TesterDailyWorkload {
  testerKey: string     // raw tester string from planning data
  employee: Employee | undefined
  peakStatus: QaWorkloadStatus
  peakCount: number
  dailyLoads: Map<string, DailyLoad>   // date → DailyLoad
}

// ─── NEW PROJECT item types that trigger Overloaded ───────────────────────────

const NEW_PROJECT_TYPES = new Set(['New Project', 'new project', 'New', 'new'])

function isNewProject(itemType: string): boolean {
  return NEW_PROJECT_TYPES.has(itemType?.trim() ?? '')
}

// ─── Status classification ────────────────────────────────────────────────────

export function classifyLoad(count: number, hasNewProject: boolean): QaWorkloadStatus {
  if (count === 0)             return 'Idle'
  if (count === 1)             return 'Underutilized'
  if (count <= 3)              return 'Normal'
  // count > 3
  if (hasNewProject)           return 'Overloaded'
  return 'High Load'
}

const STATUS_ORDER: Record<QaWorkloadStatus, number> = {
  Overloaded:    4,
  'High Load':   3,
  Normal:        2,
  Underutilized: 1,
  Idle:          0,
}

// ─── Per-day phase check ──────────────────────────────────────────────────────

/**
 * Returns true if the given working day falls within a task's Testing phase.
 * Testing phase: testDate → uatDate (inclusive).
 */
function isInTestingPhase(p: PlanningProject, day: string): boolean {
  if (!p.testDate || !p.uatDate) return false
  return p.testDate <= day && day <= p.uatDate
}

/**
 * Returns true if the given working day falls within Feedback UAT phase.
 * Feedback UAT: uatDate + 1 workday → goLiveDate (inclusive).
 */
function isInFeedbackUatPhase(
  p: PlanningProject,
  day: string,
  holidays: Set<string>,
): boolean {
  if (!p.uatDate || !p.goLiveDate) return false
  const fbStart = addWorkingDaysH(new Date(p.uatDate), 1, holidays).toISOString().slice(0, 10)
  return fbStart <= day && day <= p.goLiveDate
}

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate daily workload for every tester across the given working days.
 *
 * @param projects   Filtered PlanningProject list (already filtered by period/view)
 * @param workingDays  Array of ISO date strings (Mon–Fri, no holidays) from TesterGanttView
 * @param employees  Active employees from Master Staff
 * @param holidays   Set of holiday ISO dates
 */
export function calcAllTesterWorkloads(
  projects: PlanningProject[],
  workingDays: string[],
  employees: Employee[],
  holidays: Set<string>,
): Map<string, TesterDailyWorkload> {
  const activeEmployees = employees.filter(e => e.isActive)
  const empMap = buildEmployeeMap(activeEmployees)

  // Group projects by tester key
  const byTester = new Map<string, PlanningProject[]>()
  for (const p of projects) {
    const key = p.tester?.trim() || 'Unassigned'
    if (!byTester.has(key)) byTester.set(key, [])
    byTester.get(key)!.push(p)
  }

  const result = new Map<string, TesterDailyWorkload>()

  for (const [testerKey, tasks] of byTester) {
    const dailyLoads = new Map<string, DailyLoad>()
    let peakStatus: QaWorkloadStatus = 'Idle'
    let peakCount = 0

    for (const day of workingDays) {
      const activeTasks = tasks.filter(p =>
        isInTestingPhase(p, day) || isInFeedbackUatPhase(p, day, holidays)
      )
      const count = activeTasks.length
      const hasNewProject = activeTasks.some(p => isNewProject(p.itemType))
      const status = classifyLoad(count, hasNewProject)

      dailyLoads.set(day, { date: day, count, hasNewProject, status })

      if (STATUS_ORDER[status] > STATUS_ORDER[peakStatus]) {
        peakStatus = status
        peakCount  = count
      }
    }

    const employee = resolveEmployee(testerKey, empMap)

    result.set(testerKey, {
      testerKey,
      employee,
      peakStatus,
      peakCount,
      dailyLoads,
    })
  }

  return result
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

export const WORKLOAD_COLORS: Record<QaWorkloadStatus, {
  bg: string; text: string; heatBg: string; dot: string; label: string
}> = {
  Overloaded:    { bg: 'bg-red-100',    text: 'text-red-700',    heatBg: '#EF4444', dot: 'bg-red-500',    label: 'Overloaded'    },
  'High Load':   { bg: 'bg-orange-100', text: 'text-orange-700', heatBg: '#F97316', dot: 'bg-orange-500', label: 'High Load'     },
  Normal:        { bg: 'bg-green-100',  text: 'text-green-700',  heatBg: '#22C55E', dot: 'bg-green-500',  label: 'Normal'        },
  Underutilized: { bg: 'bg-blue-100',   text: 'text-blue-700',   heatBg: '#3B82F6', dot: 'bg-blue-500',   label: 'Underutilized' },
  Idle:          { bg: 'bg-gray-100',   text: 'text-gray-500',   heatBg: 'transparent', dot: 'bg-gray-300', label: 'Idle'       },
}
