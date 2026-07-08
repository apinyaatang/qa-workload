import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import type { PlanningProject, PlanningSortField, PlanningSortState } from '../../types/planning'
import { getUrgencyFlags } from '../../types/planning'
import type { Employee } from '../../types/index'

interface Props {
  rows: PlanningProject[]
  sort: PlanningSortState
  onSort: (field: PlanningSortField) => void
  onAssignTester: (id: string, tester: string) => void
  onUpdateTestingPercent: (id: string, value: number | null) => void
  onUpdateEstimateDay: (id: string, value: number | null) => void
  employees: Employee[]
  pendingEditIds: Set<string>
  today: Date
}

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

const SORTABLE_COLUMNS: PlanningSortField[] = [
  'testDate', 'uatDate', 'goLiveDate', 'priority', 'testingPercent', 'testEstimateDay',
]

type ColDef = {
  label: string
  field?: PlanningSortField
  sticky?: boolean
}

const COLUMNS: ColDef[] = [
  { label: '#' },
  { label: 'ID', sticky: true },
  { label: 'Iteration' },
  { label: 'Project Name' },
  { label: 'Item Type' },
  { label: 'Feature' },
  { label: 'Tags' },
  { label: 'Status' },
  { label: 'Test Lead' },
  { label: 'Priority', field: 'priority' },
  { label: 'Tester' },
  { label: 'Go Live Date', field: 'goLiveDate' },
  { label: 'UAT Date', field: 'uatDate' },
  { label: 'Testing %', field: 'testingPercent' },
  { label: 'Tester Flag' },
  { label: 'Est. (day)', field: 'testEstimateDay' },
  { label: 'Test Date', field: 'testDate' },
  { label: 'Remark to PMOs' },
  { label: 'PM' },
  { label: 'BA Note' },
  { label: 'Quotation No.' },
  { label: 'Epic No.' },
]

// ── Tester dropdown cell ───────────────────────────────────────────────────────

function TesterCell({
  row,
  onAssignTester,
  hasMissingTester,
  employees,
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

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const activeEmployees = employees.filter(e => e.isActive !== false)
  const filtered = activeEmployees.filter(e => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase()
    const nick = (e.nickname ?? '').toLowerCase()
    const q = search.toLowerCase()
    return fullName.includes(q) || nick.includes(q)
  })

  function select(name: string) {
    onAssignTester(row.id, name)
    setOpen(false)
    setSearch('')
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
        {/* Clear/Unassign option */}
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
                {e.nickname && (
                  <span className="ml-1.5 text-gray-400 dark:text-slate-500">({e.nickname})</span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Inline-edit testing percent cell ──────────────────────────────────────────

function TestingPercentCell({
  row,
  onUpdateTestingPercent,
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
                row.testingPercent >= 100
                  ? 'bg-green-500'
                  : row.testingPercent >= 50
                  ? 'bg-blue-500'
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

// ── Inline-edit estimate day cell ──────────────────────────────────────────────

function EstimateDayCell({
  row,
  onUpdateEstimateDay,
  isMissingEstimate,
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
          <AlertTriangle size={12} />
          —
        </span>
      ) : (
        <span>{row.testEstimateDay != null ? `${row.testEstimateDay}d` : '—'}</span>
      )}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlanningTable({
  rows, sort, onSort, onAssignTester,
  onUpdateTestingPercent, onUpdateEstimateDay,
  employees, pendingEditIds, today,
}: Props) {
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
            {COLUMNS.map((col, ci) => {
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
              <td colSpan={COLUMNS.length} className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">
                No records match the current filters.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => {
            const flags = getUrgencyFlags(row, today)
            const isCritical = flags.includes('critical-priority')
            const isUatNear = flags.includes('uat-near')
            const isGoLiveNear = flags.includes('golive-near')
            const isMissingTester = flags.includes('missing-tester')
            const isMissingEstimate = flags.includes('missing-estimate')
            const isPending = pendingEditIds.has(row.id)

            // Row background priority: critical > golive-near > uat-near > missing-tester
            let rowBg = ''
            if (isMissingTester) rowBg = 'bg-red-100 dark:bg-red-900/25'
            if (isUatNear)       rowBg = 'bg-amber-100 dark:bg-amber-900/25'
            if (isGoLiveNear)    rowBg = 'bg-orange-100 dark:bg-orange-900/25'
            // pending edit overrides all backgrounds
            if (isPending)       rowBg = 'bg-yellow-50 dark:bg-yellow-900/20'

            const leftBorder = isPending
              ? 'border-l-4 border-l-yellow-400'
              : isCritical
              ? 'border-l-4 border-l-red-600'
              : 'border-l-4 border-l-transparent'

            const testDatePast = isPast(row.testDate, today)
            const uatNearHighlight = isWithin7Days(row.uatDate, today)
            const goLiveNearHighlight = isWithin7Days(row.goLiveDate, today)

            return (
              <tr key={row.id} className={`${rowBg} ${leftBorder} hover:bg-blue-50/40 dark:hover:bg-slate-700/50 transition-colors`}>
                {/* # */}
                <td className={`${tdBase} text-gray-400 dark:text-slate-500 text-center w-10`}>{idx + 1}</td>

                {/* ID — sticky */}
                <td
                  className={`${tdBase} sticky left-0 z-10 font-mono text-xs text-blue-700 dark:text-blue-300 whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)] ${rowBg || 'bg-white dark:bg-slate-800'}`}
                >
                  {row.id}
                  {isPending && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 align-middle" title="มีการแก้ไขที่ยังไม่บันทึก" />
                  )}
                </td>

                {/* Iteration */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.iteration || '—'}</td>

                {/* Project Name */}
                <td className={`${tdBase} max-w-[180px]`}>
                  <span className="block truncate" title={row.projectName}>{row.projectName}</span>
                </td>

                {/* Item Type */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.itemType || '—'}</td>

                {/* Feature */}
                <td className={`${tdBase} max-w-[140px]`}>
                  <span className="block truncate" title={row.feature}>{row.feature || '—'}</span>
                </td>

                {/* Tags */}
                <td className={tdBase}>
                  {row.tags ? (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-[11px] whitespace-nowrap">
                      {row.tags}
                    </span>
                  ) : '—'}
                </td>

                {/* Status */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.status || '—'}</td>

                {/* Test Lead */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.testLead || '—'}</td>

                {/* Priority */}
                <td className={tdBase}>
                  {row.priority ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                        PRIORITY_BADGE[row.priority] ?? PRIORITY_BADGE['']
                      }`}
                    >
                      {row.priority}
                    </span>
                  ) : '—'}
                </td>

                {/* Tester */}
                <td className={tdBase}>
                  <TesterCell
                    row={row}
                    onAssignTester={onAssignTester}
                    hasMissingTester={isMissingTester}
                    employees={employees}
                  />
                </td>

                {/* Go Live Date */}
                <td className={`${tdBase} whitespace-nowrap`}>
                  <span className={goLiveNearHighlight ? 'font-semibold text-orange-600' : ''}>
                    {formatDate(row.goLiveDate)}
                  </span>
                </td>

                {/* UAT Date */}
                <td className={`${tdBase} whitespace-nowrap`}>
                  <span className={uatNearHighlight ? 'font-semibold text-amber-600' : ''}>
                    {formatDate(row.uatDate)}
                  </span>
                </td>

                {/* Testing % */}
                <td className={`${tdBase} min-w-[90px]`}>
                  <TestingPercentCell row={row} onUpdateTestingPercent={onUpdateTestingPercent} />
                </td>

                {/* Tester Flag */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.testerFlag || '—'}</td>

                {/* Test Estimate */}
                <td className={`${tdBase} whitespace-nowrap text-center`}>
                  <EstimateDayCell row={row} onUpdateEstimateDay={onUpdateEstimateDay} isMissingEstimate={isMissingEstimate} />
                </td>

                {/* Test Date */}
                <td className={`${tdBase} whitespace-nowrap`}>
                  <span
                    className={`font-semibold ${
                      testDatePast ? 'text-red-600' : 'text-gray-800 dark:text-slate-100'
                    }`}
                  >
                    {formatDate(row.testDate)}
                  </span>
                </td>

                {/* Remark to PMOs */}
                <td className={`${tdBase} max-w-[150px]`}>
                  <span className="block truncate" title={row.remarkToPmos}>{row.remarkToPmos || '—'}</span>
                </td>

                {/* PM */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.pm || '—'}</td>

                {/* BA Note */}
                <td className={`${tdBase} max-w-[150px]`}>
                  <span className="block truncate" title={row.baNote}>{row.baNote || '—'}</span>
                </td>

                {/* Quotation No. */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.quotationNo || '—'}</td>

                {/* Epic No. */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.epicNo || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
