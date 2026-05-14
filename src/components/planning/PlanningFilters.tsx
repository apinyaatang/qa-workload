import { useMemo } from 'react'
import { X, Search, SlidersHorizontal } from 'lucide-react'
import type { PlanningProject, PlanningFilters as PlanningFiltersType } from '../../types/planning'

interface Props {
  projects: PlanningProject[]
  filters: PlanningFiltersType
  onChange: (f: PlanningFiltersType) => void
  onClear: () => void
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))).sort()
}

export function PlanningFilters({ projects, filters, onChange, onClear }: Props) {
  const options = useMemo(() => ({
    iterations: unique(projects.map(p => p.iteration)),
    priorities: unique(projects.map(p => p.priority)),
    statuses: unique(projects.map(p => p.status)),
    testers: unique(projects.map(p => p.tester)),
    testLeads: unique(projects.map(p => p.testLead)),
  }), [projects])

  const activeCount = useMemo(() => {
    let count = 0
    if (filters.search) count++
    if (filters.iteration) count++
    if (filters.priority) count++
    if (filters.status) count++
    if (filters.tester) count++
    if (filters.testLead) count++
    if (filters.uatDateFrom) count++
    if (filters.uatDateTo) count++
    if (filters.goLiveDateFrom) count++
    if (filters.goLiveDateTo) count++
    return count
  }, [filters])

  function set<K extends keyof PlanningFiltersType>(key: K, value: PlanningFiltersType[K]) {
    onChange({ ...filters, [key]: value })
  }

  const inputBase =
    'h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const selectBase =
    'h-8 rounded border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer'

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal size={15} className="text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700">Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
            {activeCount}
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={onClear}
            disabled={activeCount === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* Filter controls — wraps on small screens */}
      <div className="flex flex-wrap gap-2 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 min-w-[180px] flex-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Project, feature, tester…"
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              className={`${inputBase} pl-7 w-full`}
            />
          </div>
        </div>

        {/* Iteration */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Iteration</label>
          <select
            value={filters.iteration}
            onChange={e => set('iteration', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.iterations.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Priority</label>
          <select
            value={filters.priority}
            onChange={e => set('priority', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.priorities.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Status</label>
          <select
            value={filters.status}
            onChange={e => set('status', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.statuses.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Tester */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Tester</label>
          <select
            value={filters.tester}
            onChange={e => set('tester', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.testers.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Test Lead */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Test Lead</label>
          <select
            value={filters.testLead}
            onChange={e => set('testLead', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.testLeads.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* UAT Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">UAT Date From</label>
          <input
            type="date"
            value={filters.uatDateFrom}
            onChange={e => set('uatDateFrom', e.target.value)}
            className={inputBase}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">UAT Date To</label>
          <input
            type="date"
            value={filters.uatDateTo}
            onChange={e => set('uatDateTo', e.target.value)}
            className={inputBase}
          />
        </div>

        {/* Go Live Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Go Live From</label>
          <input
            type="date"
            value={filters.goLiveDateFrom}
            onChange={e => set('goLiveDateFrom', e.target.value)}
            className={inputBase}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Go Live To</label>
          <input
            type="date"
            value={filters.goLiveDateTo}
            onChange={e => set('goLiveDateTo', e.target.value)}
            className={inputBase}
          />
        </div>
      </div>
    </div>
  )
}
