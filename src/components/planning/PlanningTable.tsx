import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, ArrowDown, AlertTriangle, ChevronDown } from 'lucide-react'
import type { PlanningProject, PlanningSortField, PlanningSortState } from '../../types/planning'
import { getUrgencyFlags } from '../../types/planning'
import type { Employee } from '../../types/index'

// ── Column definitions ─────────────────────────────────────────────────────────

type ColKey =
  | 'no' | 'id' | 'iteration' | 'projectName' | 'itemType' | 'feature'
  | 'tags' | 'status' | 'testLead' | 'priority' | 'tester' | 'goLiveDate'
  | 'uatDate' | 'testingPercent' | 'testerFlag' | 'testerNote' | 'testEstimateDay'
  | 'testDate' | 'remarkToPmos' | 'pm' | 'baNote' | 'quotationNo' | 'epicNo'

interface ColDef {
  key: ColKey
  label: string
  field?: PlanningSortField
  sticky?: boolean
  hideable: boolean
}

const COLUMNS_DEF: ColDef[] = [
  { key: 'no',             label: '#',              hideable: false },
  { key: 'id',             label: 'ID',             hideable: false, sticky: true },
  { key: 'iteration',      label: 'Iteration',      hideable: true },
  { key: 'projectName',    label: 'Project Name',   hideable: true },
  { key: 'itemType',       label: 'Item Type',      hideable: true },
  { key: 'feature',        label: 'Feature',        hideable: true },
  { key: 'tags',           label: 'Tags',           hideable: true },
  { key: 'status',         label: 'Status',         field: 'status',  hideable: true },
  { key: 'testLead',       label: 'Test Lead',      hideable: true },
  { key: 'priority',       label: 'Priority',       field: 'priority',        hideable: true },
  { key: 'tester',         label: 'Tester',         field: 'tester',  hideable: true },
  { key: 'goLiveDate',     label: 'Go Live Date',   field: 'goLiveDate',      hideable: true },
  { key: 'uatDate',        label: 'UAT Date',       field: 'uatDate',         hideable: true },
  { key: 'testingPercent', label: 'Testing %',      field: 'testingPercent',  hideable: true },
  { key: 'testerFlag',     label: 'Tester Flag',    hideable: true },
  { key: 'testerNote',     label: 'Tester Note',    hideable: true },
  { key: 'testEstimateDay',label: 'Est. (day)',      field: 'testEstimateDay', hideable: true },
  { key: 'testDate',       label: 'Test Date',      field: 'testDate',        hideable: true },
  { key: 'remarkToPmos',   label: 'Remark to PMOs', hideable: true },
  { key: 'pm',             label: 'PM',             hideable: true },
  { key: 'baNote',         label: 'BA Note',        hideable: true },
  { key: 'quotationNo',    label: 'Quotation No.',  hideable: true },
  { key: 'epicNo',         label: 'Epic No.',       hideable: true },
]

export const HIDEABLE_COLUMNS = COLUMNS_DEF
  .filter(c => c.hideable)
  .map(c => ({ key: c.key as string, label: c.label }))

const SORTABLE_COLUMNS: PlanningSortField[] = [
  'testDate', 'uatDate', 'goLiveDate', 'priority', 'testingPercent', 'testEstimateDay',
  'tester', 'status',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isWithin7Days(iso: string | null | undefined, today: Date): boolean {
  if (!iso) return false
  const diff = new Date(iso).getTime() - today.getTime()
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
}

function isPast(iso: string | null | undefined, today: Date): boolean {
  if (!iso) return false
  return new Date(iso).getTime() < today.getTime()
}

const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700',
  High: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
  Medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-300',
  Low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
  '': 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600',
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  rows: PlanningProject[]
  sort: PlanningSortState
  onSort: (field: PlanningSortField) => void
  onAssignTester: (id: string, tester: string) => void
  onUpdateTestingPercent: (id: string, value: number | null) => void
  onUpdateEstimateDay: (id: string, value: number | null) => void
  onUpdateTesterFlag: (id: string, values: string[]) => void
  onUpdateTesterNote: (id: string, value: string) => void
  testerFlags: string[]
  employees: Employee[]
  pendingEditIds: Set<string>
  extraIds?: Set<string>
  hiddenCols: Set<string>
  today: Date
}

// ── Tester dropdown cell ───────────────────────────────────────────────────────

function TesterCell({
  row, onAssignTester, hasMissingTester, employees,
}: {
  row: PlanningProject
  onAssignTester: (id: string, tester: string) => void
  hasMissingTester: boolean
  employees: Employee[]
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const activeEmployees = employees.filter(e => e.isActive !== false)
  const filtered = activeEmployees.filter(e => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase()
    const nick = (e.nickname ?? '').toLowerCase()
    const q = search.toLowerCase()
    return fullName.includes(q) || nick.includes(q)
  })

  function select(name: string) {
    onAssignTester(row.id, name)
    setOpen(false); setSearch('')
  }

  if (!open) {
    return (
      <span
        onClick={() => setOpen(true)}
        className={`cursor-pointer flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 ${
          hasMissingTester ? 'text-red-600' : 'text-gray-700 dark:text-slate-200'
        }`}
        title="Click to assign tester"
      >
        {hasMissingTester && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {row.tester || <span className="text-red-400 italic">Unassigned</span>}
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative z-20 min-w-[180px]">
      <input
        ref={inputRef}
        type="text"
        value={search}
        placeholder="ค้นหาชื่อ…"
        onChange={e => setSearch(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); setSearch('') }
          if (e.key === 'Enter' && filtered.length === 1) {
            const f = filtered[0]
            const baseName = [f.firstName, f.lastName].filter(Boolean).join(' ')
            select(f.nickname ? `${baseName} (${f.nickname})` : baseName)
          }
        }}
        className="w-full border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none dark:bg-slate-700 dark:text-slate-200"
      />
      <div className="absolute top-full left-0 mt-0.5 w-full min-w-[200px] max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg z-30">
        <button
          onClick={() => select('')}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-400 dark:text-slate-500 italic hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700"
        >
          — ไม่ระบุ (Unassigned)
        </button>
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">ไม่พบพนักงาน</div>
        ) : (
          filtered.map(e => {
            const baseName = [e.firstName, e.lastName].filter(Boolean).join(' ')
            const canonical = e.nickname ? `${baseName} (${e.nickname})` : baseName
            return (
              <button
                key={e.id}
                onClick={() => select(canonical)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ${
                  row.tester === canonical ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-200'
                }`}
              >
                <span>{baseName}</span>
                {e.nickname && <span className="ml-1.5 text-gray-400 dark:text-slate-500">({e.nickname})</span>}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Testing % cell ─────────────────────────────────────────────────────────────

function TestingPercentCell({
  row, onUpdateTestingPercent,
}: {
  row: PlanningProject
  onUpdateTestingPercent: (id: string, value: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.testingPercent != null ? String(row.testingPercent) : '')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        max={100}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          const parsed = val.trim() === '' ? null : parseFloat(val)
          onUpdateTestingPercent(row.id, parsed != null && !isNaN(parsed) ? parsed : null)
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const parsed = val.trim() === '' ? null : parseFloat(val)
            onUpdateTestingPercent(row.id, parsed != null && !isNaN(parsed) ? parsed : null)
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-16 border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none dark:bg-slate-700 dark:text-slate-200"
      />
    )
  }

  return (
    <div
      onClick={() => { setVal(row.testingPercent != null ? String(row.testingPercent) : ''); setEditing(true) }}
      className="flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 min-w-[90px]"
      title="Click to edit Testing %"
    >
      {row.testingPercent != null ? (
        <>
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden min-w-[50px]">
            <div
              className={`h-full rounded-full transition-all ${
                row.testingPercent >= 100 ? 'bg-green-500'
                  : row.testingPercent >= 50 ? 'bg-blue-500'
                  : 'bg-orange-400'
              }`}
              style={{ width: `${Math.min(100, row.testingPercent)}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-600 dark:text-slate-300 whitespace-nowrap">
            {row.testingPercent}%
          </span>
        </>
      ) : (
        <span className="text-gray-400 dark:text-slate-500 italic text-[11px]">—</span>
      )}
    </div>
  )
}

// ── Estimate day cell ──────────────────────────────────────────────────────────

function EstimateDayCell({
  row, onUpdateEstimateDay, isMissingEstimate,
}: {
  row: PlanningProject
  onUpdateEstimateDay: (id: string, value: number | null) => void
  isMissingEstimate: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.testEstimateDay != null ? String(row.testEstimateDay) : '')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step={0.5}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          const parsed = val.trim() === '' ? null : parseFloat(val)
          onUpdateEstimateDay(row.id, parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : null)
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const parsed = val.trim() === '' ? null : parseFloat(val)
            onUpdateEstimateDay(row.id, parsed != null && !isNaN(parsed) && parsed > 0 ? parsed : null)
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-16 border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none dark:bg-slate-700 dark:text-slate-200"
      />
    )
  }

  return (
    <span
      onClick={() => { setVal(row.testEstimateDay != null ? String(row.testEstimateDay) : ''); setEditing(true) }}
      className="flex items-center justify-center gap-1 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 whitespace-nowrap"
      title="Click to edit Est. (day)"
    >
      {isMissingEstimate ? (
        <span className="flex items-center gap-1 text-amber-600">
          <AlertTriangle size={12} />—
        </span>
      ) : (
        <span>{row.testEstimateDay != null ? `${row.testEstimateDay}d` : '—'}</span>
      )}
    </span>
  )
}

// ── Tester Flag multi-select cell ──────────────────────────────────────────────

function TesterFlagCell({
  row, masterFlags, onUpdateTesterFlag,
}: {
  row: PlanningProject
  masterFlags: string[]
  onUpdateTesterFlag: (id: string, values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 200 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef    = useRef<HTMLDivElement>(null)
  const selected: string[] = Array.isArray(row.testerFlag) ? row.testerFlag : []

  const openMenu = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropPos({
      top:   rect.bottom + window.scrollY + 2,
      left:  rect.left   + window.scrollX,
      width: Math.max(rect.width, 200),
    })
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle(flag: string) {
    const next = selected.includes(flag)
      ? selected.filter(f => f !== flag)
      : [...selected, flag]
    onUpdateTesterFlag(row.id, next)
  }

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, minWidth: dropPos.width, zIndex: 9999 }}
      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
    >
      {masterFlags.map(flag => (
        <label
          key={flag}
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.includes(flag)}
            onChange={() => toggle(flag)}
            className="w-3 h-3 accent-indigo-600"
          />
          <span className="text-xs text-gray-700 dark:text-slate-200">{flag}</span>
        </label>
      ))}
      {selected.length > 0 && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-1.5">
          <button
            onClick={() => { onUpdateTesterFlag(row.id, []); setOpen(false) }}
            className="text-[11px] text-red-500 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <div ref={triggerRef} className="relative">
      <div
        onClick={() => open ? setOpen(false) : openMenu()}
        className="cursor-pointer flex items-start gap-1 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 min-w-[120px]"
        title="Click to edit Tester Flag"
      >
        <div className="flex flex-wrap gap-0.5 flex-1 max-w-[200px]">
          {selected.length === 0 ? (
            <span className="text-gray-400 dark:text-slate-500 italic text-[11px]">—</span>
          ) : (
            selected.map(f => (
              <span key={f} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px] whitespace-nowrap">
                {f}
              </span>
            ))
          )}
        </div>
        <ChevronDown size={11} className="text-gray-400 dark:text-slate-500 shrink-0 mt-0.5" />
      </div>
      {menu}
    </div>
  )
}

// ── Tester Note inline-edit cell ───────────────────────────────────────────────

function TesterNoteCell({
  row, onUpdateTesterNote,
}: {
  row: PlanningProject
  onUpdateTesterNote: (id: string, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.testerNote ?? '')

  if (editing) {
    return (
      <textarea
        autoFocus
        value={val}
        rows={3}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          onUpdateTesterNote(row.id, val.trim())
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') { setVal(row.testerNote ?? ''); setEditing(false) }
        }}
        className="w-full min-w-[200px] border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none dark:bg-slate-700 dark:text-slate-200 resize-none"
        placeholder="Add note..."
      />
    )
  }

  return (
    <div
      onClick={() => { setVal(row.testerNote ?? ''); setEditing(true) }}
      className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 max-w-[220px] min-w-[120px]"
      title={row.testerNote || 'Click to add note'}
    >
      {row.testerNote ? (
        <span className="block truncate text-xs text-gray-700 dark:text-slate-200">{row.testerNote}</span>
      ) : (
        <span className="text-gray-400 dark:text-slate-500 italic text-[11px]">Add note…</span>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlanningTable({
  rows, sort, onSort, onAssignTester,
  onUpdateTestingPercent, onUpdateEstimateDay,
  onUpdateTesterFlag, onUpdateTesterNote,
  testerFlags, employees, pendingEditIds, extraIds, hiddenCols, today,
}: Props) {
  const vis = (key: string) => !hiddenCols.has(key)
  const visibleCount = COLUMNS_DEF.filter(c => vis(c.key)).length

  function SortIcon({ field }: { field: PlanningSortField }) {
    if (sort.field !== field) return <span className="text-gray-300 dark:text-slate-600 ml-1">↕</span>
    return sort.dir === 'asc'
      ? <ArrowUp size={12} className="inline ml-1 text-blue-600" />
      : <ArrowDown size={12} className="inline ml-1 text-blue-600" />
  }

  const thBase =
    'px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600'
  const tdBase = 'px-3 py-2 text-xs text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 align-middle'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {COLUMNS_DEF.map((col, ci) => {
              if (!vis(col.key)) return null
              const sortable = col.field && SORTABLE_COLUMNS.includes(col.field)
              return (
                <th
                  key={ci}
                  className={`${thBase} ${col.sticky ? 'sticky left-0 z-10 bg-gray-50 dark:bg-slate-700 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]' : ''} ${
                    sortable ? 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-slate-600' : ''
                  }`}
                  onClick={sortable && col.field ? () => onSort(col.field!) : undefined}
                >
                  {col.label}
                  {sortable && col.field && <SortIcon field={col.field} />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleCount} className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">
                No records match the current filters.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => {
            const isExtra = extraIds?.has(row.id) ?? false
            const flags = isExtra ? [] : getUrgencyFlags(row, today)
            const isCritical = flags.includes('critical-priority')
            const isUatNear = flags.includes('uat-near')
            const isGoLiveNear = flags.includes('golive-near')
            const isMissingTester = flags.includes('missing-tester')
            const isMissingEstimate = flags.includes('missing-estimate')
            const isPending = pendingEditIds.has(row.id)

            let rowBg = ''
            if (isExtra)         rowBg = 'bg-violet-50 dark:bg-violet-900/15'
            else if (isMissingTester) rowBg = 'bg-red-100 dark:bg-red-900/25'
            else if (isUatNear)       rowBg = 'bg-amber-100 dark:bg-amber-900/25'
            else if (isGoLiveNear)    rowBg = 'bg-orange-100 dark:bg-orange-900/25'
            if (isPending)       rowBg = 'bg-yellow-50 dark:bg-yellow-900/20'

            const leftBorder = isPending
              ? 'border-l-4 border-l-yellow-400'
              : isExtra
              ? 'border-l-4 border-l-violet-400'
              : isCritical
              ? 'border-l-4 border-l-red-600'
              : 'border-l-4 border-l-transparent'

            const testDatePast = isPast(row.testDate, today)
            const uatNearHighlight = isWithin7Days(row.uatDate, today)
            const goLiveNearHighlight = isWithin7Days(row.goLiveDate, today)

            return (
              <tr key={row.id} className={`${rowBg} ${leftBorder} hover:bg-blue-50/40 dark:hover:bg-slate-700/50 transition-colors`}>
                {vis('no') && (
                  <td className={`${tdBase} text-gray-400 dark:text-slate-500 text-center w-10`}>{idx + 1}</td>
                )}
                {vis('id') && (
                  <td className={`${tdBase} sticky left-0 z-10 font-mono text-xs text-blue-700 dark:text-blue-300 whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)] ${rowBg || 'bg-white dark:bg-slate-800'}`}>
                    {isExtra ? (
                      <span className="text-violet-500 dark:text-violet-400 italic text-[10px]">extra</span>
                    ) : (
                      <>
                        {row.id}
                        {isPending && (
                          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 align-middle" title="มีการแก้ไขที่ยังไม่บันทึก" />
                        )}
                      </>
                    )}
                  </td>
                )}
                {vis('iteration') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.iteration || '—'}</td>
                )}
                {vis('projectName') && (
                  <td className={`${tdBase} max-w-[200px]`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isExtra && (
                        <span className="shrink-0 px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                          Extra
                        </span>
                      )}
                      <span className="block truncate" title={row.projectName}>{row.projectName}</span>
                    </div>
                  </td>
                )}
                {vis('itemType') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.itemType || '—'}</td>
                )}
                {vis('feature') && (
                  <td className={`${tdBase} max-w-[140px]`}>
                    <span className="block truncate" title={row.feature}>{row.feature || '—'}</span>
                  </td>
                )}
                {vis('tags') && (
                  <td className={tdBase}>
                    {row.tags ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-[11px] whitespace-nowrap">
                        {row.tags}
                      </span>
                    ) : '—'}
                  </td>
                )}
                {vis('status') && (
                  <td className={`${tdBase} whitespace-nowrap`}>
                    <span className="text-xs">{row.status || '—'}</span>
                  </td>
                )}
                {vis('testLead') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.testLead || '—'}</td>
                )}
                {vis('priority') && (
                  <td className={tdBase}>
                    {row.priority ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${PRIORITY_BADGE[row.priority] ?? PRIORITY_BADGE['']}`}>
                        {row.priority}
                      </span>
                    ) : '—'}
                  </td>
                )}
                {vis('tester') && (
                  <td className={tdBase}>
                    {isExtra ? (
                      <span className="text-gray-700 dark:text-slate-200 text-xs">{row.tester || '—'}</span>
                    ) : (
                      <TesterCell
                        row={row}
                        onAssignTester={onAssignTester}
                        hasMissingTester={isMissingTester}
                        employees={employees}
                      />
                    )}
                  </td>
                )}
                {vis('goLiveDate') && (
                  <td className={`${tdBase} whitespace-nowrap`}>
                    <span className={goLiveNearHighlight && !isExtra ? 'font-semibold text-orange-600' : ''}>
                      {formatDate(row.goLiveDate)}
                    </span>
                  </td>
                )}
                {vis('uatDate') && (
                  <td className={`${tdBase} whitespace-nowrap`}>
                    <span className={uatNearHighlight && !isExtra ? 'font-semibold text-amber-600' : ''}>
                      {formatDate(row.uatDate)}
                    </span>
                  </td>
                )}
                {vis('testingPercent') && (
                  <td className={`${tdBase} min-w-[90px]`}>
                    {isExtra ? (
                      row.testingPercent != null ? (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
                            <div className={`h-full rounded-full ${row.testingPercent >= 100 ? 'bg-green-500' : row.testingPercent >= 50 ? 'bg-blue-400' : 'bg-orange-400'}`} style={{ width: `${Math.min(100, row.testingPercent)}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">{row.testingPercent}%</span>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      <TestingPercentCell row={row} onUpdateTestingPercent={onUpdateTestingPercent} />
                    )}
                  </td>
                )}
                {vis('testerFlag') && (
                  <td className={`${tdBase}`}>
                    {isExtra ? (
                      <span className="text-gray-400 text-xs italic">—</span>
                    ) : (
                      <TesterFlagCell row={row} masterFlags={testerFlags} onUpdateTesterFlag={onUpdateTesterFlag} />
                    )}
                  </td>
                )}
                {vis('testerNote') && (
                  <td className={`${tdBase}`}>
                    {isExtra ? (
                      <span className="text-xs text-gray-600 dark:text-slate-300 max-w-[200px] block truncate" title={row.testerNote}>{row.testerNote || '—'}</span>
                    ) : (
                      <TesterNoteCell row={row} onUpdateTesterNote={onUpdateTesterNote} />
                    )}
                  </td>
                )}
                {vis('testEstimateDay') && (
                  <td className={`${tdBase} whitespace-nowrap text-center`}>
                    {isExtra ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      <EstimateDayCell row={row} onUpdateEstimateDay={onUpdateEstimateDay} isMissingEstimate={isMissingEstimate} />
                    )}
                  </td>
                )}
                {vis('testDate') && (
                  <td className={`${tdBase} whitespace-nowrap`}>
                    <span className={`font-semibold ${testDatePast && !isExtra ? 'text-red-600' : 'text-gray-800 dark:text-slate-100'}`}>
                      {formatDate(row.testDate)}
                    </span>
                  </td>
                )}
                {vis('remarkToPmos') && (
                  <td className={`${tdBase} max-w-[150px]`}>
                    <span className="block truncate" title={row.remarkToPmos}>{row.remarkToPmos || '—'}</span>
                  </td>
                )}
                {vis('pm') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.pm || '—'}</td>
                )}
                {vis('baNote') && (
                  <td className={`${tdBase} max-w-[150px]`}>
                    <span className="block truncate" title={row.baNote}>{row.baNote || '—'}</span>
                  </td>
                )}
                {vis('quotationNo') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.quotationNo || '—'}</td>
                )}
                {vis('epicNo') && (
                  <td className={`${tdBase} whitespace-nowrap`}>{row.epicNo || '—'}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
