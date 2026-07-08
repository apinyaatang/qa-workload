export type PlanningPriority = 'Critical' | 'High' | 'Medium' | 'Low' | ''

export interface PlanningProject {
  id: string
  iteration: string
  projectName: string
  itemType: string
  feature: string
  tags: string
  status: string
  testLead: string          // mapped from CSV "Test Buddy"
  priority: PlanningPriority
  tester: string
  goLiveDate: string | null   // ISO date YYYY-MM-DD
  uatDate: string | null
  testingPercent: number | null
  testerFlag: string[]
  testerNote: string
  testEstimateDay: number | null
  testDate: string | null     // calculated
  remarkToPmos: string
  pm: string
  baNote: string
  quotationNo: string
  epicNo: string
  rawImportData?: Record<string, string>  // original CSV row
  createdAt?: string
  updatedAt?: string
}

// ── CSV import ───────────────────────────────────────────────────────────────

export type ConflictField = 'tester' | 'testingPercent' | 'testEstimateDay'

export interface FieldConflict {
  field: ConflictField
  fileValue: string | number | null
  dbValue:   string | number | null
}

export interface PlanningCsvRow {
  rowNo: number
  data: Partial<PlanningProject>
  rawData: Record<string, string>
  errors: string[]
  isValid: boolean
  willUpdate: boolean   // true if ID already exists in DB
  conflicts?: FieldConflict[]            // only for willUpdate rows with differing values
  existingData?: Partial<PlanningProject> // DB snapshot for this ID
}

export interface PlanningImportResult {
  totalRows: number
  insertedRows: number
  updatedRows: number
  failedRows: number
  errors: { rowNo: number; id: string; message: string }[]
}

// ── Filters ──────────────────────────────────────────────────────────────────
export interface PlanningFilters {
  iterations: string[]   // multi-select
  priority: string
  statuses: string[]     // multi-select
  testers: string[]      // multi-select
  testLeads: string[]    // multi-select
  uatDateFrom: string
  uatDateTo: string
  goLiveDateFrom: string
  goLiveDateTo: string
  search: string
}

export type PlanningSortField =
  | 'testDate' | 'uatDate' | 'goLiveDate'
  | 'priority' | 'testingPercent' | 'testEstimateDay'
  | 'tester' | 'status'

export interface PlanningSortState {
  field: PlanningSortField
  dir: 'asc' | 'desc'
}

// ── Urgency helpers ──────────────────────────────────────────────────────────
export type UrgencyFlag =
  | 'critical-priority'
  | 'uat-near'
  | 'golive-near'
  | 'missing-tester'
  | 'missing-estimate'

export function getUrgencyFlags(row: PlanningProject, today: Date = new Date()): UrgencyFlag[] {
  const flags: UrgencyFlag[] = []
  const todayMs = today.getTime()
  const nearMs = 7 * 24 * 60 * 60 * 1000  // 7 days

  if (row.priority === 'Critical') flags.push('critical-priority')
  if (row.uatDate) {
    const diff = new Date(row.uatDate).getTime() - todayMs
    if (diff >= 0 && diff <= nearMs) flags.push('uat-near')
  }
  if (row.goLiveDate) {
    const diff = new Date(row.goLiveDate).getTime() - todayMs
    if (diff >= 0 && diff <= nearMs) flags.push('golive-near')
  }
  if (!row.tester?.trim()) flags.push('missing-tester')
  if (row.testEstimateDay == null) flags.push('missing-estimate')

  return flags
}

// Priority sort order
export const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, '': 4,
}
