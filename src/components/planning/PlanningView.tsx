import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Loader2, AlertCircle, X, LayoutList, Users, CalendarClock, UserX, ClipboardList,
  Save, XCircle, Settings2, Eye,
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
  'Implement : Wait for Deployment',
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

type Tab = 'table' | 'workload' | 'closed'

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
    }
    return cmp * mult
  })
}

// ── Urgency summary ────────────────────────────────────────────────────────────

type QuickFilter = 'none' | 'near-uat' | 'near-golive' | 'missing-tester' | 'missing-estimate'

interface UrgencyCounts {
  overloaded: number
  nearUat: number
  nearGoLive: number
  missingTester: number
  missingEstimate: number
}

const NEAR_DAYS = 5   // window in calendar days

function isWithinDays(iso: string | null | undefined, today: Date, days: number): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const diff = (d.getTime() - today.getTime()) / 86_400_000
  return diff >= 0 && diff <= days
}

function getUrgencyCounts(projects: PlanningProject[], today: Date): UrgencyCounts {
  const counts: UrgencyCounts = { overloaded: 0, nearUat: 0, nearGoLive: 0, missingTester: 0, missingEstimate: 0 }
  const testerLoad = new Map<string, number>()

  for (const p of projects) {
    if (isWithinDays(p.uatDate,    today, NEAR_DAYS)) counts.nearUat++
    if (isWithinDays(p.goLiveDate, today, NEAR_DAYS)) counts.nearGoLive++
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

  // ── Pending edits (staged, not yet saved to DB) ──────────────────────────────
  const [pendingEdits, setPendingEdits] = useState<Map<string, Partial<PlanningProject>>>(new Map())
  const [saving, setSaving] = useState(false)

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

  // ── Apply active status filter once data loads (intersect with actual statuses) ──
  const [activeFilterApplied, setActiveFilterApplied] = useState(false)

  useEffect(() => {
    if (loading || projects.length === 0 || activeFilterApplied) return
    const available = new Set(projects.map(p => normaliseStatus(p.status)))
    const matched = ACTIVE_STATUSES.filter(s => available.has(normaliseStatus(s)))
    setFilters(f => ({ ...f, statuses: matched.length > 0 ? matched : [] }))
    setActiveFilterApplied(true)
  }, [loading, projects, activeFilterApplied])

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

  // ── Stage an edit (optimistic UI update, queues for Save) ───────────────────

  function stageEdit(id: string, patch: Partial<PlanningProject>) {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
    setPendingEdits(prev => {
      const m = new Map(prev)
      m.set(id, { ...(m.get(id) ?? {}), ...patch })
      return m
    })
  }

  function handleAssignTester(id: string, tester: string) {
    stageEdit(id, { tester })
  }

  function handleUpdateTestingPercent(id: string, value: number | null) {
    stageEdit(id, { testingPercent: value })
  }

  function handleUpdateEstimateDay(id: string, value: number | null) {
    const project = projects.find(p => p.id === id)
    if (!project) return
    const newTestDate = calcTestDate(project.uatDate, project.goLiveDate, value, holidaySet)
    stageEdit(id, { testEstimateDay: value, testDate: newTestDate })
  }

  function handleUpdateTesterFlag(id: string, values: string[]) {
    stageEdit(id, { testerFlag: values })
  }

  function handleUpdateTesterNote(id: string, value: string) {
    stageEdit(id, { testerNote: value })
  }

  // ── Save all pending edits to DB ─────────────────────────────────────────────

  const FIELD_TO_DB: Record<string, string> = {
    tester:          'tester',
    testingPercent:  'testing_percent',
    testEstimateDay: 'test_estimate_day',
    testDate:        'test_date',
    testerFlag:      'tester_flag',
    testerNote:      'tester_note',
  }

  async function handleSave() {
    if (pendingEdits.size === 0) return
    setSaving(true)
    try {
      for (const [id, patch] of pendingEdits) {
        const dbFields: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(patch)) {
          const col = FIELD_TO_DB[k]
          if (col) {
            // Serialize string[] to JSON string for tester_flag (TEXT column)
            dbFields[col] = Array.isArray(v)
              ? ((v as string[]).length > 0 ? JSON.stringify(v) : null)
              : v
          }
        }
        await planningDb.updateFields(id, dbFields)
      }
      setPendingEdits(new Map())
    } catch {
      await loadProjects()
    } finally {
      setSaving(false)
    }
  }

  // ── Filtered & sorted rows ───────────────────────────────────────────────────

  // Base: search/dropdown filters applied (no sort yet)
  const baseFiltered = useMemo(
    () => applyFilters(projects, filters),
    [projects, filters]
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

  // ── Urgency summary — always from full base (not filtered) ───────────────────

  const urgency = useMemo(() => getUrgencyCounts(baseFiltered, today), [baseFiltered, today])

  // ── Pending edit IDs (for row highlighting) ──────────────────────────────────

  const pendingEditIds = useMemo(() => new Set(pendingEdits.keys()), [pendingEdits])

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
            onClick={handleSave}
            disabled={pendingEdits.size === 0 || saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all ${
              pendingEdits.size > 0
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
            }`}
            title={pendingEdits.size > 0 ? `บันทึก ${pendingEdits.size} รายการที่แก้ไข` : 'ไม่มีการแก้ไข'}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            บันทึก
            {pendingEdits.size > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-white/30 text-xs font-bold">
                {pendingEdits.size}
              </span>
            )}
          </button>
        </div>
      </div>

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
      </div>

      {/* Filters — ซ่อนเมื่ออยู่ที่ Tab Closed */}
      {tab !== 'closed' && (
        <PlanningFilters
          projects={projects}
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
            <PlanningTable
              rows={closedRows}
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
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-900/20'
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
