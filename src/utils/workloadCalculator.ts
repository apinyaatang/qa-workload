import type {
  Employee, Task, LeaveRecord, PublicHoliday,
  Period, EmployeeWorkload, TeamSummary,
  WorkloadStatus, AdhocRisk, DeadlineFlag,
} from '../types'
import { getWorkingDaysInPeriod, getDeadlineFlag, isTaskInPeriod } from './dateUtils'

function classifyWorkloadStatus(pct: number): WorkloadStatus {
  if (pct > 100) return 'Overloaded'
  if (pct >= 85) return 'High Load'
  if (pct >= 50) return 'Normal'
  if (pct > 0) return 'Underutilized'
  return 'Idle'
}

function classifyAdhocRisk(adhocRatioPct: number): AdhocRisk {
  if (adhocRatioPct > 40) return 'High Adhoc'
  if (adhocRatioPct >= 20) return 'Medium Adhoc'
  return 'Low Adhoc'
}

// BR-CON-001: Only approved leaves count toward capacity deduction
function getApprovedLeaveDates(employeeId: string, leaveRecords: LeaveRecord[]): string[] {
  return leaveRecords
    .filter(l => l.employeeId === employeeId && l.status === 'approved')
    .map(l => l.date)
}

function getPublicHolidayDates(holidays: PublicHoliday[]): string[] {
  return holidays.map(h => h.date)
}

// BR-DRV-001 — Capacity
function calcCapacity(employeeId: string, period: Period, leaveRecords: LeaveRecord[], holidays: PublicHoliday[]): { capacityHours: number; workingDays: number } {
  const leaveDates = getApprovedLeaveDates(employeeId, leaveRecords)
  const holidayDates = getPublicHolidayDates(holidays)
  const workingDays = getWorkingDaysInPeriod(period.startDate, period.endDate, holidayDates, leaveDates)
  return { capacityHours: workingDays * 8, workingDays }
}

export function calcEmployeeWorkload(
  employee: Employee,
  allTasks: Task[],
  period: Period,
  leaveRecords: LeaveRecord[],
  holidays: PublicHoliday[],
): EmployeeWorkload {
  const { capacityHours, workingDays } = calcCapacity(employee.id, period, leaveRecords, holidays)

  // Filter tasks for this employee in this period (BR-CON-005: exclude Cancelled from workload %)
  const employeeTasks = allTasks.filter(t =>
    t.assigneeIds.includes(employee.id) && isTaskInPeriod(t, period)
  )

  const activeTasks = employeeTasks.filter(t => t.status !== 'Cancelled')

  // BR-DRV-003
  const plannedHours = activeTasks
    .filter(t => t.taskType === 'Planned')
    .reduce((sum, t) => sum + t.estimatedHours, 0)

  const adhocHours = activeTasks
    .filter(t => t.taskType === 'Adhoc')
    .reduce((sum, t) => sum + t.estimatedHours, 0)

  const totalHours = plannedHours + adhocHours

  // BR-DRV-002
  const workloadPct = capacityHours > 0 ? Math.round((totalHours / capacityHours) * 100 * 10) / 10 : 0

  // BR-DRV-004
  const remainingHours = capacityHours - totalHours
  const remainingPct = Math.max(0, Math.round((100 - workloadPct) * 10) / 10)

  // BR-DRV-003 Adhoc ratio
  const adhocRatioPct = totalHours > 0 ? Math.round((adhocHours / totalHours) * 100 * 10) / 10 : 0

  // BR-INF-001
  const workloadStatus = classifyWorkloadStatus(workloadPct)
  // BR-INF-002
  const adhocRisk = classifyAdhocRisk(adhocRatioPct)

  // BR-INF-003 — deadline flags on all tasks (including cancelled — shown in history)
  const tasksWithFlags = employeeTasks.map(t => ({
    ...t,
    deadlineFlag: getDeadlineFlag(t.deadline, t.status) as DeadlineFlag,
  }))

  return {
    employee,
    period,
    capacityHours,
    workingDays,
    plannedHours,
    adhocHours,
    totalHours,
    remainingHours,
    workloadPct,
    remainingPct,
    adhocRatioPct,
    workloadStatus,
    adhocRisk,
    tasks: tasksWithFlags,
  }
}

// BR-DRV-005
export function calcTeamSummary(
  employees: Employee[],
  tasks: Task[],
  period: Period,
  leaveRecords: LeaveRecord[],
  holidays: PublicHoliday[],
): TeamSummary {
  const memberWorkloads = employees.map(emp =>
    calcEmployeeWorkload(emp, tasks, period, leaveRecords, holidays)
  )

  // BR-CON-006: employees with capacity = 0 (absent whole period) excluded from avg
  const activeMembers = memberWorkloads.filter(w => w.capacityHours > 0)

  const avgWorkloadPct = activeMembers.length > 0
    ? Math.round(activeMembers.reduce((s, w) => s + w.workloadPct, 0) / activeMembers.length * 10) / 10
    : 0

  const totalAdhocHours = memberWorkloads.reduce((s, w) => s + w.adhocHours, 0)
  const totalPlannedHours = memberWorkloads.reduce((s, w) => s + w.plannedHours, 0)

  return {
    period,
    totalMembers: employees.length,
    activeMembers: activeMembers.length,
    avgWorkloadPct,
    totalAdhocHours,
    totalPlannedHours,
    overloadedCount: memberWorkloads.filter(w => w.workloadStatus === 'Overloaded').length,
    highLoadCount: memberWorkloads.filter(w => w.workloadStatus === 'High Load').length,
    idleCount: memberWorkloads.filter(w => w.workloadStatus === 'Idle').length,
    memberWorkloads,
  }
}

export function identifyAdhocTasks(azureTasks: Task[], lastImportedPlannedIds: Set<string>): Task[] {
  return azureTasks.map(t => ({
    ...t,
    taskType: lastImportedPlannedIds.has(t.id) ? 'Planned' : 'Adhoc',
  }))
}
