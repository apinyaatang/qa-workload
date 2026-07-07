import Papa from 'papaparse'
import type { PlanningProject, PlanningCsvRow } from '../types/planning'
import { subtractWorkingDaysH } from './workingDayUtils'

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parse M/D/YYYY or MM/DD/YYYY → ISO date string (YYYY-MM-DD)
 * Returns null for empty / invalid input.
 */
export function parseCsvDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const m = parseInt(parts[0], 10)
  const d = parseInt(parts[1], 10)
  const y = parseInt(parts[2], 10)
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const dt = new Date(iso)
  if (isNaN(dt.getTime())) return null
  return iso
}

/**
 * Subtract N working days (Mon–Fri) from a date — weekend-only version.
 * Kept for backward-compatibility with existing tests.
 * New code should use subtractWorkingDaysH from workingDayUtils.ts.
 */
export function subtractWorkingDays(fromDate: Date, days: number): Date {
  return subtractWorkingDaysH(fromDate, days, new Set())
}

// ─── New helpers (exported for testing) ──────────────────────────────────────

/**
 * Choose the base date for test_date calculation.
 * Prefers UAT Date; falls back to Go Live Date when UAT is absent.
 */
export function getBaseDate(
  uatDate: string | null,
  goLiveDate: string | null,
): string | null {
  return uatDate ?? goLiveDate ?? null
}

/**
 * Strip the "Buzzebees\" prefix (case-insensitive) from a project name
 * and trim surrounding whitespace.
 */
export function cleanProjectName(raw: string): string {
  return raw.trim().replace(/^Buzzebees\\/i, '').trim()
}

/**
 * Calculate test_date given UAT Date, Go Live Date, estimate days,
 * and an optional set of public holiday ISO strings.
 *
 * Logic:
 *   base = UAT Date if present, else Go Live Date
 *   test_date = base − estimateDays (working days, skipping weekends + holidays)
 *   Returns null when base is null or estimateDays ≤ 0.
 */
export function calcTestDate(
  uatDate: string | null,
  goLiveDate: string | null,
  estimateDays: number | null,
  holidays: Set<string> = new Set(),
): string | null {
  const base = getBaseDate(uatDate, goLiveDate)
  if (!base || estimateDays == null || estimateDays <= 0) return null
  const baseDate = new Date(base)
  if (isNaN(baseDate.getTime())) return null
  const result = subtractWorkingDaysH(baseDate, estimateDays, holidays)
  return result.toISOString().slice(0, 10)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase()
}

// ─── Single-row mapper ────────────────────────────────────────────────────────

function mapRow(
  raw: Record<string, string>,
  rowNo: number,
  holidays: Set<string>,
): PlanningCsvRow {
  const errors: string[] = []

  // Build normalised lookup so column order doesn't matter
  const norm: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    norm[normaliseHeader(k)] = v
  }

  // Required fields validation
  const idRaw       = norm['id']?.trim() ?? ''
  const rawName     = norm['project name']?.trim() ?? ''
  const projectName = cleanProjectName(rawName)
  const uatRaw      = norm['uat date']?.trim() ?? ''
  const estRaw      = norm['test estimate (day)']?.trim() ?? ''

  if (!idRaw)        errors.push('ID is required')
  if (!projectName)  errors.push('Project name is required')

  // Dates
  const uatDate    = parseCsvDate(uatRaw)
  const goLiveDate = parseCsvDate(norm['go live date']?.trim() ?? '')

  if (uatRaw && !uatDate) errors.push(`Invalid UAT Date: "${uatRaw}"`)

  // Numerics
  const testEstimateDay = estRaw !== '' ? parseFloat(estRaw) : null
  if (estRaw !== '' && isNaN(testEstimateDay!)) errors.push(`Invalid Test Estimate: "${estRaw}"`)

  const testingRaw     = norm['testing (%)']?.trim() ?? ''
  const testingPercent = testingRaw !== '' ? parseFloat(testingRaw) : null

  // Calculated test_date (now with goLiveDate fallback + holiday awareness)
  const testDate = calcTestDate(uatDate, goLiveDate, testEstimateDay, holidays)

  const data: Partial<PlanningProject> = {
    id:               idRaw   || undefined,
    iteration:        norm['iteration']?.trim()   ?? '',
    projectName,
    itemType:         norm['item type']?.trim()   ?? '',
    feature:          norm['feature']?.trim()     ?? '',
    tags:             norm['tags']?.trim()        ?? '',
    status:           norm['status']?.trim()      ?? '',
    testLead:         norm['test buddy']?.trim()  ?? '',
    priority:         (norm['priority']?.trim()   ?? '') as any,
    tester:           norm['tester']?.trim()      ?? '',
    goLiveDate,
    uatDate,
    testingPercent,
    testerFlag:       (() => {
      const raw = norm['tester flag']?.trim() ?? ''
      if (!raw) return [] as string[]
      if (raw.startsWith('[')) {
        try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] } catch { return [raw] }
      }
      return [raw]
    })(),
    testerNote:       norm['tester note']?.trim()      ?? '',
    testEstimateDay,
    testDate,
    remarkToPmos:     norm['remark to pmos']?.trim()   ?? '',
    pm:               norm['pm']?.trim()               ?? '',
    baNote:           norm['ba note']?.trim()          ?? '',
    quotationNo:      norm['quotation no.']?.trim()    ?? '',
    epicNo:           norm['epic no.']?.trim()         ?? '',
    rawImportData:    raw,
  }

  return {
    rowNo,
    data,
    rawData: raw,
    errors,
    isValid: errors.length === 0,
    willUpdate: false,
  }
}

// ─── Public parser ────────────────────────────────────────────────────────────

export interface ParseResult {
  rows: PlanningCsvRow[]
  totalRows: number
  validRows: number
  errorRows: number
  parseError?: string
}

export interface ParseOptions {
  holidays?: Set<string>
}

export function parsePlanningCsv(csvText: string, options?: ParseOptions): ParseResult {
  const holidays = options?.holidays ?? new Set<string>()

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return {
      rows: [], totalRows: 0, validRows: 0, errorRows: 0,
      parseError: result.errors.map(e => e.message).join('; '),
    }
  }

  const rows: PlanningCsvRow[] = result.data.map((raw, i) => mapRow(raw, i + 2, holidays))
  return {
    rows,
    totalRows: rows.length,
    validRows: rows.filter(r => r.isValid).length,
    errorRows: rows.filter(r => !r.isValid).length,
  }
}

// ─── Validation helper ────────────────────────────────────────────────────────

export function validateRequiredColumns(csvText: string): string[] {
  const firstLine = csvText.split('\n')[0] ?? ''
  const headers   = Papa.parse<string[]>(firstLine, { header: false }).data[0] ?? []
  const normHeaders = headers.map(normaliseHeader)

  const required = ['id', 'project name', 'uat date', 'test estimate (day)']
  return required.filter(r => !normHeaders.includes(r))
}
