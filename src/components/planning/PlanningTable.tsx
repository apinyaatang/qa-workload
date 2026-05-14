import { useState } from 'react'
import { ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import type { PlanningProject, PlanningSortField, PlanningSortState } from '../../types/planning'
import { getUrgencyFlags } from '../../types/planning'

interface Props {
  rows: PlanningProject[]
  sort: PlanningSortState
  onSort: (field: PlanningSortField) => void
  onAssignTester: (id: string, tester: string) => void
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
  Critical: 'bg-red-100 text-red-700 border border-red-300',
  High: 'bg-orange-100 text-orange-700 border border-orange-300',
  Medium: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  Low: 'bg-blue-100 text-blue-700 border border-blue-300',
  '': 'bg-gray-100 text-gray-500 border border-gray-200',
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

// Inline-edit tester cell
function TesterCell({
  row,
  onAssignTester,
  hasMissingTester,
}: {
  row: PlanningProject
  onAssignTester: (id: string, tester: string) => void
  hasMissingTester: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(row.tester)

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          onAssignTester(row.id, val.trim())
          setEditing(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onAssignTester(row.id, val.trim())
            setEditing(false)
          }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-28 border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none"
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 hover:bg-gray-100 ${
        hasMissingTester ? 'text-red-600' : 'text-gray-700'
      }`}
      title="Click to assign tester"
    >
      {hasMissingTester && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
      {row.tester || <span className="text-red-400 italic">Unassigned</span>}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PlanningTable({ rows, sort, onSort, onAssignTester, today }: Props) {
  function SortIcon({ field }: { field: PlanningSortField }) {
    if (sort.field !== field) return <span className="text-gray-300 ml-1">↕</span>
    return sort.dir === 'asc'
      ? <ArrowUp size={12} className="inline ml-1 text-blue-600" />
      : <ArrowDown size={12} className="inline ml-1 text-blue-600" />
  }

  const thBase =
    'px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap bg-gray-50 border-b border-gray-200'
  const tdBase = 'px-3 py-2 text-xs text-gray-700 border-b border-gray-100 align-middle'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {COLUMNS.map((col, ci) => {
              const sortable = col.field && SORTABLE_COLUMNS.includes(col.field)
              return (
                <th
                  key={ci}
                  className={`${thBase} ${col.sticky ? 'sticky left-0 z-10 bg-gray-50 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.1)]' : ''} ${
                    sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''
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
              <td colSpan={COLUMNS.length} className="py-12 text-center text-sm text-gray-400">
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

            // Row background priority: critical > golive-near > uat-near > missing-tester
            let rowBg = ''
            if (isMissingTester) rowBg = 'bg-red-50'
            if (isUatNear) rowBg = 'bg-yellow-50'
            if (isGoLiveNear) rowBg = 'bg-orange-50'
            // critical-priority uses left border, not bg override

            const leftBorder = isCritical ? 'border-l-4 border-l-red-600' : 'border-l-4 border-l-transparent'

            const testDatePast = isPast(row.testDate, today)
            const uatNearHighlight = isWithin7Days(row.uatDate, today)
            const goLiveNearHighlight = isWithin7Days(row.goLiveDate, today)

            return (
              <tr key={row.id} className={`${rowBg} ${leftBorder} hover:bg-blue-50/40 transition-colors`}>
                {/* # */}
                <td className={`${tdBase} text-gray-400 text-center w-10`}>{idx + 1}</td>

                {/* ID — sticky */}
                <td
                  className={`${tdBase} sticky left-0 z-10 bg-white font-mono text-xs text-blue-700 whitespace-nowrap shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)] ${rowBg}`}
                >
                  {row.id}
                </td>

                {/* Iteration */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.iteration || '—'}</td>

                {/* Project Name */}
                <td className={`${tdBase} max-w-[180px]`}>
                  <span
                    className="block truncate"
                    title={row.projectName}
                  >
                    {row.projectName}
                  </span>
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
                    <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] whitespace-nowrap">
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
                  {row.testingPercent != null ? (
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden min-w-[50px]">
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
                      <span className="text-[11px] text-gray-600 whitespace-nowrap">
                        {row.testingPercent}%
                      </span>
                    </div>
                  ) : '—'}
                </td>

                {/* Tester Flag */}
                <td className={`${tdBase} whitespace-nowrap`}>{row.testerFlag || '—'}</td>

                {/* Test Estimate */}
                <td className={`${tdBase} whitespace-nowrap text-center`}>
                  {isMissingEstimate ? (
                    <span className="flex items-center justify-center gap-1 text-amber-600">
                      <AlertTriangle size={12} />
                      —
                    </span>
                  ) : (
                    row.testEstimateDay != null ? `${row.testEstimateDay}d` : '—'
                  )}
                </td>

                {/* Test Date */}
                <td className={`${tdBase} whitespace-nowrap`}>
                  <span
                    className={`font-semibold ${
                      testDatePast ? 'text-red-600' : 'text-gray-800'
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
