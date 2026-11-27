#!/usr/bin/env node
/**
 * scripts/sync-ado.mjs
 * Server-side ADO → Supabase sync for GitHub Actions auto-sync.
 * Mirrors the logic in src/lib/epicDb.ts syncEpicsFromAdo().
 * Run: node scripts/sync-ado.mjs
 * Env: ADO_ORG_URL, ADO_PROJECT, ADO_PAT, SUPABASE_URL, SUPABASE_ANON_KEY
 */

const { ADO_ORG_URL, ADO_PROJECT, ADO_PAT, SUPABASE_ANON_KEY } = process.env
// รับได้ทั้ง https://xxx.supabase.co และแบบที่ก๊อปมาจากหน้า API ของ Supabase (…/rest/v1/)
// ถ้าไม่ตัด /rest/v1 ออก URL จะกลายเป็น …/rest/v1/rest/v1/epics แล้วได้ 404
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
if (!ADO_ORG_URL || !ADO_PROJECT || !ADO_PAT || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required env vars: ADO_ORG_URL, ADO_PROJECT, ADO_PAT, SUPABASE_URL, SUPABASE_ANON_KEY')
  process.exit(1)
}

// ── ADO helpers ───────────────────────────────────────────────────────────────
const authHeader = `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`
const apiBase = `${ADO_ORG_URL.replace(/\/$/, '')}/${encodeURIComponent(ADO_PROJECT)}/_apis`

async function adoFetch(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...options.headers, Authorization: authHeader } })
  if (!r.ok) throw new Error(`ADO ${r.status}: ${url}`)
  return r.json()
}

async function wiql(query) {
  const data = await adoFetch(`${apiBase}/wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return (data.workItems ?? data.workItemRelations ?? []).map(w => w.id ?? w.target?.id).filter(Boolean)
}

async function fetchItems(ids, fields) {
  const all = []
  const BATCH = 200
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH).join(',')
    const data = await adoFetch(
      `${apiBase}/wit/workitems?ids=${batch}&fields=${fields.join(',')}&api-version=7.0`
    )
    all.push(...(data.value ?? []))
  }
  return all
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS })
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${path}`)
  return r.json()
}

async function sbPatch(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify(body),
  })
  return r.ok
}

async function sbDelete(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: SB_HEADERS })
  if (!r.ok) throw new Error(`Supabase DELETE ${r.status}: ${path}`)
  return r.json()
}

// epic_no ทั้งหมดใน DB (แบ่งหน้า 1000 แถว กันชน max rows ของ Supabase)
async function getAllDbEpicNos() {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/epics?select=epic_no&order=epic_no.asc`, {
      headers: { ...SB_HEADERS, Range: `${from}-${from + 999}` },
    })
    if (!r.ok) throw new Error(`Supabase GET ${r.status}: epics (epic_no)`)
    const rows = await r.json()
    out.push(...rows.map(x => Number(x.epic_no)))
    if (rows.length < 1000) break
  }
  return out
}

async function sbPost(path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body),
  })
  return r.ok
}

// ── Date helpers ──────────────────────────────────────────────────────────────
// ADO ส่งวันที่เป็น UTC → บวก 7 ชม. เป็นเวลาไทยก่อนตัดเป็นวันที่
// (GitHub Actions รันด้วย UTC ถ้าไม่บวก วันที่จะถอยไป 1 วัน) — ตรงกับ src/lib/epicDb.ts
const BKK_OFFSET_MS = 7 * 3_600_000
function adoDateToIso(raw) {
  if (!raw) return null
  const t = Date.parse(raw)
  if (isNaN(t)) return null
  return new Date(t + BKK_OFFSET_MS).toISOString().slice(0, 10)
}

function adoPersonName(v) {
  if (!v) return ''
  if (typeof v === 'string') return v.trim()
  return String(v.displayName ?? '').trim()
}

function getIterationNumber(path) {
  const match = path.match(/(\d+)\s*$/)
  return match ? parseInt(match[1], 10) : 0
}

// ตรงกับ calcEpicTestDate + subtractWorkingDaysH ในแอป:
// มี Estimate → − N วันทำการ (ข้ามเสาร์-อาทิตย์และวันหยุดใน public_holidays) · ไม่มี → − 1 วัน
const DAY_MS = 86_400_000
function calcTestDate(uatDate, targetDate, estDays, holidays) {
  const base = uatDate || targetDate
  if (!base) return null
  let cursor = Date.parse(base + 'T00:00:00Z')
  if (isNaN(cursor)) return null
  if (estDays != null && estDays > 0) {
    let remaining = Math.ceil(estDays)
    while (remaining > 0) {
      cursor -= DAY_MS
      const dow = new Date(cursor).getUTCDay()
      const iso = new Date(cursor).toISOString().slice(0, 10)
      if (dow !== 0 && dow !== 6 && !holidays.has(iso)) remaining--
    }
    return new Date(cursor).toISOString().slice(0, 10)
  }
  return new Date(cursor - DAY_MS).toISOString().slice(0, 10)
}

// ── Item bucket definitions ───────────────────────────────────────────────────
const ITEM_BUCKET = {
  'Ready': 'DEV', 'Development Doing': 'DEV', 'Edit': 'DEV', 'Reject': 'DEV',
  'Development Done': 'BA', 'BA Check Doing': 'BA', 'Development Reject': 'BA',
  'BA Check Done': 'QA', 'Testing': 'QA', 'Wait for test STG': 'QA',
  'Pending': 'WC', 'Waiting confirm': 'WC',
  'Wait for deploy': 'WFD',
}

const PROGRESS_RETENTION_DAYS = 30

// เหมือน autoTesterFlag ใน src/lib/epicDb.ts — แก้ต้องแก้ทั้งสองที่
function autoTesterFlag(archived, totalWithArchived) {
  if (totalWithArchived <= 0 || archived <= 0) return undefined
  return archived >= totalWithArchived ? ['Deployed'] : ['Recheck']
}

function progressPercents(c) {
  const p = n => (c.total > 0 ? Math.round((n / c.total) * 100) : null)
  return { dev_percent: p(c.DEV), ba_percent: p(c.BA), testing_percent: p(c.QA), done_percent: p(c.WFD) }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Starting ADO sync...`)
  const result = { inserted: 0, updated: 0, itemsTotal: 0, itemsUpdated: 0, errors: [] }

  // Step 1: Get all Epic IDs
  const allIds = await wiql(
    "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType]='Epic' ORDER BY [System.ChangedDate] DESC"
  )
  console.log(`Found ${allIds.length} Epics in ADO`)
  if (allIds.length === 0) { console.log('Nothing to sync.'); return }

  // Step 1b: ลบ Epic ใน DB ที่ไม่มีใน ADO แล้ว (ถูก delete) — เก็บตัวที่ยังอยู่แต่ไม่ผ่าน filter ไว้
  // ข้ามถ้า WIQL ชนเพดาน 20,000 (ผลอาจไม่ครบ)
  if (allIds.length < 20000) {
    try {
      const adoSet = new Set(allIds)
      const gone = (await getAllDbEpicNos()).filter(n => n > 0 && !adoSet.has(n))
      let deleted = 0
      for (let i = 0; i < gone.length; i += 200) {
        const list = gone.slice(i, i + 200).join(',')
        deleted += (await sbDelete(`epics?epic_no=in.(${list})`)).length
        await sbDelete(`epic_progress?epic_no=in.(${list})`)
      }
      console.log(`Deleted ${deleted} Epics no longer in ADO${gone.length ? `: ${gone.join(', ')}` : ''}`)
    } catch (e) {
      result.errors.push(`Cleanup deleted epics: ${e.message}`)
    }
  }

  // Step 2: Batch fetch Epic details
  const ADO_FIELDS = [
    'System.Id', 'System.Title', 'System.State', 'System.AreaPath', 'System.IterationPath',
    'System.WorkItemType', 'Microsoft.VSTS.Scheduling.TargetDate',
    'Custom.SITDate', 'Custom.UATDate', 'Custom.TypeofEpic', 'Custom.TestEstimate', 'Custom.PMName', 'System.AssignedTo',
  ]
  const allItems = await fetchItems(allIds, ADO_FIELDS)

  // Step 3: Filter iteration > 230
  const filtered = allItems.filter(item => getIterationNumber(item.fields?.['System.IterationPath'] ?? '') > 230)
  console.log(`After filter: ${filtered.length} Epics`)
  if (filtered.length === 0) { console.log('Nothing passed filter.'); return }

  // Step 4: Fetch existing epics from Supabase
  const existing = await sbGet('epics?select=id,epic_no,test_estimate_day,uat_date,target_date&limit=10000')
  const holidays = new Set((await sbGet('public_holidays?select=date&limit=10000')).map(h => String(h.date).slice(0, 10)))
  const existingMap = new Map(existing.map(r => [r.epic_no, r]))

  // Step 5: Upsert Epic metadata
  for (const item of filtered) {
    const f = item.fields ?? {}
    const epicNo = f['System.Id']
    const uatDate    = adoDateToIso(f['Custom.UATDate'])
    const targetDate = adoDateToIso(f['Microsoft.VSTS.Scheduling.TargetDate'])
    const sitDate    = adoDateToIso(f['Custom.SITDate'])
    const ex = existingMap.get(epicNo)
    const adoEstRaw = f['Custom.TestEstimate']
    const estDay = adoEstRaw != null ? (Number(adoEstRaw) || null) : (ex?.test_estimate_day ?? null)
    const testDate = calcTestDate(uatDate, targetDate, estDay, holidays)

    const adoFields = {
      epic_no: epicNo,
      item_type: f['Custom.TypeofEpic'] ?? f['System.WorkItemType'] ?? '',
      iteration: f['System.IterationPath'] ?? '',
      project: f['System.AreaPath'] ?? '',
      feature: f['System.Title'] ?? '',
      state: f['System.State'] ?? '',
      pm_name: adoPersonName(f['Custom.PMName']),
      ba_name: adoPersonName(f['System.AssignedTo']),
      sit_date: sitDate, uat_date: uatDate, target_date: targetDate,
      test_estimate_day: estDay, test_date: testDate,
    }

    try {
      if (ex) {
        const ok = await sbPatch(`epics?id=eq.${ex.id}`, adoFields)
        if (ok) result.updated++; else result.errors.push(`Update ${epicNo} failed`)
      } else {
        const ok = await sbPost('epics', {
          ...adoFields, testing_percent: null, tester_flag: null,
          tester_note: '', test_lead: '', test_owner: '', buddy1: '', buddy2: '', buddy3: '',
        })
        if (ok) result.inserted++; else result.errors.push(`Insert ${epicNo} failed`)
      }
    } catch (e) { result.errors.push(`Epic ${epicNo}: ${e.message}`) }
  }
  console.log(`Epics: +${result.inserted} inserted, ~${result.updated} updated`)

  // Step 6: Sync User Story/Bug counts per Epic
  const epicNos = filtered.map(item => item.fields?.['System.Id']).filter(Boolean)

  // 6a. Features
  const featureIds = await wiql(
    `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='Buzzebees' AND [System.WorkItemType]='Feature' AND [System.Parent] IN (${epicNos.join(',')})`
  )
  console.log(`Found ${featureIds.length} Features`)

  // 6b. Feature→epic map
  const featureParentMap = new Map()
  if (featureIds.length > 0) {
    const feats = await fetchItems(featureIds, ['System.Id', 'System.Parent'])
    for (const f of feats) featureParentMap.set(f.fields?.['System.Id'], f.fields?.['System.Parent'])
  }

  // 6c. All items
  const parentIds = [...epicNos, ...featureIds]
  const itemIds = await wiql(
    `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='Buzzebees' AND [System.WorkItemType] IN ('User Story','Bug') AND [System.Parent] IN (${parentIds.join(',')}) AND [System.State] <> 'Retired'`
  )
  console.log(`Found ${itemIds.length} User Stories/Bugs`)

  const itemDetails = await fetchItems(itemIds, ['System.State', 'System.Parent'])
  result.itemsTotal = itemDetails.length

  // 6d. Count per epic
  const epicNosSet = new Set(epicNos)
  const counts = new Map()
  for (const epicNo of epicNos) counts.set(epicNo, { total: 0, DEV: 0, BA: 0, QA: 0, WC: 0, WFD: 0, archived: 0, totalAll: 0 })

  for (const item of itemDetails) {
    const f = item.fields ?? {}
    const state = f['System.State'] ?? ''
    const parent = f['System.Parent']
    const epicNo = epicNosSet.has(parent) ? parent : featureParentMap.get(parent)
    if (!epicNo || !counts.has(epicNo)) continue
    const c = counts.get(epicNo)
    c.totalAll++
    if (state === 'Archieved') { c.archived++; continue }
    c.total++
    const b = ITEM_BUCKET[state]
    if (b) c[b]++
  }

  // 6e. Refresh DB map and update
  const refreshed = await sbGet('epics?select=id,epic_no&limit=10000')
  const epicNoToId = new Map(refreshed.map(r => [r.epic_no, r.id]))
  const syncedAt = new Date().toISOString()
  const history = []

  for (const [epicNo, c] of counts) {
    const dbId = epicNoToId.get(epicNo)
    if (!dbId) continue
    const pct = progressPercents(c)
    const flag = autoTesterFlag(c.archived, c.totalAll)
    const ok = await sbPatch(`epics?id=eq.${dbId}`, {
      archived_count: c.archived, items_total_with_archived: c.totalAll,
      ...(flag ? { tester_flag: flag } : {}),
      items_total: c.total, dev_count: c.DEV, ba_count: c.BA,
      qa_count: c.QA, wait_confirm_count: c.WC, wait_deploy_count: c.WFD,
      items_synced_at: syncedAt, ...pct,
    })
    if (ok) result.itemsUpdated++
    history.push({
      epic_no: epicNo, items_total: c.total, dev_count: c.DEV, ba_count: c.BA,
      qa_count: c.QA, wait_confirm_count: c.WC, wait_deploy_count: c.WFD,
      synced_at: syncedAt, ...pct,
    })
  }

  // 6f. บันทึกประวัติ แล้วลบของที่เก่ากว่า 30 วัน
  for (let i = 0; i < history.length; i += 500) {
    if (!(await sbPost('epic_progress', history.slice(i, i + 500)))) result.errors.push('epic_progress insert failed')
  }
  const cutoff = new Date(Date.now() - PROGRESS_RETENTION_DAYS * 86_400_000).toISOString()
  const purge = await fetch(`${SUPABASE_URL}/rest/v1/epic_progress?synced_at=lt.${encodeURIComponent(cutoff)}`, {
    method: 'DELETE', headers: SB_HEADERS,
  })
  if (!purge.ok) result.errors.push(`epic_progress purge failed: ${purge.status}`)
  console.log(`History: +${history.length} rows, purged rows older than ${PROGRESS_RETENTION_DAYS} days`)

  console.log(`Item counts updated: ${result.itemsUpdated} Epics (${result.itemsTotal} items)`)
  if (result.errors.length) console.error(`Errors (${result.errors.length}): ${result.errors.slice(0, 5).join('; ')}`)
  console.log(`[${new Date().toISOString()}] Sync complete.`)
}

main().catch(e => { console.error(e); process.exit(1) })
