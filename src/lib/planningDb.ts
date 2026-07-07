import { supabase, isConfigured } from './supabase'
import type { PlanningProject, PlanningImportResult } from '../types/planning'

export const FALLBACK_TESTER_FLAGS = [
  'Delay from Other team', 'Follow up plan', 'Wait confirm', 'Can be postpone',
  'No need Tester', 'Wait kickoff', 'Follow Feature', 'Testcase', 'On going',
  'Test on plan', 'Test delay', 'Testing hold', 'Support UAT', 'Test Done',
  'Deployed', 'Support PRD',
]

function parseTesterFlag(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

function throwIf(error: unknown, ctx: string) {
  if (error) throw new Error(`[planningDb/${ctx}] ${(error as any).message}`)
}

function toRow(p: PlanningProject) {
  return {
    id:               p.id,
    iteration:        p.iteration       || null,
    project_name:     p.projectName,
    item_type:        p.itemType        || null,
    feature:          p.feature         || null,
    tags:             p.tags            || null,
    status:           p.status          || null,
    test_lead:        p.testLead        || null,
    priority:         p.priority        || null,
    tester:           p.tester          || null,
    go_live_date:     p.goLiveDate      || null,
    uat_date:         p.uatDate         || null,
    testing_percent:  p.testingPercent  ?? null,
    tester_flag:      (p.testerFlag && p.testerFlag.length > 0) ? JSON.stringify(p.testerFlag) : null,
    tester_note:      p.testerNote      || null,
    test_estimate_day:p.testEstimateDay ?? null,
    test_date:        p.testDate        || null,
    remark_to_pmos:   p.remarkToPmos    || null,
    pm:               p.pm              || null,
    ba_note:          p.baNote          || null,
    quotation_no:     p.quotationNo     || null,
    epic_no:          p.epicNo          || null,
    raw_import_data:  p.rawImportData ?? null,
  }
}

function fromRow(r: any): PlanningProject {
  return {
    id:               r.id,
    iteration:        r.iteration        ?? '',
    projectName:      r.project_name,
    itemType:         r.item_type        ?? '',
    feature:          r.feature          ?? '',
    tags:             r.tags             ?? '',
    status:           r.status           ?? '',
    testLead:         r.test_lead        ?? '',
    priority:         r.priority         ?? '' as any,
    tester:           r.tester           ?? '',
    goLiveDate:       r.go_live_date     ?? null,
    uatDate:          r.uat_date         ?? null,
    testingPercent:   r.testing_percent  ?? null,
    testerFlag:       parseTesterFlag(r.tester_flag),
    testerNote:       r.tester_note      ?? '',
    testEstimateDay:  r.test_estimate_day ?? null,
    testDate:         r.test_date        ?? null,
    remarkToPmos:     r.remark_to_pmos   ?? '',
    pm:               r.pm               ?? '',
    baNote:           r.ba_note          ?? '',
    quotationNo:      r.quotation_no     ?? '',
    epicNo:           r.epic_no          ?? '',
    rawImportData:    r.raw_import_data  ?? undefined,
    createdAt:        r.created_at,
    updatedAt:        r.updated_at,
  }
}

export const planningDb = {
  async getAll(): Promise<PlanningProject[]> {
    if (!isConfigured) return []
    const { data, error } = await (supabase as any)
      .from('planning_projects')
      .select('*')
      .order('uat_date', { ascending: true, nullsFirst: false })
    throwIf(error, 'getAll')
    return (data ?? []).map(fromRow)
  },

  async getExistingIds(ids: string[]): Promise<Set<string>> {
    if (!isConfigured || ids.length === 0) return new Set()
    const { data, error } = await (supabase as any)
      .from('planning_projects')
      .select('id')
      .in('id', ids)
    throwIf(error, 'getExistingIds')
    return new Set((data ?? []).map((r: any) => r.id as string))
  },

  async upsertMany(projects: PlanningProject[]): Promise<PlanningImportResult> {
    const result: PlanningImportResult = {
      totalRows: projects.length,
      insertedRows: 0,
      updatedRows: 0,
      failedRows: 0,
      errors: [],
    }
    if (!isConfigured || projects.length === 0) return result

    const existingIds = await planningDb.getExistingIds(projects.map(p => p.id))

    const BATCH = 100
    for (let i = 0; i < projects.length; i += BATCH) {
      const batch = projects.slice(i, i + BATCH)
      const rows  = batch.map(toRow)

      const { error } = await (supabase as any)
        .from('planning_projects')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: false })

      if (error) {
        batch.forEach(p => {
          result.failedRows++
          result.errors.push({ rowNo: 0, id: p.id, message: error.message })
        })
      } else {
        batch.forEach(p => {
          if (existingIds.has(p.id)) result.updatedRows++
          else result.insertedRows++
        })
      }
    }
    return result
  },

  async deleteById(id: string): Promise<void> {
    if (!isConfigured) return
    const { error } = await (supabase as any)
      .from('planning_projects').delete().eq('id', id)
    throwIf(error, 'deleteById')
  },

  async updateField(id: string, field: string, value: unknown): Promise<void> {
    if (!isConfigured) return
    const { error } = await (supabase as any)
      .from('planning_projects').update({ [field]: value }).eq('id', id)
    throwIf(error, 'updateField')
  },

  async updateFields(id: string, fields: Record<string, unknown>): Promise<void> {
    if (!isConfigured || Object.keys(fields).length === 0) return
    const { error } = await (supabase as any)
      .from('planning_projects').update(fields).eq('id', id)
    throwIf(error, 'updateFields')
  },

  async getTesterFlags(): Promise<string[]> {
    if (!isConfigured) return FALLBACK_TESTER_FLAGS
    try {
      const { data, error } = await (supabase as any)
        .from('master_tester_flags')
        .select('value')
        .order('sort_order', { ascending: true })
      if (error) return FALLBACK_TESTER_FLAGS
      const result = (data ?? []).map((r: any) => r.value as string)
      // If table exists but has no rows, use fallback
      return result.length > 0 ? result : FALLBACK_TESTER_FLAGS
    } catch {
      return FALLBACK_TESTER_FLAGS
    }
  },
}
