import * as XLSX from 'xlsx'
import type { ImportedRow, Employee, TaskStatus } from '../types'

// Expected column names (case-insensitive, trim)
const COL_MAP: Record<string, keyof ImportedRow> = {
  'task id': 'taskId', 'taskid': 'taskId',
  'task name': 'taskName', 'taskname': 'taskName', 'ชื่องาน': 'taskName',
  'assignee': 'assigneeRaw', 'ผู้รับผิดชอบ': 'assigneeRaw',
  'estimated hours': 'estimatedHours', 'hours': 'estimatedHours', 'ชั่วโมง': 'estimatedHours',
  'deadline': 'deadline', 'วันสิ้นสุด': 'deadline',
  'status': 'status', 'สถานะ': 'status',
  'project': 'projectRaw', 'โปรเจกต์': 'projectRaw',
  'period start': 'periodStart', 'periodstart': 'periodStart',
  'period end': 'periodEnd', 'periodend': 'periodEnd',
}

const VALID_STATUSES: TaskStatus[] = ['Pending', 'In-Progress', 'Done', 'Cancelled']

function excelDateToISO(v: unknown): string | undefined {
  if (typeof v === 'string') {
    // Already string — try to parse
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return undefined
  }
  if (typeof v === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(v)
    if (!date) return undefined
    const y = date.y, m = String(date.m).padStart(2, '0'), d = String(date.d).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return undefined
}

function matchEmployee(raw: string, employees: Employee[]): string | undefined {
  const q = raw.trim().toLowerCase()
  return employees.find(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase() === q ||
    e.id.toLowerCase() === q ||
    e.firstName.toLowerCase() === q
  )?.id
}

export function parseWorkbook(buffer: ArrayBuffer, employees: Employee[], defaultPeriodStart: string, defaultPeriodEnd: string): ImportedRow[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  if (raw.length < 2) return []

  // Build header map: colIndex → field
  const headers: (keyof ImportedRow | null)[] = (raw[0] as unknown[]).map(h =>
    COL_MAP[String(h).trim().toLowerCase()] ?? null
  )

  const rows: ImportedRow[] = []

  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[]
    // Skip empty rows
    if (cells.every(c => c === '' || c === null || c === undefined)) continue

    const entry: ImportedRow = { rowNo: i + 1 }
    const errors: string[] = []

    headers.forEach((field, colIdx) => {
      if (!field) return
      const val = cells[colIdx]
      if (field === 'estimatedHours') {
        const n = Number(val)
        entry.estimatedHours = isNaN(n) ? undefined : n
      } else if (field === 'deadline' || field === 'periodStart' || field === 'periodEnd') {
        const d = excelDateToISO(val)
        ;(entry as any)[field] = d
      } else if (field === 'status') {
        const s = String(val).trim()
        entry.status = VALID_STATUSES.includes(s as TaskStatus) ? s as TaskStatus : 'Pending'
      } else {
        ;(entry as any)[field] = String(val).trim() || undefined
      }
    })

    // Auto-generate task ID if missing
    if (!entry.taskId) entry.taskId = `IMP-${Date.now()}-${i}`

    // Default period if not in file
    if (!entry.periodStart) entry.periodStart = defaultPeriodStart
    if (!entry.periodEnd)   entry.periodEnd   = defaultPeriodEnd

    // Match assignee to employee
    if (entry.assigneeRaw) {
      const matched = matchEmployee(entry.assigneeRaw, employees)
      if (matched) {
        entry.assigneeId = matched
      } else {
        errors.push(`ไม่พบพนักงาน "${entry.assigneeRaw}"`)
      }
    }

    // Validations (BR-CON-002, BR-CON-003)
    if (!entry.taskName) errors.push('ไม่มีชื่องาน (Task Name)')
    if (!entry.estimatedHours || entry.estimatedHours <= 0) errors.push('Estimated Hours ต้องมากกว่า 0')
    if (!entry.deadline) errors.push('ไม่มี Deadline')

    if (errors.length > 0) entry.error = errors.join(' | ')
    rows.push(entry)
  }

  return rows
}
