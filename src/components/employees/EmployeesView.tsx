import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { User, Calendar, ClipboardList, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import AddLeaveModal from './AddLeaveModal'
import { epicDb } from '../../lib/epicDb'
import { epicToProject, isActiveEpic } from '../../utils/epicMapping'
import type { PlanningProject } from '../../types/planning'
import type { Employee } from '../../types'
import { calcAllTesterWorkloads, WORKLOAD_COLORS, type QaWorkloadStatus } from '../../utils/qaWorkloadCalc'
import { buildEmployeeMap, resolveEmployee } from '../../utils/staffCsvParser'
import { getWorkingDaysRange, addWorkingDaysH } from '../../utils/workingDayUtils'
import { localIsoDate, utcDateFromIso } from '../../utils/epicDateTone'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_SORT: Record<QaWorkloadStatus, number> = {
  Idle: 0, Underutilized: 1, Normal: 2, 'High Load': 3, Overloaded: 4,
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** จันทร์ (UTC) ของสัปดาห์ที่มี `ref` อยู่ เลื่อนไป `weekOffset` สัปดาห์ */
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

// ─── ข้อมูล QA รายคนในช่วงที่เลือก ────────────────────────────────────────────

function getEmployeeQaData(
  emp: Employee,
  allEmployees: Employee[],
  projects: PlanningProject[],
  periodDays: string[],   // วันทำการในช่วงที่เลือก
  holidays: Set<string>,
) {
  // ใช้ map ของพนักงานทั้งชุด เพื่อให้ชื่อเล่นที่ซ้ำกันไม่แย่งงานกันเอง
  const empMap = buildEmployeeMap(allEmployees)

  // หา tester key ทุกตัวที่ resolve มาเป็นพนักงานคนนี้
  const allTesterKeys = [...new Set(projects.map(p => p.tester?.trim()).filter(Boolean) as string[])]
  const myTesterKeys  = new Set(allTesterKeys.filter(tk => resolveEmployee(tk, empMap)?.id === emp.id))

  const empProjects = projects.filter(p => myTesterKeys.has(p.tester?.trim() ?? ''))
  if (empProjects.length === 0 || periodDays.length === 0) {
    return { status: 'Idle' as QaWorkloadStatus, activeTasks: [], peakCount: 0, allTasks: [] }
  }

  // ยัดทุกงานไว้ใต้ key ชั่วคราวเดียว เพื่อให้ calcAllTesterWorkloads คิดรายคนได้
  const tempKey      = `__emp_${emp.id}__`
  const tempProjects = empProjects.map(p => ({ ...p, tester: tempKey }))
  const wlMap        = calcAllTesterWorkloads(tempProjects, periodDays, [emp], holidays)
  const wl           = wlMap.get(tempKey)

  // งานที่ active อย่างน้อย 1 วันในช่วงนี้
  const activeTasks = empProjects.filter(p => {
    for (const day of periodDays) {
      const inTesting = p.testDate && p.uatDate && p.testDate <= day && day <= p.uatDate
      if (inTesting) return true
      if (p.uatDate && p.goLiveDate) {
        // uatDate เป็น string YYYY-MM-DD ต้องแปลงเป็นเที่ยงคืน UTC ก่อน
        // เพราะ workingDayUtils คำนวณด้วย UTC ทั้งหมด
        const fbStart = addWorkingDaysH(utcDateFromIso(p.uatDate), 1, holidays).toISOString().slice(0, 10)
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
  mode, customStart, customEnd, periodLabel,
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
  const { employees, leaveRecords, publicHolidays, setActiveView, setEpicInitialTester } = useApp()
  const [leaveModalEmpId, setLeaveModalEmpId] = useState<string | null>(null)

  // ข้อมูลมาจากตาราง epics — เดิมหน้านี้ดึงจาก planning_projects
  // ตรรกะคำนวณ workload ยังเป็นชุดเดิมทั้งหมด เพราะ epicToProject()
  // แปลง Epic ให้อยู่ในรูป PlanningProject ก่อนส่งเข้า calcAllTesterWorkloads
  const [projects, setProjects] = useState<PlanningProject[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

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
    let cancelled = false
    epicDb.getAll()
      .then(epics => {
        if (cancelled) return
        // นับเฉพาะงานที่ยังเดินอยู่ ชุดเดียวกับแท็บ Epic Table และ Gantt View
        // (ตัด Deployed / Go-live Commercial / On hold / Retired ออก)
        setProjects(epics.filter(isActiveEpic).map(epicToProject))
      })
      .catch(() => { if (!cancelled) setError('โหลดข้อมูล Epic ไม่สำเร็จ') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // วันทำการในช่วงที่เลือก
  const periodDays = useMemo(() => {
    if (mode === 'custom') {
      if (!customStart || !customEnd || customStart > customEnd) return []
      return getWorkingDaysRange(utcDateFromIso(customStart), utcDateFromIso(customEnd), holidaySet)
    }
    // รายสัปดาห์ — จันทร์ถึงศุกร์
    // แปลงวันนี้เป็นวันตามเวลาเครื่องก่อน ไม่งั้นที่ไทยช่วงเที่ยงคืนถึง 07:00
    // จะคำนวณสัปดาห์จากวันของเมื่อวาน
    const mon = getMondayOfWeek(utcDateFromIso(localIsoDate(today)), weekOffset)
    const fri = new Date(mon.getTime() + 4 * 86_400_000)
    return getWorkingDaysRange(mon, fri, holidaySet)
  }, [mode, weekOffset, customStart, customEnd, today, holidaySet])

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

  // เปิดหน้า Epic (ADO) พร้อมกรอง Test Owner เป็นคนนี้ไว้ให้แล้ว
  function handleCardClick(emp: Employee) {
    // สร้าง map จากพนักงานทั้งชุด เพื่อให้ resolveEmployee แยกชื่อเล่นซ้ำได้ถูกคน
    const fullEmpMap = buildEmployeeMap(activeEmployees)
    const match = projects.find(
      p => resolveEmployee(p.tester?.trim() ?? '', fullEmpMap)?.id === emp.id
    )
    const testerKey = match?.tester?.trim()
      ?? `${emp.firstName} ${emp.lastName}${emp.nickname ? ` (${emp.nickname})` : ''}`.trim()
    setEpicInitialTester(testerKey)
    setActiveView('epics')
  }

  const employeeWorkloads = useMemo(() => {
    if (loading || periodDays.length === 0) return []
    return activeEmployees
      .map(emp => ({
        emp,
        leaves: leaveRecords.filter(l => l.employeeId === emp.id),
        qa:     getEmployeeQaData(emp, activeEmployees, projects, periodDays, holidaySet),
      }))
      .sort((a, b) => {
        const sa = STATUS_SORT[a.qa.status] ?? 0
        const sb = STATUS_SORT[b.qa.status] ?? 0
        return sa - sb   // Idle ก่อน → Overloaded ท้ายสุด
      })
  }, [activeEmployees, projects, periodDays, holidaySet, leaveRecords, loading])

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
              Active {activeEmployees.length} คน · Epic ที่ยังเดินอยู่ {projects.length} รายการ
              {loading && ' · กำลังโหลด…'}
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
        {!loading && periodDays.length > 0 && (
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

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

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
                onClick={() => !leaveModalEmpId && handleCardClick(emp)}
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
                      {loading ? 'กำลังโหลด…' : `ไม่มีงาน QA ใน ${periodLabel}`}
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
                      ดู Epic ของคนนี้ →
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
