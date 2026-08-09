import { supabase, isConfigured } from './supabase'
import { subtractWorkingDaysH } from '../utils/workingDayUtils'
import type { Epic, AzureDevOpsConfig } from '../types/epic'

export function calcEpicTestDate(
  uatDate: string | null,
  targetDate: string | null,
  estimateDays: number | null,
  holidays: Set<string> = new Set(),
): string | null {
  const base = uatDate || targetDate
  if (!base) return null
  const baseDate = new Date(base + 'T00:00:00')
  if (isNaN(baseDate.getTime())) return null
  if (estimateDays != null && estimateDays > 0) {
    return subtractWorkingDaysH(baseDate, estimateDays, holidays).toISOString().slice(0, 10)
  }
  const d = new Date(baseDate)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ─── Row mapper ────────────────────────────────────────────────────────────────

function fromRow(r: any): Epic {
  const rawFlag = r.tester_flag
  const testerFlag: string[] = Array.isArray(rawFlag)
    ? rawFlag
    : typeof rawFlag === 'string'
    ? (() => { try { return JSON.parse(rawFlag) } catch { return [] } })()
    : []
  return {
    id:              r.id,
    epicNo:          r.epic_no,
    itemType:        r.item_type        ?? '',
    iteration:       r.iteration        ?? '',
    project:         r.project          ?? '',
    feature:         r.feature          ?? '',
    state:           r.state            ?? '',
    sitDate:         r.sit_date         ?? null,
    uatDate:         r.uat_date         ?? null,
    targetDate:      r.target_date      ?? null,
    testDate:        r.test_date        ?? null,
    testingPercent:  r.testing_percent  ?? null,
    testerFlag,
    testerNote:      r.tester_note      ?? '',
    testEstimateDay: r.test_estimate_day ?? null,
    testLead:        r.test_lead        ?? '',
    testOwner:       r.test_owner       ?? '',
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  }
}

// ─── DB service ────────────────────────────────────────────────────────────────

export const epicDb = {
  async getAll(): Promise<Epic[]> {
    if (!isConfigured) return []
    const { data, error } = await (supabase as any)
      .from('epics')
      .select('*')
      .order('epic_no', { ascending: true })
    if (error) throw new Error(`[epicDb/getAll] ${error.message}`)
    return (data ?? []).map(fromRow)
  },

  async updateFieldsChecked(
    id: string,
    fields: Record<string, unknown>,
    knownUpdatedAt?: string,
  ): Promise<{ ok: true; updatedAt: string } | { ok: false; reason: 'conflict' | 'error' }> {
    if (!isConfigured) return { ok: true, updatedAt: new Date().toISOString() }
    try {
      let q = (supabase as any).from('epics').update(fields).eq('id', id)
      if (knownUpdatedAt) q = q.eq('updated_at', knownUpdatedAt)
      const { data, error } = await q.select('updated_at')
      if (error) return { ok: false, reason: 'error' }
      if (!data || data.length === 0) return { ok: false, reason: 'conflict' }
      return { ok: true, updatedAt: data[0].updated_at as string }
    } catch {
      return { ok: false, reason: 'error' }
    }
  },
}

// ─── Azure DevOps sync ─────────────────────────────────────────────────────────

function getIterationNumber(path: string): number {
  const match = path.match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : 0
}

const ADO_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.AreaPath',
  'System.IterationPath',
  'System.WorkItemType',
  'Microsoft.VSTS.Scheduling.TargetDate',
  'Custom.SITDate',
  'Custom.UATDate',
  'Custom.TypeofEpic',
].join(',')

export interface SyncResult {
  inserted:       number
  updated:        number
  skipped:        number
  total:          number
  totalFromAdo:   number   // all epics before iteration filter
  errors:         string[]
  samplePaths:    string[] // first 3 IterationPath values (for debugging)
}

export async function syncEpicsFromAdo(
  config: AzureDevOpsConfig,
  holidays: Set<string> = new Set(),
): Promise<SyncResult> {
  const { orgUrl, project, pat } = config
  const base64Pat = btoa(`:${pat}`)
  const authHeader = `Basic ${base64Pat}`
  const apiBase    = `${orgUrl.replace(/\/$/, '')}/${encodeURIComponent(project)}/_apis`

  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, total: 0, totalFromAdo: 0, errors: [], samplePaths: [] }

  // ── Step 1: WIQL — get all Epic IDs ─────────────────────────────────────────
  const wiqlRes = await fetch(`${apiBase}/wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      query: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Epic' ORDER BY [System.ChangedDate] DESC",
    }),
  })
  if (!wiqlRes.ok) throw new Error(`WIQL failed: ${wiqlRes.status} ${await wiqlRes.text()}`)
  const wiqlData = await wiqlRes.json()
  const allIds: number[] = (wiqlData.workItems ?? wiqlData.workItemRelations ?? []).map((w: any) => w.id ?? w.target?.id).filter(Boolean)
  result.totalFromAdo = allIds.length
  if (allIds.length === 0) return result

  // ── Step 2: Batch fetch details (max 200 per request) ────────────────────────
  const BATCH = 200
  const allItems: any[] = []
  for (let i = 0; i < allIds.length; i += BATCH) {
    const batchIds = allIds.slice(i, i + BATCH).join(',')
    const wiRes = await fetch(
      `${apiBase}/wit/workitems?ids=${batchIds}&fields=${ADO_FIELDS}&api-version=7.0`,
      { headers: { Authorization: authHeader } },
    )
    if (!wiRes.ok) {
      result.errors.push(`Batch ${i / BATCH + 1} failed: ${wiRes.status}`)
      continue
    }
    const wiData = await wiRes.json()
    allItems.push(...(wiData.value ?? []))
  }

  // ── Step 3: Filter IterationPath trailing number > 230 ───────────────────────
  result.samplePaths = allItems.slice(0, 5).map(item => item.fields?.['System.IterationPath'] ?? '(no path)')
  const filtered = allItems.filter(item => {
    const path = item.fields?.['System.IterationPath'] ?? ''
    return getIterationNumber(path) > 230
  })
  result.total = filtered.length

  if (filtered.length === 0) return result

  // ── Step 4: Fetch existing epics (to decide insert vs update) ────────────────
  if (!isConfigured) throw new Error('Supabase not configured')
  const { data: existing } = await (supabase as any)
    .from('epics')
    .select('id, epic_no, test_estimate_day, uat_date, target_date, testing_percent, tester_flag, tester_note, test_lead, test_owner, updated_at')
  const existingMap = new Map<number, any>((existing ?? []).map((r: any) => [r.epic_no, r]))

  // ── Step 5: Upsert ───────────────────────────────────────────────────────────
  for (const item of filtered) {
    const f = item.fields ?? {}
    const epicNo: number = f['System.Id']
    const uatDate    = f['Custom.UATDate']    ? f['Custom.UATDate'].slice(0, 10)                                    : null
    const targetDate = f['Microsoft.VSTS.Scheduling.TargetDate'] ? f['Microsoft.VSTS.Scheduling.TargetDate'].slice(0, 10) : null
    const sitDate    = f['Custom.SITDate']    ? f['Custom.SITDate'].slice(0, 10)                                   : null

    const existing = existingMap.get(epicNo)
    const estDay   = existing?.test_estimate_day ?? null
    const testDate = calcEpicTestDate(uatDate, targetDate, estDay, holidays)

    const adoFields = {
      epic_no:   epicNo,
      item_type: f['Custom.TypeofEpic'] ?? f['System.WorkItemType'] ?? '',
      iteration: f['System.IterationPath'] ?? '',
      project:   f['System.AreaPath']     ?? '',
      feature:   f['System.Title']        ?? '',
      state:     f['System.State']        ?? '',
      sit_date:  sitDate,
      uat_date:  uatDate,
      target_date: targetDate,
      test_date: testDate,
    }

    try {
      if (existing) {
        // Update only Azure DevOps fields + recalculate test_date
        const { error } = await (supabase as any)
          .from('epics')
          .update(adoFields)
          .eq('id', existing.id)
        if (error) { result.errors.push(`Update epic ${epicNo}: ${error.message}`); continue }
        result.updated++
      } else {
        // Insert with null defaults for QA fields
        const { error } = await (supabase as any)
          .from('epics')
          .insert({ ...adoFields, testing_percent: null, tester_flag: null, tester_note: '', test_estimate_day: null, test_lead: '', test_owner: '' })
        if (error) { result.errors.push(`Insert epic ${epicNo}: ${error.message}`); continue }
        result.inserted++
      }
    } catch (e: any) {
      result.errors.push(`Epic ${epicNo}: ${e.message}`)
    }
  }

  result.skipped = result.total - result.inserted - result.updated - result.errors.length
  return result
}
