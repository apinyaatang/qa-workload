import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { User, Calendar, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react'
import AddLeaveModal from './AddLeaveModal'
import { planningDb } from '../../lib/planningDb'
import type { PlanningProject } from '../../types/planning'
import type { Employee } from '../../types'
import { calcAllTesterWorkloads, WORKLOAD_COLORS, type QaWorkloadStatus } from '../../utils/qaWorkloadCalc'
import { buildEmployeeMap, resolveEmployee } from '../../utils/staffCsvParser'
import { getWorkingDaysRange, addWorkingDaysH } from '../../utils/workingDayUtils'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_SORT: Record<QaWorkloadStatus, number> = {
  Idle: 0, Underutilized: 1, Normal: 2, 'High Load': 3, Overloaded: 4,
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Get the Monday (UTC) of the week that contains `ref`, offset by `weekOffset` weeks */
function getMondayOfWeek(ref: Date, weekOffset: number): Date {
  const dow = ref.getUTCDay()                     // 0=Sun … 6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow
  return new Date(Date.UTC(
    ref.getUTCFullYear(), ref.getUTCMonth(),
    ref.getUTCDate() + diffToMon + weekOffset * 7,
  ))
}

function fmtDate(iso: string) {
  const [,, d] = iso.split('-')
  return `${parseInt(d)} ${new Date(iso).toLocaleString('th-TH', { month: 'short' })}`
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function QaBadge({ status }: { status: QaWorkloadStatus }) {
  const c = WORKLOAD_COLORS[status]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── Per-employee QA data for the selected period ─────────────────────────────

function getEmployeeQaData(
  emp: Employee,
  projects: PlanningProject[],
  periodDays: string[],   // working days in selected period
  holidays: Set<string>,
) {
  const empMap = buildEmployeeMap([emp])

  // Find tester keys that resolve to this employee
  const allTesterKeys = [...new Set(projects.map(p => p.tester?.trim()).filter(Boolean) as string[])]
  const myTesterKeys  = new Set(allTesterKeys.filter(tk => resolveEmployee(tk, empMap)?.id === emp.id))

  const empProjects = projects.filter(p => myTesterKeys.has(p.tester?.trim() ?? ''))
  if (empProjects.length === 0 || periodDays.length === 0) {
    return { status: 'Idle' as QaWorkloadStatus, activeTasks: [], peakCount: 0, allTasks: [] }
  }

  // Route all projects under a temp tester key so calcAllTesterWorkloads works per-employee
  const tempKey      = `__emp_${emp.id}__`
  const tempProjects = empProjects.map(p => ({ ...p, tester: tempKey }))
  const wlMap        = calcAllTesterWorkloads(tempProjects, periodDays, [emp], holidays)
  const wl           = wlMap.get(tempKey)

  // Tasks active at least one day in the period
  const activeTasks = empProjects.filter(p => {
    for (const day of periodDays) {
      const inTesting = p.testDate && p.uatDate && p.testDate <= day && day <= p.uatDate
      if (inTesting) return true
      if (p.uatDate && p.goLiveDate) {
        const fbStart = addWorkingDaysH(new Date(p.uatDate), 1, holidays).toISOString().slice(0, 10)
        if (fbStart <= day && day <= p.goLiveDate) return true
      }
    }
    return false
  })

  return {
    status:    wl?.peakStatus ?? 'Idle' as QaWorkloadStatus,
    activeTasks,
    peakCount: wl?.peakCount ?? 0,
    allTasks:  empProjects,
  }
}

// ─── Period Selector ──────────────────────────────────────────────────────────

type PeriodMode = 'weekly' | 'custom'

interface PeriodSelectorProps {
  mode: PeriodMode
  weekOffset: number
  customStart: string
  customEnd: string
  periodLabel: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onModeChange: (m: PeriodMode) => void
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
}

function PeriodSelector({
  mode, weekOffset, customStart, customEnd, periodLabel,
  onPrevWeek, onNextWeek, onModeChange, onCustomStart, onCustomEnd,
}: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden text-sm">
        {(['weekly', 'custom'] as PeriodMode[]).map(m => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`px-3 py-1.5 font-medium transition-colors ${
              mode === m ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'
            }`}
          >
            {m === 'weekly' ? 'รายสัปดาห์' : 'Custom'}
          </button>
        ))}
      </div>

      {mode === 'weekly' ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrevWeek}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-lg min-w-[160px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={onNextWeek}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <ChevronRight size={15} />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => onPrevWeek()}   // hack: parent resets offset
              className="text-xs text-indigo-500 hover:underline"
            >
              {/* handled outside */}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            onChange={e => onCustomStart(e.target.value)}
            className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200"
          />
          <span className="text-gray-400 dark:text-slate-500 text-sm">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => onCustomEnd(e.target.value)}
            className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200"
          />
          {customStart && customEnd && (
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-lg">
              {periodLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeesView() {
  const { employees, leaveRecords, publicHolidays, setActiveView, setPlanningInitialTester } = useApp()
  const [leaveModalEmpId, setLeaveModalEmpId] = useState<string | null>(null)
  const [planningProjects, setPlanningProjects] = useState<PlanningProject[]>([])
  const [loadingProjects, setLoadingProjects]   = useState(true)

  // Period state
  const [mode,        setMode]        = useState<PeriodMode>('weekly')
  const [weekOffset,  setWeekOffset]  = useState(0)
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')

  const today = useMemo(() => new Date(), [])
  const holidaySet = useMemo(
    () => new Set(publicHolidays.map(h => h.date)),
    [publicHolidays],
  )

  useEffect(() => {
    planningDb.getAll()
      .then(setPlanningProjects)
      .catch(() => setPlanningProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Compute working days in selected period
  const periodDays = useMemo(() => {
    if (mode === 'custom') {
      if (!customStart || !customEnd || customStart > customEnd) return []
      return getWorkingDaysRange(new Date(customStart), new Date(customEnd), holidaySet)
    }
    // Weekly
    const mon = getMondayOfWeek(today, weekOffset)
    const fri = new Date(mon.getTime() + 4 * 86_400_000)
    return getWorkingDaysRange(mon, fri, holidaySet)
  }, [mode, weekOffset, customStart, customEnd, today, holidaySet])

  // Human-readable period label
  const periodLabel = useMemo(() => {
    if (periodDays.length === 0) return '—'
    const first = periodDays[0]
    const last  = periodDays.at(-1)!
    if (first.slice(0, 7) === last.slice(0, 7)) {
      return `${fmtDate(first)} – ${fmtDate(last)} ${new Date(first).getFullYear()}`
    }
    return `${fmtDate(first)} – ${fmtDate(last)}`
  }, [periodDays])

  const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees])

  // Navigate to QA Workload with this employee pre-filtered
  function handleCardClick(emp: Employee, allTasks: PlanningProject[]) {
    // Use the actual tester string from planning data (exact match for the filter)
    const testerKey = allTasks[0]?.tester?.trim() ?? `${emp.firstName} ${emp.lastName}`.trim()
    setPlanningInitialTester(testerKey)
    setActiveView('planning')
  }

  // Compute workload per employee for selected period, then sort
  const employeeWorkloads = useMemo(() => {
    if (loadingProjects || periodDays.length === 0) return []
    return activeEmployees
      .map(emp => ({
        emp,
        leaves:  leaveRecords.filter(l => l.employeeId === emp.id),
        qa:      getEmployeeQaData(emp, planningProjects, periodDays, holidaySet),
      }))
      .sort((a, b) => {
        const sa = STATUS_SORT[a.qa.status] ?? 0
        const sb = STATUS_SORT[b.qa.status] ?? 0
        return sa - sb   // Idle first → Overloaded last
      })
  }, [activeEmployees, planningProjects, periodDays, holidaySet, leaveRecords, loadingProjects])

  return (
    <div className="space-y-4">
      {leaveModalEmpId && (
        <AddLeaveModal empId={leaveModalEmpId} onClose={() => setLeaveModalEmpId(null)} />
      )}

      {/* Header + Period Selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm px-5 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Monitor and Assign</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              Active {activeEmployees.length} คน · QA Projects {planningProjects.length} รายการ
              {loadingProjects && ' · กำลังโหลด…'}
            </p>
          </div>
          {weekOffset !== 0 && mode === 'weekly' && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-indigo-500 hover:underline"
            >
              ← สัปดาห์นี้
            </button>
          )}
        </div>

        <PeriodSelector
          mode={mode}
          weekOffset={weekOffset}
          customStart={customStart}
          customEnd={customEnd}
          periodLabel={periodLabel}
          onPrevWeek={() => setWeekOffset(w => w - 1)}
          onNextWeek={() => setWeekOffset(w => w + 1)}
          onModeChange={m => { setMode(m); setWeekOffset(0) }}
          onCustomStart={setCustomStart}
          onCustomEnd={setCustomEnd}
        />

        {/* Status legend + counts */}
        {!loadingProjects && periodDays.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50 dark:border-slate-700">
            {(Object.keys(STATUS_SORT) as QaWorkloadStatus[]).map(status => {
              const count = employeeWorkloads.filter(w => w.qa.status === status).length
              const c     = WORKLOAD_COLORS[status]
              return count > 0 ? (
                <span key={status} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {c.label} ({count})
                </span>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Employee cards */}
      {periodDays.length === 0 && mode === 'custom' ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-10 text-center text-gray-400 dark:text-slate-500 text-sm">
          เลือก Custom date range เพื่อดู Workload
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employeeWorkloads.map(({ emp, leaves, qa }) => {
            const approvedLeaves = leaves.filter(l => l.status === 'approved').length

            return (
              <div
                key={emp.id}
                onClick={() => !leaveModalEmpId && handleCardClick(emp, qa.allTasks ?? [])}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center shrink-0">
                    <User size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {emp.firstName} {emp.lastName}
                      {emp.nickname && (
                        <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">({emp.nickname})</span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{emp.position}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {emp.group && (
                        <span className="text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">{emp.group}</span>
                      )}
                    </div>
                  </div>
                  <QaBadge status={qa.status} />
                </div>

                {/* Workload detail */}
                <div className="mt-4 space-y-2">
                  {qa.activeTasks.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                        <span>งานใน period นี้ ({periodDays.length} วัน)</span>
                        <span className={`font-semibold ${
                          qa.peakCount > 3 ? 'text-red-600' :
                          qa.peakCount > 1 ? 'text-orange-600' : 'text-gray-700 dark:text-slate-200'
                        }`}>
                          สูงสุด {qa.peakCount} งาน/วัน
                        </span>
                      </div>

                      {/* Workload bar */}
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width:      `${Math.min((qa.peakCount / 5) * 100, 100)}%`,
                            background: WORKLOAD_COLORS[qa.status].heatBg === 'transparent'
                              ? '#e5e7eb'
                              : WORKLOAD_COLORS[qa.status].heatBg,
                          }}
                        />
                      </div>

                      {/* Active task list */}
                      <div className="space-y-1 mt-2">
                        {qa.activeTasks.slice(0, 3).map(p => (
                          <div key={p.id} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                            <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 bg-orange-400" />
                            <span className="truncate">{p.projectName}</span>
                            {p.uatDate && (
                              <span className="ml-auto shrink-0 text-gray-400 dark:text-slate-500">
                                UAT {p.uatDate.slice(5).replace('-', '/')}
                              </span>
                            )}
                          </div>
                        ))}
                        {qa.activeTasks.length > 3 && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 pl-3">+{qa.activeTasks.length - 3} งาน</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 py-2">
                      <ClipboardList size={14} />
                      {loadingProjects ? 'กำลังโหลด…' : `ไม่มีงาน QA ใน ${periodLabel}`}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                    <Calendar size={12} />
                    <span>ลา {approvedLeaves} วัน</span>
                    {emp.wfhDays && emp.wfhDays.length > 0 && (
                      <span className="ml-2">WFH: {emp.wfhDays.join(', ')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); setLeaveModalEmpId(emp.id) }}
                      className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-600 px-2 py-1 rounded"
                    >
                      + ลา
                    </button>
                    <span className="text-xs text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                      ดู QA Workload →
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
