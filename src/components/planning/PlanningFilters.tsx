import { useMemo, useState, useRef, useEffect } from 'react'
import { X, Search, SlidersHorizontal, ChevronDown, Check } from 'lucide-react'
import type { PlanningProject, PlanningFilters as PlanningFiltersType } from '../../types/planning'

// ─── Multi-Select Dropdown ────────────────────────────────────────────────────

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}

function MultiSelect({ label, options, selected, onChange, placeholder = 'All' }: MultiSelectProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = useMemo(() =>
    search.trim()
      ? options.filter(o => o.toLowerCase().includes(search.trim().toLowerCase()))
      : options,
    [options, search]
  )

  function toggle(val: string) {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val])
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange([])
    setSearch('')
  }

  const hasValue = selected.length > 0
  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected[0]} +${selected.length - 1}`

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
        {hasValue && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {selected.length}
          </span>
        )}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-8 min-w-[120px] max-w-[180px] flex items-center justify-between gap-1 px-2 rounded border text-sm cursor-pointer transition-colors
          ${hasValue
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-400'
          }`}
      >
        <span className="truncate text-left flex-1">{displayText}</span>
        {hasValue
          ? <X size={12} className="shrink-0 text-blue-500" onClick={clear} />
          : <ChevronDown size={12} className="shrink-0 text-gray-400 dark:text-slate-500" />
        }
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl min-w-[200px] max-w-[260px]"
          style={{ marginTop: 36 }}>
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-slate-700">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`ค้นหา ${label}…`}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded outline-none focus:border-blue-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400"
              />
            </div>
          </div>

          {/* Select all / clear */}
          {options.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 dark:border-slate-700 text-xs">
              <button
                onClick={() => onChange(options)}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                เลือกทั้งหมด
              </button>
              <button
                onClick={() => onChange([])}
                disabled={selected.length === 0}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-30"
              >
                ล้าง
              </button>
            </div>
          )}

          {/* Options list */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">ไม่พบผลลัพธ์</li>
            ) : (
              filtered.map(opt => (
                <li key={opt}>
                  <button
                    onClick={() => toggle(opt)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors
                      ${selected.includes(opt)
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${selected.includes(opt)
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-300 dark:border-slate-600'
                      }`}>
                      {selected.includes(opt) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Main Filters Component ───────────────────────────────────────────────────

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
    statuses:   unique(projects.map(p => p.status)),
    testers:    unique(projects.map(p => p.tester)),
    testLeads:  unique(projects.map(p => p.testLead)),
  }), [projects])

  const activeCount = useMemo(() => {
    let n = 0
    if (filters.search)                n++
    if (filters.iterations.length)     n++
    if (filters.priority)              n++
    if (filters.statuses.length)       n++
    if (filters.testers.length)        n++
    if (filters.testLeads.length)      n++
    if (filters.uatDateFrom)           n++
    if (filters.uatDateTo)             n++
    if (filters.goLiveDateFrom)        n++
    if (filters.goLiveDateTo)          n++
    return n
  }, [filters])

  function set<K extends keyof PlanningFiltersType>(key: K, value: PlanningFiltersType[K]) {
    onChange({ ...filters, [key]: value })
  }

  const inputBase =
    'h-8 rounded border border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700 px-2 text-sm text-gray-700 dark:text-slate-200 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const selectBase =
    'h-8 rounded border border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-700 px-2 text-sm text-gray-700 dark:text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer'

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg p-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal size={15} className="text-gray-500 dark:text-slate-400 shrink-0" />
        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
            {activeCount}
          </span>
        )}
        <div className="ml-auto">
          <button
            onClick={onClear}
            disabled={activeCount === 0}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <X size={12} />
            Clear all
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-end relative">
        {/* Search */}
        <div className="flex flex-col gap-1 min-w-[180px] flex-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Project, feature, tester…"
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              className={`${inputBase} pl-7 w-full`}
            />
          </div>
        </div>

        {/* Iteration — multi-select */}
        <MultiSelect
          label="Iteration"
          options={options.iterations}
          selected={filters.iterations}
          onChange={v => set('iterations', v)}
        />

        {/* Priority — single select */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Priority</label>
          <select
            value={filters.priority}
            onChange={e => set('priority', e.target.value)}
            className={selectBase}
          >
            <option value="">All</option>
            {options.priorities.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Status — multi-select */}
        <MultiSelect
          label="Status"
          options={options.statuses}
          selected={filters.statuses}
          onChange={v => set('statuses', v)}
        />

        {/* Tester — multi-select */}
        <MultiSelect
          label="Tester"
          options={options.testers}
          selected={filters.testers}
          onChange={v => set('testers', v)}
        />

        {/* Test Lead — multi-select */}
        <MultiSelect
          label="Test Lead"
          options={options.testLeads}
          selected={filters.testLeads}
          onChange={v => set('testLeads', v)}
        />

        {/* UAT Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">UAT Date From</label>
          <input type="date" value={filters.uatDateFrom} onChange={e => set('uatDateFrom', e.target.value)} className={inputBase} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">UAT Date To</label>
          <input type="date" value={filters.uatDateTo} onChange={e => set('uatDateTo', e.target.value)} className={inputBase} />
        </div>

        {/* Go Live Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Go Live From</label>
          <input type="date" value={filters.goLiveDateFrom} onChange={e => set('goLiveDateFrom', e.target.value)} className={inputBase} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Go Live To</label>
          <input type="date" value={filters.goLiveDateTo} onChange={e => set('goLiveDateTo', e.target.value)} className={inputBase} />
        </div>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
          {filters.iterations.map(v => (
            <Chip key={`iter-${v}`} label={`Iteration: ${v}`}
              onRemove={() => set('iterations', filters.iterations.filter(x => x !== v))} />
          ))}
          {filters.statuses.map(v => (
            <Chip key={`st-${v}`} label={`Status: ${v}`}
              onRemove={() => set('statuses', filters.statuses.filter(x => x !== v))} />
          ))}
          {filters.testers.map(v => (
            <Chip key={`tr-${v}`} label={`Tester: ${v}`}
              onRemove={() => set('testers', filters.testers.filter(x => x !== v))} />
          ))}
          {filters.testLeads.map(v => (
            <Chip key={`tl-${v}`} label={`Lead: ${v}`}
              onRemove={() => set('testLeads', filters.testLeads.filter(x => x !== v))} />
          ))}
          {filters.priority && (
            <Chip label={`Priority: ${filters.priority}`} onRemove={() => set('priority', '')} />
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 dark:hover:text-blue-100">
        <X size={10} />
      </button>
    </span>
  )
}
