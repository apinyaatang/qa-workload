import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Loader2, AlertCircle, X, LayoutList, Users, CalendarClock, UserX, ClipboardList,
  RefreshCw, XCircle, Settings2, Eye, Rocket, Search, CalendarCheck, CheckCircle2, Clock,
} from 'lucide-react'
import type {
  PlanningProject,
  PlanningFilters as PlanningFiltersType,
  PlanningSortField,
  PlanningSortState,
  PlanningCsvRow,
  PlanningImportResult,
} from '../../types/planning'
import { getUrgencyFlags, PRIORITY_ORDER } from '../../types/planning'
import { planningDb, FALLBACK_TESTER_FLAGS } from '../../lib/planningDb'

import { PlanningFilters } from './PlanningFilters'
import { PlanningTable, HIDEABLE_COLUMNS } from './PlanningTable'
import TesterGanttView from './TesterGanttView'
import { PlanningCsvImport } from './PlanningCsvImport'
import { useApp } from '../../context/AppContext'
import { calcTestDate } from '../../utils/planningCsvParser'

// ── Constants ──────────────────────────────────────────────────────────────────

export const ALL_STATUSES = [
  'Cancel : Cancel from customer',
  'Control : Handover to App Support Team',
  'Define : Kick off with customer',
  'Define : On Business Requirement',
  'Go Live : Commercial Go live',
  'Go Live : PROD Go live',
  'Implement : Hold / Wait for Customer Feedback',
  'Implement : On Development',
  'Implement : On SIT/UAT with Customer',
  'Implement : On Testing',
  'Implement : UAT Sign off',
  'Implement : Wait for Deployment',
  'Planning : Internal Kick off project with team',
  'Planning : Wait for development',
  'Transition : Monitoring After Go live',
]

const ACTIVE_STATUSES = [
  'Define : Kick off with customer',
  'Define : On Business Requirement',
  'Implement : On Development',
  'Implement : On SIT/UAT with Customer',
  'Implement : On Testing',
  'Implement : UAT Sign off',
  'Planning : Internal Kick off project with team',
  'Planning : Wait for development',
]

const CLOSED_STATUSES = [
  'Cancel : Cancel from customer',
  'Control : Handover to App Support Team',
  'Go Live : Commercial Go live',
  'Go Live : PROD Go live',
  'Implement : Hold / Wait for Customer Feedback',
  'Transition : Monitoring After Go live',
]

const EMPTY_FILTERS: PlanningFiltersType = {
  search: '',
  iterations:   [],
  priority: '',
  statuses:     [],
  testers:      [],
  testLeads:    [],
  uatDateFrom: '',
  uatDateTo: '',
  goLiveDateFrom: '',
  goLiveDateTo: '',
}

const DEFAULT_SORT: PlanningSortState = { field: 'goLiveDate', dir: 'asc' }

type Tab = 'table' | 'workload' | 'closed' | 'deployed' | 'delayplan'

// Deployed: Status is active AND testerFlag contains "Deployed"
function isDeployed(p: PlanningProject): boolean {
  const hasDeployedFlag = (p.testerFlag ?? []).some(f => f.toLowerCase() === 'deployed')
  return statusInList(p.status, ACTIVE_STATUSES) && hasDeployedFlag
}

// Delay Plan: GoLive < today AND testerFlag <> "deployed" AND Status in ACTIVE_STATUSES
function isDelayPlan(p: PlanningProject, todayIso: string): boolean {
  if (!p.goLiveDate || p.goLiveDate >= todayIso) return false
  const hasDeployedFlag = (p.testerFlag ?? []).some(f => f.toLowerCase() === 'deployed')
  if (hasDeployedFlag) return false
  return statusInList(p.status, ACTIVE_STATUSES)
}

// ── Status normalisation (trim spaces around colon for flexible matching) ──────

function normaliseStatus(s: string): string {
  return s.trim().replace(/\s*:\s*/g, ':').toLowerCase()
}

function statusMatch(a: string, b: string): boolean {
  return normaliseStatus(a) === normaliseStatus(b)
}

function statusInList(status: string, list: string[]): boolean {
  return list.some(s => statusMatch(s, status))
}

// ── Filter logic ───────────────────────────────────────────────────────────────

function applyFilters(projects: PlanningProject[], filters: PlanningFiltersType): PlanningProject[] {
  const q = filters.search.trim().toLowerCase()

  return projects.filter(p => {
    // Free-text search
    if (q) {
      const haystack = [p.projectName, p.feature, p.tester, p.testLead].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    // Multi-select filters (empty array = no filter) — normalised status match
    if (filters.iterations.length  && !filters.iterations.includes(p.iteration))       return false
    if (filters.statuses.length    && !statusInList(p.status, filters.statuses))       return false
    if (filters.testers.length     && !filters.testers.includes(p.tester))             return false
    if (filters.testLeads.length   && !filters.testLeads.includes(p.testLead))         return false
    // Single-select
    if (filters.priority && p.priority !== filters.priority) return false
    // Date ranges
    if (filters.uatDateFrom    && (p.uatDate    ?? '') < filters.uatDateFrom)    return false
    if (filters.uatDateTo      && (p.uatDate    ?? '') > filters.uatDateTo)      return false
    if (filters.goLiveDateFrom && (p.goLiveDate ?? '') < filters.goLiveDateFrom) return false
    if (filters.goLiveDateTo   && (p.goLiveDate ?? '') > filters.goLiveDateTo)   return false
    return true
  })
}

// ── Sort logic ─────────────────────────────────────────────────────────────────

function applySort(projects: PlanningProject[], sort: PlanningSortState): PlanningProject[] {
  const { field, dir } = sort
  const mult = dir === 'asc' ? 1 : -1

  return [...projects].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
        break
      case 'testingPercent':
        cmp = (a.testingPercent ?? -1) - (b.testingPercent ?? -1)
        break
      case 'testEstimateDay':
        cmp = (a.testEstimateDay ?? -1) - (b.testEstimateDay ?? -1)
        break
      case 'testDate':
        cmp = (a.testDate ?? '').localeCompare(b.testDate ?? '')
        break
      case 'uatDate':
        cmp = (a.uatDate ?? '').localeCompare(b.uatDate ?? '')
        break
      case 'goLiveDate':
        cmp = (a.goLiveDate ?? '').localeCompare(b.goLiveDate ?? '')
        break
      case 'tester':
        cmp = (a.tester ?? '').localeCompare(b.tester ?? '')
        break
      case 'status':
        cmp = (a.status ?? '').localeCompare(b.status ?? '')
        break
    }
    return cmp * mult
  })
}

// ── Urgency summary ────────────────────────────────────────────────────────────

type QuickFilter = 'none' | 'near-uat' | 'near-golive' | 'missing-tester' | 'missing-estimate' | 'near-testdate' | 'follow-plan'

interface UrgencyCounts {
  overloaded: number
  nearUat: number
  nearGoLive: number
  missingTester: number
  missingEstimate: number
  nearTestDate: number
  followPlan: number
}

const NEAR_DAYS = 5   // window in calendar days

function isWithinDays(iso: string | null | undefined, today: Date, days: number): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const diff = (d.getTime() - today.getTime()) / 86_400_000
  return diff >= 0 && diff <= days
}

// Near Test Date: testDate exists AND today < testDate - 1 day (at least 2 days before test) AND within NEAR_DAYS
function isNearTestDate(p: PlanningProject, today: Date): boolean {
  if (!p.testDate) return false
  const diff = (new Date(p.testDate).getTime() - today.getTime()) / 86_400_000
  return diff > 1 && diff <= NEAR_DAYS
}

// Follow Plan: no testDate AND approaching UAT (or GoLive if no UAT) by at least 5 days
function isFollowPlan(p: PlanningProject, today: Date): boolean {
  if (p.testDate?.trim()) return false
  const refDate = p.uatDate ?? p.goLiveDate
  if (!refDate) return false
  const diff = (new Date(refDate).getTime() - today.getTime()) / 86_400_000
  return diff >= 5
}

function getUrgencyCounts(projects: PlanningProject[], today: Date): UrgencyCounts {
  const counts: UrgencyCounts = {
    overloaded: 0, nearUat: 0, nearGoLive: 0,
    missingTester: 0, missingEstimate: 0,
    nearTestDate: 0, followPlan: 0,
  }
  const testerLoad = new Map<string, number>()

  for (const p of projects) {
    if (isWithinDays(p.uatDate,    today, NEAR_DAYS)) counts.nearUat++
    if (isWithinDays(p.goLiveDate, today, NEAR_DAYS)) counts.nearGoLive++
    if (isNearTestDate(p, today)) counts.nearTestDate++
    if (isFollowPlan(p, today))   counts.followPlan++
    const flags = getUrgencyFlags(p, today)
    if (flags.includes('missing-tester'))   counts.missingTester++
    if (flags.includes('missing-estimate')) counts.missingEstimate++
    if (p.tester?.trim() && p.testEstimateDay != null) {
      testerLoad.set(p.tester, (testerLoad.get(p.tester) ?? 0) + p.testEstimateDay)
    }
  }
  for (const days of testerLoad.values()) {
    if (days > 20) counts.overloaded++
  }
  return counts
}

/**
 * Group rows by projectName, sort groups by the earliest date (asc),
 * and sort rows within each group by date descending.
 */
function groupAndSortByDate(
  rows: PlanningProject[],
  dateKey: 'uatDate' | 'goLiveDate',
): PlanningProject[] {
  // Build group map: projectName → rows
  const groups = new Map<string, PlanningProject[]>()
  for (const p of rows) {
    const key = p.projectName?.trim() || '(ไม่มีชื่อ)'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  // Sort rows within each group by date DESC (latest first within same project)
  for (const rows of groups.values()) {
    rows.sort((a, b) => (b[dateKey] ?? '').localeCompare(a[dateKey] ?? ''))
  }

  // Sort groups by their earliest (min) date ASC
  const sortedGroups = [...groups.entries()].sort(([, aRows], [, bRows]) => {
    const aMin = aRows.map(r => r[dateKey] ?? '').sort()[0] ?? ''
    const bMin = bRows.map(r => r[dateKey] ?? '').sort()[0] ?? ''
    return aMin.localeCompare(bMin)
  })

  // Flatten
  return sortedGroups.flatMap(([, rows]) => rows)
}

function applyQuickFilter(rows: PlanningProject[], qf: QuickFilter, today: Date): PlanningProject[] {
  if (qf === 'near-uat') {
    const filtered = rows.filter(p => isWithinDays(p.uatDate, today, NEAR_DAYS))
    return groupAndSortByDate(filtered, 'uatDate')
  }
  if (qf === 'near-golive') {
    const filtered = rows.filter(p => isWithinDays(p.goLiveDate, today, NEAR_DAYS))
    return groupAndSortByDate(filtered, 'goLiveDate')
  }
  if (qf === 'missing-tester')   return rows.filter(p => !p.tester?.trim())
  if (qf === 'missing-estimate') return rows.filter(p => p.testEstimateDay == null)
  if (qf === 'near-testdate')    return rows.filter(p => isNearTestDate(p, today))
  if (qf === 'follow-plan')      return rows.filter(p => isFollowPlan(p, today))
  return rows
}

// ── Modal wrapper ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 pb-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-600">
          <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PlanningView() {
  const { publicHolidays, employees, planningInitialTester, setPlanningInitialTester } = useApp()
  const holidaySet = useMemo(
    () => new Set(publicHolidays.map(h => h.date)),
    [publicHolidays],
  )
  const today = useMemo(() => new Date(), [])

  const [projects, setProjects] = useState<PlanningProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('table')
  const [filters, setFilters] = useState<PlanningFiltersType>(EMPTY_FILTERS)
  const [sort, setSort] = useState<PlanningSortState>(DEFAULT_SORT)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('none')
  const [showImport, setShowImport] = useState(false)
  const [closedSearch,    setClosedSearch]    = useState('')
  const [deployedSearch,  setDeployedSearch]  = useState('')
  const [delayPlanSearch, setDelayPlanSearch] = useState('')

  // ── Tester flags master list (initial = fallback so dropdown always has options) ──
  const [testerFlags, setTesterFlags] = useState<string[]>(FALLBACK_TESTER_FLAGS)

  // ── Column visibility (persisted to localStorage) ────────────────────────────
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('wiq:hidden-cols')
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // ── Autosave state: rows currently being saved, and conflict message ─────────
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set())
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)

  // Ref for accessing latest projects inside async/setTimeout callbacks
  const projectsRef = useRef<PlanningProject[]>([])
  useEffect(() => { projectsRef.current = projects }, [projects])

  // Debounce timers for testerNote (text field)
  const noteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Close column menu on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!showColMenu) return
    function handle(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showColMenu])

  function toggleCol(key: string) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem('wiq:hidden-cols', JSON.stringify([...next]))
      return next
    })
  }

  // ── Split deployed projects out early (used in activeFilterApplied effect below) ──
  const mainProjectsForFilter = useMemo(() => projects.filter(p => !isDeployed(p)), [projects])

  // ── Apply active status filter once data loads (intersect with actual statuses) ──
  const [activeFilterApplied, setActiveFilterApplied] = useState(false)

  useEffect(() => {
    if (loading || projects.length === 0 || activeFilterApplied) return
    const available = new Set(mainProjectsForFilter.map(p => normaliseStatus(p.status)))
    const matched = ACTIVE_STATUSES.filter(s => available.has(normaliseStatus(s)))
    setFilters(f => ({ ...f, statuses: matched.length > 0 ? matched : [] }))
    setActiveFilterApplied(true)
  }, [loading, projects, mainProjectsForFilter, activeFilterApplied])

  // ── Apply initial tester filter when navigated from Monitor and Assign ──────

  useEffect(() => {
    if (!planningInitialTester) return
    setFilters(f => ({ ...f, testers: [planningInitialTester] }))
    setTab('table')
    setPlanningInitialTester(null)
  }, [planningInitialTester, setPlanningInitialTester])

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, flags] = await Promise.all([
        planningDb.getAll(),
        planningDb.getTesterFlags(),
      ])
      setProjects(data)
      setTesterFlags(flags)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load planning data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // ── Sort handler ─────────────────────────────────────────────────────────────

  function handleSort(field: PlanningSortField) {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' }
    )
  }

  // ── DB column name map ───────────────────────────────────────────────────────

  const FIELD_TO_DB: Record<string, string> = {
    tester:          'tester',
    testingPercent:  'testing_percent',
    testEstimateDay: 'test_estimate_day',
    testDate:        'test_date',
    testerFlag:      'tester_flag',
    testerNote:      'tester_note',
  }

  function buildDbPatch(patch: Partial<PlanningProject>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      const col = FIELD_TO_DB[k]
      if (!col) continue
      out[col] = Array.isArray(v) ? ((v as string[]).length > 0 ? JSON.stringify(v) : null) : v
    }
    return out
  }

  // ── Autosave: save one row immediately with optimistic lock ──────────────────

  async function autoSave(id: string, dbPatch: Record<string, unknown>, knownUpdatedAt?: string) {
    if (Object.keys(dbPatch).length === 0) return
    setSavingIds(prev => new Set([...prev, id]))
    try {
      const result = await planningDb.updateFieldsChecked(id, dbPatch, knownUpdatedAt)
      if (result.ok) {
        // Refresh updatedAt so next save uses the new timestamp
        setProjects(prev => prev.map(p => p.id === id ? { ...p, updatedAt: result.updatedAt } : p))
        setConflictMsg(null)
      } else if (result.reason === 'conflict') {
        setConflictMsg('⚠️ ข้อมูลถูกแก้ไขโดยผู้ใช้อื่นขณะบันทึก — กรุณากด Refresh เพื่อโหลดข้อมูลล่าสุด')
        await loadProjects()
      } else {
        setConflictMsg('บันทึกไม่สำเร็จ กรุณาลองใหม่')
      }
    } catch {
      setConflictMsg('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ── Edit handlers — autosave immediately on change ───────────────────────────

  function handleAssignTester(id: string, tester: string) {
    const p = projects.find(q => q.id === id)
    setProjects(prev => prev.map(q => q.id === id ? { ...q, tester } : q))
    autoSave(id, buildDbPatch({ tester }), p?.updatedAt)
  }

  function handleUpdateTestingPercent(id: string, value: number | null) {
    const p = projects.find(q => q.id === id)
    setProjects(prev => prev.map(q => q.id === id ? { ...q, testingPercent: value } : q))
    autoSave(id, buildDbPatch({ testingPercent: value }), p?.updatedAt)
  }

  function handleUpdateEstimateDay(id: string, value: number | null) {
    const p = projects.find(q => q.id === id)
    if (!p) return
    const newTestDate = calcTestDate(p.uatDate, p.goLiveDate, value, holidaySet)
    const patch = { testEstimateDay: value, testDate: newTestDate }
    setProjects(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
    autoSave(id, buildDbPatch(patch), p?.updatedAt)
  }

  function handleUpdateTesterFlag(id: string, values: string[]) {
    const p = projects.find(q => q.id === id)
    setProjects(prev => prev.map(q => q.id === id ? { ...q, testerFlag: values } : q))
    autoSave(id, buildDbPatch({ testerFlag: values }), p?.updatedAt)
  }

  function handleUpdateTesterNote(id: string, value: string) {
    // Optimistic update while typing, debounce the actual DB write
    setProjects(prev => prev.map(q => q.id === id ? { ...q, testerNote: value } : q))
    if (noteTimers.current.has(id)) clearTimeout(noteTimers.current.get(id)!)
    noteTimers.current.set(id, setTimeout(() => {
      const proj = projectsRef.current.find(q => q.id === id)
      autoSave(id, buildDbPatch({ testerNote: value }), proj?.updatedAt)
    }, 1000))
  }

  // ── Filtered & sorted rows ───────────────────────────────────────────────────

  // Projects excluded from Planning & Workload tabs (own Deployed tab)
  const mainProjects = useMemo(() => projects.filter(p => !isDeployed(p)), [projects])

  // Base: search/dropdown filters applied (no sort yet) — only non-deployed projects
  const baseFiltered = useMemo(
    () => applyFilters(mainProjects, filters),
    [mainProjects, filters]
  )

  // Quick-filter + auto-sort applied to both Table and Gantt
  const quickFiltered = useMemo(
    () => applyQuickFilter(baseFiltered, quickFilter, today),
    [baseFiltered, quickFilter, today]
  )

  // Table rows: manual sort on top (quick filter overrides sort for near-uat/near-golive)
  const filteredRows = useMemo(() => {
    // When near-uat / near-golive is active, quickFilter already sorted — skip manual sort
    if (quickFilter === 'near-uat' || quickFilter === 'near-golive') return quickFiltered
    return applySort(quickFiltered, sort)
  }, [quickFiltered, quickFilter, sort])

  // Gantt rows = same data (Gantt has its own internal group sort)
  const ganttRows = filteredRows

  // Closed/cancelled rows — normalised match against CLOSED_STATUSES
  const closedRows = useMemo(
    () => applySort(projects.filter(p => statusInList(p.status, CLOSED_STATUSES)), sort),
    [projects, sort]
  )

  // todayIso for date comparisons
  const todayIso = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    [today]
  )

  // Deployed tab: Status in ACTIVE_STATUSES AND testerFlag = "Deployed"
  const deployedRows = useMemo(
    () => applySort(projects.filter(isDeployed), sort),
    [projects, sort]
  )

  // Delay Plan tab: GoLive < today AND (testerFlag <> "deployed" OR active status)
  const delayPlanRows = useMemo(
    () => applySort(projects.filter(p => isDelayPlan(p, todayIso)), sort),
    [projects, sort, todayIso]
  )

  // Search filter helper for Closed / Deployed tabs (project name, tester, status)
  function searchRows(rows: PlanningProject[], q: string): PlanningProject[] {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(p =>
      (p.projectName ?? '').toLowerCase().includes(s) ||
      (p.tester      ?? '').toLowerCase().includes(s) ||
      (p.status      ?? '').toLowerCase().includes(s)
    )
  }

  const filteredClosedRows    = useMemo(() => searchRows(closedRows,    closedSearch),    [closedRows,    closedSearch])
  const filteredDeployedRows  = useMemo(() => searchRows(deployedRows,  deployedSearch),  [deployedRows,  deployedSearch])
  const filteredDelayPlanRows = useMemo(() => searchRows(delayPlanRows, delayPlanSearch), [delayPlanRows, delayPlanSearch])

  // ── Urgency summary — always from full base (not filtered) ───────────────────

  const urgency = useMemo(() => getUrgencyCounts(baseFiltered, today), [baseFiltered, today])

  // ── Row IDs currently being saved (for row highlighting) ────────────────────

  const pendingEditIds = savingIds

  // ── Import callbacks ─────────────────────────────────────────────────────────

  function handleImportComplete(_result: PlanningImportResult) {
    // Refresh after a short delay so DB writes settle
    setTimeout(() => {
      loadProjects()
    }, 300)
  }

  function handlePreviewReady(_rows: PlanningCsvRow[]) {
    // Preview is shown inside the modal; no-op here
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">QA Workload</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{projects.length} projects loaded</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Column visibility toggle */}
          <div className="relative" ref={colMenuRef}>
            <button
              onClick={() => setShowColMenu(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                showColMenu || hiddenCols.size > 0
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
              }`}
            >
              <Settings2 size={14} />
              Columns
              {hiddenCols.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  -{hiddenCols.size}
                </span>
              )}
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl p-3 min-w-[210px]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">Show / Hide Columns</p>
                  <button
                    onClick={() => {
                      setHiddenCols(new Set())
                      localStorage.removeItem('wiq:hidden-cols')
                    }}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <Eye size={11} />
                    Show all
                  </button>
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {HIDEABLE_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5 rounded hover:bg-gray-50 dark:hover:bg-slate-700 px-1">
                      <input
                        type="checkbox"
                        checked={!hiddenCols.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span className="text-xs text-gray-700 dark:text-slate-200">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Upload size={15} />
            Import CSV
          </button>
          <button
            onClick={loadProjects}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-semibold hover:bg-gray-300 dark:hover:bg-slate-600 shadow-sm transition-colors disabled:opacity-50"
            title="Refresh ข้อมูลล่าสุด"
          >
            {savingIds.size > 0
              ? <Loader2 size={15} className="animate-spin text-blue-500" />
              : <RefreshCw size={15} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Conflict / save-error banner */}
      {conflictMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{conflictMsg}</span>
          <button
            onClick={() => setConflictMsg(null)}
            className="shrink-0 text-red-400 hover:text-red-600 dark:hover:text-red-200"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Quick-filter chips — always visible when data loaded */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">Filter:</span>

          <FilterChip
            active={quickFilter === 'near-uat'}
            count={urgency.nearUat}
            label="Near UAT"
            sublabel="≤ 5 วัน"
            icon={<CalendarClock size={13} />}
            color="amber"
            onClick={() => setQuickFilter(q => q === 'near-uat' ? 'none' : 'near-uat')}
          />
          <FilterChip
            active={quickFilter === 'near-golive'}
            count={urgency.nearGoLive}
            label="Near Go Live"
            sublabel="≤ 5 วัน"
            icon={<AlertCircle size={13} />}
            color="orange"
            onClick={() => setQuickFilter(q => q === 'near-golive' ? 'none' : 'near-golive')}
          />
          <FilterChip
            active={quickFilter === 'missing-tester'}
            count={urgency.missingTester}
            label="Missing Tester"
            icon={<UserX size={13} />}
            color="red"
            onClick={() => setQuickFilter(q => q === 'missing-tester' ? 'none' : 'missing-tester')}
          />
          <FilterChip
            active={quickFilter === 'missing-estimate'}
            count={urgency.missingEstimate}
            label="Missing Estimate"
            icon={<ClipboardList size={13} />}
            color="yellow"
            onClick={() => setQuickFilter(q => q === 'missing-estimate' ? 'none' : 'missing-estimate')}
          />
          <FilterChip
            active={quickFilter === 'near-testdate'}
            count={urgency.nearTestDate}
            label="Near Test Date"
            sublabel="2–5 วัน"
            icon={<CalendarCheck size={13} />}
            color="blue"
            onClick={() => setQuickFilter(q => q === 'near-testdate' ? 'none' : 'near-testdate')}
          />
          <FilterChip
            active={quickFilter === 'follow-plan'}
            count={urgency.followPlan}
            label="Follow Plan"
            sublabel="≥ 5 วันก่อน UAT/GoLive"
            icon={<CheckCircle2 size={13} />}
            color="green"
            onClick={() => setQuickFilter(q => q === 'follow-plan' ? 'none' : 'follow-plan')}
          />

          {quickFilter !== 'none' && (
            <button
              onClick={() => setQuickFilter('none')}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 underline"
            >
              ล้าง filter
            </button>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-600">
        <TabButton
          active={tab === 'table'}
          onClick={() => setTab('table')}
          icon={<LayoutList size={14} />}
          label="Planning Table"
        />
        <TabButton
          active={tab === 'workload'}
          onClick={() => setTab('workload')}
          icon={<Users size={14} />}
          label="Tester Workload"
        />
        <TabButton
          active={tab === 'closed'}
          onClick={() => setTab('closed')}
          icon={<XCircle size={14} />}
          label="Task Close/Cancel"
        />
        <TabButton
          active={tab === 'deployed'}
          onClick={() => setTab('deployed')}
          icon={<Rocket size={14} />}
          label={`Deployed${deployedRows.length > 0 ? ` (${deployedRows.length})` : ''}`}
        />
        <TabButton
          active={tab === 'delayplan'}
          onClick={() => setTab('delayplan')}
          icon={<Clock size={14} />}
          label={`Delay Plan${delayPlanRows.length > 0 ? ` (${delayPlanRows.length})` : ''}`}
          color="red"
        />
      </div>

      {/* Filters — ซ่อนเมื่ออยู่ที่ Tab Closed, Deployed หรือ Delay Plan */}
      {tab !== 'closed' && tab !== 'deployed' && tab !== 'delayplan' && (
        <PlanningFilters
          projects={mainProjects}
          filters={filters}
          onChange={setFilters}
          onClear={() => { setFilters(EMPTY_FILTERS); setActiveFilterApplied(false) }}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 size={22} className="animate-spin text-blue-500" />
          <span className="text-sm">Loading planning data…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Failed to load data</p>
            <p className="text-xs mt-1">{error}</p>
            <button
              onClick={loadProjects}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {tab === 'table' && (
            <PlanningTable
              rows={filteredRows}
              sort={sort}
              onSort={handleSort}
              onAssignTester={handleAssignTester}
              onUpdateTestingPercent={handleUpdateTestingPercent}
              onUpdateEstimateDay={handleUpdateEstimateDay}
              onUpdateTesterFlag={handleUpdateTesterFlag}
              onUpdateTesterNote={handleUpdateTesterNote}
              testerFlags={testerFlags}
              employees={employees}
              pendingEditIds={pendingEditIds}
              hiddenCols={hiddenCols}
              today={today}
            />
          )}
          {tab === 'workload' && (
            <TesterGanttView
              projects={ganttRows}
              holidays={holidaySet}
              employees={employees}
              today={today}
            />
          )}
          {tab === 'closed' && (
            <>
              <TabSearchBar
                value={closedSearch}
                onChange={setClosedSearch}
                total={closedRows.length}
                filtered={filteredClosedRows.length}
              />
              <PlanningTable
                rows={filteredClosedRows}
                sort={sort}
                onSort={handleSort}
                onAssignTester={handleAssignTester}
                onUpdateTestingPercent={handleUpdateTestingPercent}
                onUpdateEstimateDay={handleUpdateEstimateDay}
                onUpdateTesterFlag={handleUpdateTesterFlag}
                onUpdateTesterNote={handleUpdateTesterNote}
                testerFlags={testerFlags}
                employees={employees}
                pendingEditIds={pendingEditIds}
                hiddenCols={hiddenCols}
                today={today}
              />
            </>
          )}
          {tab === 'deployed' && (
            <>
              <TabSearchBar
                value={deployedSearch}
                onChange={setDeployedSearch}
                total={deployedRows.length}
                filtered={filteredDeployedRows.length}
              />
              <PlanningTable
                rows={filteredDeployedRows}
                sort={sort}
                onSort={handleSort}
                onAssignTester={handleAssignTester}
                onUpdateTestingPercent={handleUpdateTestingPercent}
                onUpdateEstimateDay={handleUpdateEstimateDay}
                onUpdateTesterFlag={handleUpdateTesterFlag}
                onUpdateTesterNote={handleUpdateTesterNote}
                testerFlags={testerFlags}
                employees={employees}
                pendingEditIds={pendingEditIds}
                hiddenCols={hiddenCols}
                today={today}
              />
            </>
          )}
          {tab === 'delayplan' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                <Clock size={13} className="shrink-0" />
                <span>แสดงรายการที่ GoLive date ผ่านมาแล้ว และยังไม่ได้ Deploy — GoLive &lt; {todayIso}</span>
              </div>
              <TabSearchBar
                value={delayPlanSearch}
                onChange={setDelayPlanSearch}
                total={delayPlanRows.length}
                filtered={filteredDelayPlanRows.length}
              />
              <PlanningTable
                rows={filteredDelayPlanRows}
                sort={sort}
                onSort={handleSort}
                onAssignTester={handleAssignTester}
                onUpdateTestingPercent={handleUpdateTestingPercent}
                onUpdateEstimateDay={handleUpdateEstimateDay}
                onUpdateTesterFlag={handleUpdateTesterFlag}
                onUpdateTesterNote={handleUpdateTesterNote}
                testerFlags={testerFlags}
                employees={employees}
                pendingEditIds={pendingEditIds}
                hiddenCols={hiddenCols}
                today={today}
              />
            </>
          )}
        </>
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal title="Import CSV" onClose={() => setShowImport(false)}>
          <PlanningCsvImport
            existingProjects={projects}
            onImportComplete={result => {
              handleImportComplete(result)
              // Keep modal open to show result step
            }}
            onPreviewReady={handlePreviewReady}
          />
        </Modal>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  color = 'blue',
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  color?: 'blue' | 'red'
}) {
  const activeClass = color === 'red'
    ? 'border-red-600 text-red-700 dark:text-red-300 bg-red-50/60 dark:bg-red-900/20'
    : 'border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-900/20'
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? activeClass
          : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100/60 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

const URGENCY_COLORS: Record<string, { wrap: string; dot: string }> = {
  red:    { wrap: 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-700 text-red-800 dark:text-red-300',       dot: 'bg-red-500' },
  amber:  { wrap: 'bg-amber-100 dark:bg-amber-900/30 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300', dot: 'bg-amber-500' },
  orange: { wrap: 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-700 text-orange-800 dark:text-orange-300', dot: 'bg-orange-500' },
  yellow: { wrap: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300', dot: 'bg-yellow-500' },
  blue:   { wrap: 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-700 text-blue-800 dark:text-blue-300',       dot: 'bg-blue-500' },
  green:  { wrap: 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-700 text-green-800 dark:text-green-300', dot: 'bg-green-500' },
}

function TabSearchBar({
  value, onChange, total, filtered,
}: {
  value: string
  onChange: (v: string) => void
  total: number
  filtered: number
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="ค้นหา Project, Tester, Status…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-500"
        />
      </div>
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 underline"
        >
          ล้าง
        </button>
      )}
      <span className="text-xs text-gray-400 dark:text-slate-500">
        {value ? `${filtered} / ${total}` : `${total}`} รายการ
      </span>
    </div>
  )
}

function FilterChip({
  active, count, label, sublabel, icon, color, onClick,
}: {
  active: boolean
  count: number
  label: string
  sublabel?: string
  icon: React.ReactNode
  color: string
  onClick: () => void
}) {
  const c = URGENCY_COLORS[color] ?? URGENCY_COLORS.red
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
        active
          ? `${c.wrap} ring-2 ring-offset-1 ring-current shadow-sm`
          : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-gray-400'
      }`}
    >
      {icon}
      {label}
      {sublabel && <span className="opacity-60">{sublabel}</span>}
      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        active ? 'bg-white/40' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
      }`}>
        {count}
      </span>
    </button>
  )
}
