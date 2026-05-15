import { useMemo, useRef, useEffect, useState } from 'react'
import { Flag, Rocket } from 'lucide-react'
import type { PlanningProject } from '../../types/planning'
import {} from '../../types/planning'
import type { Employee } from '../../types'
import {
  getWorkingDaysRange,
  subtractWorkingDaysH,
  addWorkingDaysH,
} from '../../utils/workingDayUtils'
import {
  calcAllTesterWorkloads,
  WORKLOAD_COLORS,
  type QaWorkloadStatus,
} from '../../utils/qaWorkloadCalc'

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_W   = 28   // px per working-day column
const ROW_H   = 32   // px per task row
const HEAD_H  = 56   // px for date header area (month + day rows)
const LEFT_W  = 300  // px for sticky left panel

// ─── Bar colour definitions ───────────────────────────────────────────────────

const COLORS = {
  testcaseDesign: { bg: '#FCD34D', border: '#F59E0B', label: 'Testcase Design' },
  testing:        { bg: '#F97316', border: '#EA580C', label: 'Testing'         },
  uatMarker:      { bg: '#EA580C', border: '#C2410C', label: 'UAT'             },
  feedbackUat:    { bg: '#EF4444', border: '#DC2626', label: 'Feedback UAT'    },
  goLiveMarker:   { bg: '#DC2626', border: '#B91C1C', label: 'Go Live'         },
  support:        { bg: '#FCA5A5', border: '#F87171', label: 'Support'         },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineBar {
  type: keyof typeof COLORS
  startIso: string
  endIso: string
  isMarker: boolean   // single-day icon marker (flag / rocket)
}

interface GanttRow {
  project: PlanningProject
  bars: TimelineBar[]
}

interface TesterGroup {
  name: string
  totalEstimate: number
  rows: GanttRow[]
}

interface TooltipState {
  visible: boolean
  x: number
  y: number
  project: PlanningProject
  barLabel: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  projects: PlanningProject[]
  holidays: Set<string>
  employees?: Employee[]
  today?: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date { return new Date(iso) }

function buildBars(p: PlanningProject, holidays: Set<string>): TimelineBar[] {
  const bars: TimelineBar[] = []
  const testDate   = p.testDate   ?? null
  const uatDate    = p.uatDate    ?? null
  const goLiveDate = p.goLiveDate ?? null

  // Anchor for Testcase Design (first non-null of testDate / uatDate / goLiveDate)
  const designAnchor = testDate ?? uatDate ?? goLiveDate
  if (designAnchor) {
    const anchorDate = isoToDate(designAnchor)
    const designStart = subtractWorkingDaysH(anchorDate, 2, holidays).toISOString().slice(0, 10)
    bars.push({
      type: 'testcaseDesign',
      startIso: designStart,
      endIso: designAnchor,
      isMarker: false,
    })
  }

  // Testing: testDate → uatDate
  if (testDate && uatDate) {
    bars.push({ type: 'testing', startIso: testDate, endIso: uatDate, isMarker: false })
  }

  // UAT marker
  if (uatDate) {
    bars.push({ type: 'uatMarker', startIso: uatDate, endIso: uatDate, isMarker: true })
  }

  // Feedback UAT: uatDate+1 → goLiveDate
  if (uatDate && goLiveDate) {
    const fbStart = addWorkingDaysH(isoToDate(uatDate), 1, holidays).toISOString().slice(0, 10)
    if (fbStart <= goLiveDate) {
      bars.push({ type: 'feedbackUat', startIso: fbStart, endIso: goLiveDate, isMarker: false })
    }
  }

  // Go Live marker
  if (goLiveDate) {
    bars.push({ type: 'goLiveMarker', startIso: goLiveDate, endIso: goLiveDate, isMarker: true })
  }

  // Support: goLiveDate+1 → goLiveDate+3 workdays
  if (goLiveDate) {
    const supStart = addWorkingDaysH(isoToDate(goLiveDate), 1, holidays).toISOString().slice(0, 10)
    const supEnd   = addWorkingDaysH(isoToDate(goLiveDate), 3, holidays).toISOString().slice(0, 10)
    bars.push({ type: 'support', startIso: supStart, endIso: supEnd, isMarker: false })
  }

  return bars
}

/** Earliest goLiveDate in a list of rows (null → treated as very far future) */
function minGoLiveDate(rows: GanttRow[]): string {
  const dates = rows.map(r => r.project.goLiveDate).filter(Boolean) as string[]
  return dates.length ? dates.sort()[0] : '9999-12-31'
}

function buildGroups(projects: PlanningProject[], holidays: Set<string>): TesterGroup[] {
  const map = new Map<string, GanttRow[]>()

  for (const p of projects) {
    const key = p.tester?.trim() || 'Unassigned'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({ project: p, bars: buildBars(p, holidays) })
  }

  const groups: TesterGroup[] = []
  for (const [name, rows] of map) {
    // Sort projects within each tester by goLiveDate asc (nulls last)
    rows.sort((a, b) => {
      const ag = a.project.goLiveDate ?? '9999-12-31'
      const bg = b.project.goLiveDate ?? '9999-12-31'
      return ag.localeCompare(bg)
    })
    const totalEstimate = rows.reduce((s, r) => s + (r.project.testEstimateDay ?? 0), 0)
    groups.push({ name, totalEstimate, rows })
  }

  // Sort groups: Unassigned last, then by earliest goLiveDate asc
  groups.sort((a, b) => {
    if (a.name === 'Unassigned') return 1
    if (b.name === 'Unassigned') return -1
    return minGoLiveDate(a.rows).localeCompare(minGoLiveDate(b.rows))
  })

  return groups
}

function buildDateRange(
  groups: TesterGroup[],
  holidays: Set<string>,
  today: Date,
): string[] {
  const allDates: string[] = []
  for (const g of groups) {
    for (const r of g.rows) {
      for (const b of r.bars) {
        allDates.push(b.startIso, b.endIso)
      }
    }
  }

  const todayIso = today.toISOString().slice(0, 10)
  allDates.push(todayIso)

  if (allDates.length === 0) {
    // Fallback: show current month
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end   = new Date(today.getFullYear(), today.getMonth() + 2, 0)
    return getWorkingDaysRange(start, end, holidays)
  }

  const sortedDates = [...allDates].sort()
  const minIso = sortedDates[0]
  const maxIso = sortedDates[sortedDates.length - 1]

  // Extend by 5 working days on each side for visual padding
  const rangeStart = subtractWorkingDaysH(isoToDate(minIso), 5, holidays)
  const rangeEnd   = addWorkingDaysH(isoToDate(maxIso), 5, holidays)

  return getWorkingDaysRange(rangeStart, rangeEnd, holidays)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TesterGanttView({ projects, holidays, employees = [], today = new Date() }: Props) {
  const todayIso = today.toISOString().slice(0, 10)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => buildGroups(projects, holidays), [projects, holidays])

  const workingDays = useMemo(
    () => buildDateRange(groups, holidays, today),
    [groups, holidays, today],
  )

  // Workload calculation per tester per day
  const testerWorkloads = useMemo(
    () => calcAllTesterWorkloads(projects, workingDays, employees, holidays),
    [projects, workingDays, employees, holidays],
  )

  const colIndex = useMemo(() => {
    const map = new Map<string, number>()
    workingDays.forEach((d, i) => map.set(d, i))
    return (iso: string) => map.get(iso) ?? -1
  }, [workingDays])

  // Scroll to today on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const idx = colIndex(todayIso)
    if (idx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, idx * COL_W - 200)
    }
  }, [colIndex, todayIso])

  // Build month header spans
  const monthSpans = useMemo(() => {
    const spans: { label: string; count: number }[] = []
    for (const iso of workingDays) {
      const label = new Date(iso).toLocaleString('th-TH', { month: 'short', year: '2-digit' })
      if (spans.length === 0 || spans[spans.length - 1].label !== label) {
        spans.push({ label, count: 1 })
      } else {
        spans[spans.length - 1].count++
      }
    }
    return spans
  }, [workingDays])

  const totalW = workingDays.length * COL_W

  if (projects.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-12 text-center text-gray-400 dark:text-slate-500">
        ไม่มีข้อมูล Project — Import CSV หรือเพิ่มข้อมูลก่อน
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Outer scroll wrapper */}
      <div className="flex overflow-hidden" style={{ minHeight: 200 }}>
        {/* ── Sticky left panel ── */}
        <div
          className="shrink-0 border-r border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 z-20"
          style={{ width: LEFT_W }}
        >
          {/* Header filler matching date headers */}
          <div
            className="border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 flex items-end px-3 pb-1"
            style={{ height: HEAD_H }}
          >
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              Tester / Project
            </span>
          </div>

          {/* Rows */}
          {groups.map(group => (
            <div key={group.name}>
              {/* Group header */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 sticky top-0 z-10">
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-300">
                    {group.name[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 truncate flex-1">{group.name}</p>
                {/* Workload status badge */}
                {(() => {
                  const wl = testerWorkloads.get(group.name)
                  if (!wl) return null
                  const c = WORKLOAD_COLORS[wl.peakStatus]
                  return (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.bg} ${c.text} shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {wl.peakStatus}
                    </span>
                  )
                })()}
                <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">
                  {group.totalEstimate.toFixed(1)}d
                </span>
              </div>

              {/* Task rows */}
              {group.rows.map(({ project: p }) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 border-b border-gray-50 dark:border-slate-700 hover:bg-blue-50/40 dark:hover:bg-slate-700/50 transition-colors"
                  style={{ height: ROW_H }}
                >
                  {/* Priority dot */}
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: priorityColor(p.priority) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800 dark:text-slate-100 truncate leading-tight">
                      {p.projectName}
                    </p>
                    {p.feature && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate leading-tight">{p.feature}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Scrollable timeline ── */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: totalW, minWidth: totalW }}>
            {/* Month header */}
            <div className="flex border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 sticky top-0 z-10" style={{ height: 28 }}>
              {monthSpans.map((span, i) => (
                <div
                  key={i}
                  className="border-r border-gray-200 dark:border-slate-600 flex items-center justify-center text-[10px] font-semibold text-gray-600 dark:text-slate-300 overflow-hidden"
                  style={{ width: span.count * COL_W }}
                >
                  {span.label}
                </div>
              ))}
            </div>

            {/* Day header */}
            <div className="flex border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 sticky top-7 z-10" style={{ height: HEAD_H - 28 }}>
              {workingDays.map(iso => {
                const isToday = iso === todayIso
                const dayNum  = iso.slice(8)
                return (
                  <div
                    key={iso}
                    className={`border-r border-gray-100 dark:border-slate-700 flex items-center justify-center text-[10px] shrink-0 ${
                      isToday ? 'bg-blue-100 dark:bg-blue-900/30 font-bold text-blue-700 dark:text-blue-300' : 'text-gray-400 dark:text-slate-500'
                    }`}
                    style={{ width: COL_W }}
                  >
                    {dayNum}
                  </div>
                )
              })}
            </div>

            {/* Today highlight column (full height) */}
            {colIndex(todayIso) >= 0 && (
              <div
                className="absolute top-0 bottom-0 bg-blue-50/60 dark:bg-blue-900/20 pointer-events-none z-0"
                style={{
                  left: LEFT_W + colIndex(todayIso) * COL_W,
                  width: COL_W,
                }}
              />
            )}

            {/* Rows */}
            {groups.map(group => (
              <div key={group.name}>
                {/* Group header spacer + heatmap row */}
                <div
                  className="border-b border-gray-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 flex items-end"
                  style={{ height: 32 }}
                >
                  {/* Heatmap: 1 cell per working day */}
                  {workingDays.map(day => {
                    const wl = testerWorkloads.get(group.name)
                    const load = wl?.dailyLoads.get(day)
                    const heatBg = load ? WORKLOAD_COLORS[load.status].heatBg : 'transparent'
                    return (
                      <div
                        key={day}
                        title={load ? `${day}: ${load.count} งาน (${load.status})` : day}
                        style={{
                          width: COL_W,
                          height: 8,
                          background: heatBg,
                          opacity: load?.count ? 0.75 : 0.15,
                          borderRight: '1px solid rgba(255,255,255,0.3)',
                        }}
                      />
                    )
                  })}
                </div>

                {/* Task rows */}
                {group.rows.map(({ project: p, bars }) => (
                  <div
                    key={p.id}
                    className="relative border-b border-gray-50 dark:border-slate-700 hover:bg-blue-50/20 dark:hover:bg-slate-700/50"
                    style={{ height: ROW_H }}
                  >
                    {/* Column background stripes for weekdays */}
                    {workingDays.map((iso, ci) => (
                      <div
                        key={iso}
                        className={`absolute top-0 bottom-0 ${iso === todayIso ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                        style={{ left: ci * COL_W, width: COL_W }}
                      />
                    ))}

                    {/* Bars */}
                    {bars.map((bar, bi) => {
                      const si = colIndex(bar.startIso)
                      const ei = colIndex(bar.endIso)
                      if (si < 0 || ei < 0) return null

                      const color = COLORS[bar.type]
                      const left  = si * COL_W
                      // All bars are rectangular; markers span exactly 1 column
                      const width = bar.isMarker
                        ? COL_W
                        : Math.max((ei - si + 1) * COL_W, COL_W)
                      const barH  = 16
                      const top   = (ROW_H - barH) / 2

                      return (
                        <div
                          key={bi}
                          className="absolute cursor-pointer transition-opacity hover:opacity-80 z-10 flex items-center justify-center overflow-hidden"
                          style={{
                            left,
                            top,
                            width,
                            height: barH,
                            background: color.bg,
                            border: `1px solid ${color.border}`,
                            borderRadius: 2,           // rectangular for all bars
                          }}
                          onMouseEnter={e =>
                            setTooltip({
                              visible: true,
                              x: e.clientX,
                              y: e.clientY,
                              project: p,
                              barLabel: color.label,
                            })
                          }
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {/* UAT marker — flag icon */}
                          {bar.type === 'uatMarker' && (
                            <Flag size={10} color="#7C2D12" fill="#EA580C" strokeWidth={1.5} />
                          )}
                          {/* Go Live marker — rocket icon */}
                          {bar.type === 'goLiveMarker' && (
                            <Rocket size={10} color="#7F1D1D" fill="#DC2626" strokeWidth={1.5} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Workload legend ── */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mr-1">Workload:</span>
        {(Object.keys(WORKLOAD_COLORS) as QaWorkloadStatus[]).map(status => {
          const c = WORKLOAD_COLORS[status]
          return (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: c.heatBg, border: '1px solid rgba(0,0,0,0.1)' }} />
              {c.label}
            </span>
          )
        })}
      </div>

      {/* ── Bar Legend ── */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 flex flex-wrap gap-x-4 gap-y-1">
        {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map(key => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
            <span
              className="w-5 h-3.5 rounded-sm inline-flex items-center justify-center"
              style={{ background: COLORS[key].bg, border: `1px solid ${COLORS[key].border}` }}
            >
              {key === 'uatMarker'    && <Flag   size={8}  color="#7C2D12" fill="#EA580C" strokeWidth={1.5} />}
              {key === 'goLiveMarker' && <Rocket size={8}  color="#7F1D1D" fill="#DC2626" strokeWidth={1.5} />}
            </span>
            {COLORS[key].label}
          </span>
        ))}
      </div>

      {/* ── Tooltip ── */}
      {tooltip?.visible && (
        <GanttTooltip tooltip={tooltip} />
      )}
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function GanttTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { project: p, barLabel, x, y } = tooltip
  return (
    <div
      className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 space-y-1 pointer-events-none"
      style={{ left: x + 12, top: y - 10, maxWidth: 260 }}
    >
      <p className="font-semibold text-yellow-300">{barLabel}</p>
      <p className="font-medium truncate">{p.projectName}</p>
      {p.feature && <p className="text-gray-300 truncate">{p.feature}</p>}
      <div className="border-t border-gray-700 pt-1 mt-1 space-y-0.5 text-gray-300">
        <p>Tester: <span className="text-white">{p.tester || '—'}</span></p>
        <p>Test date: <span className="text-white">{fmt(p.testDate)}</span></p>
        <p>UAT Date: <span className="text-white">{fmt(p.uatDate)}</span></p>
        <p>Go Live: <span className="text-white">{fmt(p.goLiveDate)}</span></p>
        <p>Estimate: <span className="text-white">{p.testEstimateDay ?? '—'} day</span></p>
      </div>
    </div>
  )
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return '#EF4444'
    case 'High':     return '#F97316'
    case 'Medium':   return '#EAB308'
    case 'Low':      return '#3B82F6'
    default:         return '#9CA3AF'
  }
}
