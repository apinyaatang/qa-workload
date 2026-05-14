/**
 * staffCsvParser.ts
 * Parses the "Testing team.csv" format into Employee objects.
 *
 * CSV columns (from actual file):
 *   Employee ID, Employee, Number of organization, Position,
 *   Start date, Status, In active date, Tier, Group,
 *   Birthdate, WFH
 */
import Papa from 'papaparse'
import type { Employee } from '../types'

// ─── Name parsing ─────────────────────────────────────────────────────────────

/**
 * Parse "FirstName LastName (Nickname)" → { firstName, lastName, nickname }
 * Handles cases with no last name or no nickname.
 */
export function parseEmployeeName(raw: string): {
  firstName: string
  lastName: string
  nickname: string
} {
  const s = raw.trim()
  const nicknameMatch = s.match(/\(([^)]+)\)\s*$/)
  const nickname = nicknameMatch ? nicknameMatch[1].trim() : ''
  const namePart = nicknameMatch ? s.slice(0, nicknameMatch.index).trim() : s

  const parts = namePart.split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? ''
  const lastName  = parts.slice(1).join(' ')

  return { firstName, lastName, nickname }
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/** Parse M/D/YYYY or MM/DD/YYYY → YYYY-MM-DD */
function parseDate(raw: string): string | undefined {
  const s = raw?.trim()
  if (!s) return undefined
  const parts = s.split('/')
  if (parts.length !== 3) return undefined
  const m = parseInt(parts[0], 10)
  const d = parseInt(parts[1], 10)
  const y = parseInt(parts[2], 10)
  if (isNaN(m) || isNaN(d) || isNaN(y)) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ─── WFH parsing ──────────────────────────────────────────────────────────────

/** Parse `["Mon","Fri"]` string → string[] */
function parseWfhDays(raw: string): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw.trim())
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // Fallback: split by comma
    return raw.replace(/[\[\]"']/g, '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// ─── Row validation result ────────────────────────────────────────────────────

export interface StaffCsvRow {
  rowNo: number
  data: Employee
  isValid: boolean
  errors: string[]
  willUpdate: boolean  // set after matching against existing employees
}

export interface StaffParseResult {
  rows: StaffCsvRow[]
  totalRows: number
  validRows: number
  errorRows: number
  parseError?: string
}

// ─── Map single row ───────────────────────────────────────────────────────────

function mapRow(raw: Record<string, string>, rowNo: number): StaffCsvRow {
  const errors: string[] = []

  // Normalise keys
  const norm: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    // strip BOM from first key
    norm[k.replace(/^﻿/, '').trim().toLowerCase()] = v
  }

  const idRaw      = norm['employee id']?.trim() ?? ''
  const nameRaw    = norm['employee']?.trim() ?? ''
  const posRaw     = norm['position']?.trim() ?? ''
  const startRaw   = norm['start date']?.trim() ?? ''
  const statusRaw  = norm['status']?.trim() ?? ''

  if (!idRaw)   errors.push('Employee ID is required')
  if (!nameRaw) errors.push('Employee name is required')

  const { firstName, lastName, nickname } = parseEmployeeName(nameRaw)
  const startDate  = parseDate(startRaw)
  if (startRaw && !startDate) errors.push(`Invalid Start date: "${startRaw}"`)

  const inactiveDateRaw = norm['in active date']?.trim() ?? ''
  const birthdateRaw    = norm['birthdate']?.trim() ?? ''
  const orgNumberRaw    = norm['number of organization']?.trim() ?? ''

  const isActive  = statusRaw.toLowerCase() !== 'inactive'
  const orgNumber = orgNumberRaw ? parseInt(orgNumberRaw, 10) : undefined

  const data: Employee = {
    id:           idRaw || `staff-${rowNo}`,
    employeeCode: idRaw || undefined,
    firstName,
    lastName,
    nickname:     nickname || undefined,
    department:   norm['group']?.trim() || '',
    position:     posRaw,
    skills:       [],
    startDate:    startDate ?? '',
    isActive,
    orgNumber:    isNaN(orgNumber!) ? undefined : orgNumber,
    group:        norm['group']?.trim() || undefined,
    tier:         norm['tier']?.trim() || undefined,
    wfhDays:      parseWfhDays(norm['wfh'] ?? ''),
    inactiveDate: parseDate(inactiveDateRaw),
    birthdate:    parseDate(birthdateRaw),
  }

  return { rowNo, data, isValid: errors.length === 0, errors, willUpdate: false }
}

// ─── Public parser ────────────────────────────────────────────────────────────

export function parseStaffCsv(
  csvText: string,
  existingIds: Set<string> = new Set(),
): StaffParseResult {
  // Strip BOM
  const text = csvText.replace(/^﻿/, '')

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.replace(/^﻿/, '').trim(),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return {
      rows: [], totalRows: 0, validRows: 0, errorRows: 0,
      parseError: result.errors.map(e => e.message).join('; '),
    }
  }

  const rows = result.data.map((raw, i) => {
    const row = mapRow(raw, i + 2)
    row.willUpdate = existingIds.has(row.data.id)
    return row
  })

  return {
    rows,
    totalRows: rows.length,
    validRows:  rows.filter(r => r.isValid).length,
    errorRows:  rows.filter(r => !r.isValid).length,
  }
}

// ─── Employee name matching (for Gantt tester → Employee lookup) ──────────────

/**
 * Build a lookup map from an employee list for fast tester-name resolution.
 * Keys: lowercase variants of full name, nickname, and first name.
 */
export function buildEmployeeMap(employees: Employee[]): Map<string, Employee> {
  const map = new Map<string, Employee>()
  for (const e of employees) {
    const first = e.firstName.toLowerCase().trim()
    const last  = e.lastName.toLowerCase().trim()
    const full  = `${first} ${last}`.trim()

    // Priority keys (most specific first — set last so they don't get overwritten)
    if (e.nickname) {
      // "firstname lastname (nickname)" — exact match with planning CSV format
      const fullWithNick = `${full} (${e.nickname.toLowerCase()})`
      map.set(fullWithNick, e)
    }
    map.set(full, e)                                     // "firstname lastname"
    if (e.nickname) map.set(e.nickname.toLowerCase(), e) // nickname only (fallback)
    if (first)      map.set(first, e)                    // first name only (weakest)
    if (e.employeeCode) map.set(e.employeeCode, e)       // employee ID
  }
  return map
}

/** Resolve a tester string to an Employee, or undefined. */
export function resolveEmployee(
  testerStr: string,
  employeeMap: Map<string, Employee>,
): Employee | undefined {
  if (!testerStr?.trim()) return undefined
  const q = testerStr.trim().toLowerCase()

  // 1. Exact match — handles "Firstname Lastname (Nick)" format directly
  if (employeeMap.has(q)) return employeeMap.get(q)

  // 2. Strip nickname → try "firstname lastname"
  const nameOnly = q.replace(/\s*\([^)]+\)\s*$/, '').trim()
  if (nameOnly !== q && employeeMap.has(nameOnly)) return employeeMap.get(nameOnly)

  // 3. Extract nickname → try nickname key
  const nickMatch = q.match(/\(([^)]+)\)\s*$/)
  if (nickMatch) {
    const nick = nickMatch[1].trim()
    if (employeeMap.has(nick)) return employeeMap.get(nick)
  }

  // 4. First-name prefix match (weakest, last resort)
  for (const [key, emp] of employeeMap) {
    if (key.length >= 4 && q.startsWith(key)) return emp
  }

  return undefined
}
