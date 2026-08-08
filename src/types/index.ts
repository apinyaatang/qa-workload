export type Department = string
export type Position = string
export type Skill = string

export type LeaveType = 'annual' | 'sick' | 'personal' | 'maternity' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRecord {
  id: string
  employeeId: string
  date: string // ISO date YYYY-MM-DD
  leaveType: LeaveType
  status: LeaveStatus
  note?: string
}

export interface PublicHoliday {
  id: string
  date: string // ISO date YYYY-MM-DD
  name: string
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  department: Department
  position: Position
  skills: Skill[]
  startDate: string // ISO date
  isActive: boolean
  avatar?: string
  // Extended fields (from CSV import)
  employeeCode?: string   // numeric ID from HR system e.g. "1639"
  nickname?: string       // ชื่อเล่น e.g. "Mameaw"
  orgNumber?: number      // Number of organization
  group?: string          // Group จาก CSV e.g. "Product", "Project 1"
  team?: string           // Team ที่สังกัด e.g. "QA Team A", "Dev Team"
  tier?: string           // Tier level
  wfhDays?: string[]      // WFH days e.g. ["Mon","Fri"]
  inactiveDate?: string   // ISO date when became inactive
  birthdate?: string      // ISO date
}

export type TaskType = 'Planned' | 'Adhoc'
export type TaskSource = 'Excel/GSheet' | 'Azure DevOps'
export type TaskStatus = 'Pending' | 'In-Progress' | 'Done' | 'Cancelled'
export type DeadlineFlag = 'Due Soon' | 'Overdue' | null

export interface Task {
  id: string
  name: string
  assigneeIds: string[]
  estimatedHours: number
  deadline: string // ISO date
  taskType: TaskType
  source: TaskSource
  status: TaskStatus
  periodStart: string // ISO date — which period this task belongs to
  periodEnd: string
  description?: string
  azureWorkItemId?: string
}

export type PeriodType = 'weekly' | 'monthly' | 'custom'

export interface Period {
  type: PeriodType
  startDate: string
  endDate: string
  label: string
}

export type WorkloadStatus = 'Overloaded' | 'High Load' | 'Normal' | 'Underutilized' | 'Idle'
export type AdhocRisk = 'High Adhoc' | 'Medium Adhoc' | 'Low Adhoc'

export interface EmployeeWorkload {
  employee: Employee
  period: Period
  capacityHours: number
  workingDays: number
  plannedHours: number
  adhocHours: number
  totalHours: number
  remainingHours: number
  workloadPct: number
  remainingPct: number
  adhocRatioPct: number
  workloadStatus: WorkloadStatus
  adhocRisk: AdhocRisk
  tasks: (Task & { deadlineFlag: DeadlineFlag })[]
}

export interface TeamSummary {
  period: Period
  totalMembers: number
  activeMembers: number
  avgWorkloadPct: number
  totalAdhocHours: number
  totalPlannedHours: number
  overloadedCount: number
  highLoadCount: number
  idleCount: number
  memberWorkloads: EmployeeWorkload[]
}

export interface AppState {
  employees: Employee[]
  tasks: Task[]
  leaveRecords: LeaveRecord[]
  publicHolidays: PublicHoliday[]
  selectedPeriod: Period
  activeView: ViewType
  selectedEmployeeId: string | null
  selectedProjectId: string | null
}

export type ViewType =
  | 'dashboard' | 'employees' | 'tasks' | 'adhoc-report'
  | 'individual' | 'settings' | 'import' | 'planning'
  | 'my-projects'
  | 'project-progress'
  | 'extra-tasks'
  | 'epics'

// ─── Master Project ───────────────────────────────────────────────────────────
export type ProjectStatus = 'Active' | 'Inactive' | 'Completed'

export interface Project {
  id: string
  code: string           // รหัส Project
  name: string
  description?: string
  department: Department
  ownerId: string        // Employee ID — Project Owner
  startDate: string      // ISO date
  endDate?: string
  status: ProjectStatus
  budget?: number        // optional
  createdAt: string
}

// ─── Import / Raw Data ───────────────────────────────────────────────────────
export type ImportStatus = 'success' | 'error' | 'partial'

export interface ImportedRow {
  rowNo: number
  taskId?: string
  taskName?: string
  assigneeId?: string       // matched Employee ID
  assigneeRaw?: string      // original text from file
  projectId?: string        // matched Project ID
  projectRaw?: string
  estimatedHours?: number
  deadline?: string
  status?: TaskStatus
  periodStart?: string
  periodEnd?: string
  error?: string            // validation message if row failed
}

export interface ImportSession {
  id: string
  fileName: string
  importedAt: string         // ISO datetime
  importStatus: ImportStatus
  totalRows: number
  successRows: number
  errorRows: number
  rows: ImportedRow[]
  appliedToTasks: boolean    // ถูก apply เข้า Task list แล้วหรือยัง
}
