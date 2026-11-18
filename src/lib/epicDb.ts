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

export const PROGRESS_RETENTION_DAYS = 30

/**
 * Tester Flag อัตโนมัติจากจำนวน Archieved
 *   Archieved = Total (Total > 0)  → ['Deployed']
 *   0 < Archieved < Total          → ['Recheck']
 *   Archieved = 0 / ไม่มี item     → undefined (ไม่แตะ flag เดิม)
 * Total ในที่นี้ = User Story + Bug ทุก State รวม Archieved ไม่รวม Retired
 */
export function autoTesterFlag(archived: number, totalWithArchived: number): string[] | undefined {
  if (totalWithArchived <= 0 || archived <= 0) return undefined
  return archived >= totalWithArchived ? ['Deployed'] : ['Recheck']
}

function progressPercents(c: { total: number; DEV: number; BA: number; QA: number; WFD: number }) {
  const p = (n: number) => (c.total > 0 ? Math.round((n / c.total) * 100) : null)
  return {
    dev_percent:     p(c.DEV),
    ba_percent:      p(c.BA),
    testing_percent: p(c.QA),
    done_percent:    p(c.WFD),
  }
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
    pmName:          r.pm_name          ?? '',
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
    buddy1:          r.buddy1           ?? '',
    buddy2:          r.buddy2           ?? '',
    buddy3:          r.buddy3           ?? '',
    itemsTotal:       r.items_total        ?? null,
    devCount:         r.dev_count          ?? null,
    baCount:          r.ba_count           ?? null,
    qaCount:          r.qa_count           ?? null,
    waitConfirmCount: r.wait_confirm_count ?? null,
    waitDeployCount:  r.wait_deploy_count  ?? null,
    archivedCount:          r.archived_count            ?? null,
    itemsTotalWithArchived: r.items_total_with_archived ?? null,
    archivedPercent: r.archived_count != null && r.items_total_with_archived > 0
      ? Math.round((r.archived_count / r.items_total_with_archived) * 100)
      : null,
    itemsSyncedAt:    r.items_synced_at    ?? null,
    devPercent:       r.dev_percent  != null ? Number(r.dev_percent)  : null,
    baPercent:        r.ba_percent   != null ? Number(r.ba_percent)   : null,
    donePercent:      r.done_percent != null ? Number(r.done_percent) : null,
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

// ADO returns dates as UTC ISO strings (e.g. "2026-08-19T17:00:00Z" = midnight Bangkok time).
// Parse with local timezone so the date reflects the user's local calendar day.
function adoDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Custom.PMName มาเป็น string แต่ถ้าวันหนึ่งถูกเปลี่ยนเป็น Identity field จะมาเป็น object
function adoPersonName(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') return v.trim()
  return String((v as { displayName?: string }).displayName ?? '').trim()
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
  'Custom.TestEstimate',
  'Custom.PMName',
].join(',')

export interface SyncResult {
  inserted:       number
  updated:        number
  skipped:        number
  total:          number
  totalFromAdo:   number   // all epics before iteration filter
  errors:         string[]
  samplePaths:    string[] // first 3 IterationPath values (for debugging)
  itemsTotal:     number   // total User Story/Bug items fetched
  itemsUpdated:   number   // epics whose item counts were saved
}

export async function syncEpicsFromAdo(
  config: AzureDevOpsConfig,
  holidays: Set<string> = new Set(),
): Promise<SyncResult> {
  const { orgUrl, project, pat } = config
  const base64Pat = btoa(`:${pat}`)
  const authHeader = `Basic ${base64Pat}`
  const apiBase    = `${orgUrl.replace(/\/$/, '')}/${encodeURIComponent(project)}/_apis`

  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, total: 0, totalFromAdo: 0, errors: [], samplePaths: [], itemsTotal: 0, itemsUpdated: 0 }

  // ── Item bucket definitions ──────────────────────────────────────────────────
  const ITEM_BUCKET: Record<string, string> = {
    'Ready': 'DEV', 'Development Doing': 'DEV', 'Edit': 'DEV', 'Reject': 'DEV',
    'Development Done': 'BA', 'BA Check Doing': 'BA', 'Development Reject': 'BA',
    'BA Check Done': 'QA', 'Testing': 'QA', 'Wait for test STG': 'QA',
    'Pending': 'WC', 'Waiting confirm': 'WC',
    'Wait for deploy': 'WFD',
  }

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
    const uatDate    = adoDateToIso(f['Custom.UATDate'])
    const targetDate = adoDateToIso(f['Microsoft.VSTS.Scheduling.TargetDate'])
    const sitDate    = adoDateToIso(f['Custom.SITDate'])

    const existing = existingMap.get(epicNo)
    // ถ้า ADO มีค่า Custom.TestEstimate ให้ใช้ค่านั้น ถ้าไม่มีให้คงค่าเดิมใน DB
    const adoEstRaw = f['Custom.TestEstimate']
    const estDay    = adoEstRaw != null ? Number(adoEstRaw) || null : (existing?.test_estimate_day ?? null)
    const testDate  = calcEpicTestDate(uatDate, targetDate, estDay, holidays)

    const adoFields = {
      epic_no:          epicNo,
      item_type:        f['Custom.TypeofEpic'] ?? f['System.WorkItemType'] ?? '',
      iteration:        f['System.IterationPath'] ?? '',
      project:          f['System.AreaPath']     ?? '',
      feature:          f['System.Title']        ?? '',
      state:            f['System.State']        ?? '',
      pm_name:          adoPersonName(f['Custom.PMName']),
      sit_date:         sitDate,
      uat_date:         uatDate,
      target_date:      targetDate,
      test_estimate_day: estDay,
      test_date:        testDate,
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
          .insert({ ...adoFields, testing_percent: null, tester_flag: null, tester_note: '', test_lead: '', test_owner: '', buddy1: '', buddy2: '', buddy3: '' })
        if (error) { result.errors.push(`Insert epic ${epicNo}: ${error.message}`); continue }
        result.inserted++
      }
    } catch (e: any) {
      result.errors.push(`Epic ${epicNo}: ${e.message}`)
    }
  }

  result.skipped = result.total - result.inserted - result.updated - result.errors.length

  // ── Step 6: Fetch and sync User Story / Bug counts ───────────────────────────
  const epicNos = filtered.map(item => item.fields?.['System.Id'] as number).filter(Boolean)
  if (epicNos.length > 0) {
    try {
      // 6a. Get features under these epics
      const featureWiqlRes = await fetch(`${apiBase}/wit/wiql?api-version=7.0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='Buzzebees' AND [System.WorkItemType]='Feature' AND [System.Parent] IN (${epicNos.join(',')})`,
        }),
      })
      const featureData = featureWiqlRes.ok ? await featureWiqlRes.json() : { workItems: [] }
      const featureIds: number[] = (featureData.workItems ?? []).map((w: any) => w.id).filter(Boolean)

      // 6b. Build feature→epic map (batch fetch feature details)
      const featureParentMap = new Map<number, number>()
      if (featureIds.length > 0) {
        for (let i = 0; i < featureIds.length; i += BATCH) {
          const batchIds = featureIds.slice(i, i + BATCH).join(',')
          const r = await fetch(
            `${apiBase}/wit/workitems?ids=${batchIds}&fields=System.Id,System.Parent&api-version=7.0`,
            { headers: { Authorization: authHeader } },
          )
          if (r.ok) {
            for (const feat of (await r.json()).value ?? []) {
              featureParentMap.set(feat.fields?.['System.Id'], feat.fields?.['System.Parent'])
            }
          }
        }
      }

      // 6c. Bulk WIQL for all User Story/Bug under epics + features
      const parentIds = [...epicNos, ...featureIds]
      const itemWiqlRes = await fetch(`${apiBase}/wit/wiql?api-version=7.0`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='Buzzebees' AND [System.WorkItemType] IN ('User Story','Bug') AND [System.Parent] IN (${parentIds.join(',')}) AND [System.State] <> 'Retired'`,
        }),
      })
      const itemIds: number[] = itemWiqlRes.ok
        ? ((await itemWiqlRes.json()).workItems ?? []).map((w: any) => w.id).filter(Boolean)
        : []

      // 6d. Batch fetch item details (State + Parent)
      const allItemDetails: any[] = []
      for (let i = 0; i < itemIds.length; i += BATCH) {
        const batchIds = itemIds.slice(i, i + BATCH).join(',')
        const r = await fetch(
          `${apiBase}/wit/workitems?ids=${batchIds}&fields=System.State,System.Parent&api-version=7.0`,
          { headers: { Authorization: authHeader } },
        )
        if (r.ok) allItemDetails.push(...((await r.json()).value ?? []))
      }
      result.itemsTotal = allItemDetails.length

      // 6e. Count per epic
      type Counts = { total: number; DEV: number; BA: number; QA: number; WC: number; WFD: number; archived: number; totalAll: number }
      const epicNosSet = new Set(epicNos)
      const counts = new Map<number, Counts>()
      for (const epicNo of epicNos) counts.set(epicNo, { total: 0, DEV: 0, BA: 0, QA: 0, WC: 0, WFD: 0, archived: 0, totalAll: 0 })

      for (const item of allItemDetails) {
        const f = item.fields ?? {}
        const state: string = f['System.State'] ?? ''
        const parent: number = f['System.Parent']
        const epicNo: number | undefined = epicNosSet.has(parent) ? parent : featureParentMap.get(parent)
        if (!epicNo || !counts.has(epicNo)) continue
        const c = counts.get(epicNo)!
        c.totalAll++
        // Archieved นับแยก — ไม่รวมใน total ที่ใช้คิด Dev/BA/Testing/Done %
        if (state === 'Archieved') { c.archived++; continue }
        c.total++
        const bucket = ITEM_BUCKET[state]
        if (bucket === 'DEV') c.DEV++
        else if (bucket === 'BA') c.BA++
        else if (bucket === 'QA') c.QA++
        else if (bucket === 'WC') c.WC++
        else if (bucket === 'WFD') c.WFD++
      }

      // 6f. Fetch DB id map (covers newly inserted epics too) and update counts
      const { data: epicRows } = await (supabase as any)
        .from('epics').select('id, epic_no').in('epic_no', epicNos)
      const epicNoToId = new Map<number, string>((epicRows ?? []).map((r: any) => [r.epic_no, r.id]))
      const syncedAt = new Date().toISOString()
      const history: Record<string, unknown>[] = []

      for (const [epicNo, c] of counts) {
        const dbId = epicNoToId.get(epicNo)
        if (!dbId) continue
        const pct = progressPercents(c)
        const flag = autoTesterFlag(c.archived, c.totalAll)
        const { error } = await (supabase as any).from('epics').update({
          archived_count:            c.archived,
          items_total_with_archived: c.totalAll,
          ...(flag ? { tester_flag: flag } : {}),
          items_total:        c.total,
          dev_count:          c.DEV,
          ba_count:           c.BA,
          qa_count:           c.QA,
          wait_confirm_count: c.WC,
          wait_deploy_count:  c.WFD,
          items_synced_at:    syncedAt,
          ...pct,
        }).eq('id', dbId)
        if (!error) result.itemsUpdated++
        history.push({
          epic_no: epicNo, items_total: c.total, dev_count: c.DEV, ba_count: c.BA,
          qa_count: c.QA, wait_confirm_count: c.WC, wait_deploy_count: c.WFD,
          synced_at: syncedAt, ...pct,
        })
      }

      // 6g. บันทึกประวัติ แล้วลบของที่เก่ากว่า 30 วัน
      for (let i = 0; i < history.length; i += 500) {
        const { error } = await (supabase as any).from('epic_progress').insert(history.slice(i, i + 500))
        if (error) result.errors.push(`epic_progress insert: ${error.message}`)
      }
      const cutoff = new Date(Date.now() - PROGRESS_RETENTION_DAYS * 86_400_000).toISOString()
      const { error: purgeErr } = await (supabase as any).from('epic_progress').delete().lt('synced_at', cutoff)
      if (purgeErr) result.errors.push(`epic_progress purge: ${purgeErr.message}`)
    } catch (e: any) {
      result.errors.push(`Item counts sync: ${e.message}`)
    }
  }

  return result
}
