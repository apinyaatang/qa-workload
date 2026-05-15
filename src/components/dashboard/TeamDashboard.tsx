import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { planningDb } from '../../lib/planningDb'
import type { PlanningProject } from '../../types/planning'
import type { Employee } from '../../types'
import { buildEmployeeMap, resolveEmployee } from '../../utils/staffCsvParser'
import { addWorkingDaysH, getWorkingDaysRange } from '../../utils/workingDayUtils'
import { WORKLOAD_COLORS, type QaWorkloadStatus } from '../../utils/qaWorkloadCalc'
import StatCard from './StatCard'
import { Users, AlertTriangle, TrendingUp, Clock, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'

// ─── Constants ────────────────────────────────────────────────────────────────
const CAPACITY_H = 40   // 1 working week = 40h

// ─── Types ────────────────────────────────────────────────────────────────────
interface EmpQaWorkload {
  employee: Employee
  totalHours: number    // Testing + Feedback UAT hours this week
  testingHours: number
  feedbackHours: number
  remainingHours: number
  workloadPct: number
  status: QaWorkloadStatus
  taskCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyStatus(pct: number, hasNewProject: boolean): QaWorkloadStatus {
  if (pct === 0)           return 'Idle'
  if (pct <= 25)           return 'Underutilized'
  if (pct <= 75)           return 'Normal'
  if (!hasNewProject)      return 'High Load'
  return 'Overloaded'
}

/** Count working days (in a given day-list) where a project phase is active */
function overlapDays(
  phaseStart: string | null,
  phaseEnd: string | null,
  weekDays: string[],
): number {
  if (!phaseStart || !phaseEnd) return 0
  return weekDays.filter(d => d >= phaseStart && d <= phaseEnd).length
}

/** Get current week's working days (Mon–Fri, no holidays) */
function getCurrentWeekDays(holidays: Set<string>): string[] {
  const today = new Date()
  const dow = today.getUTCDay()                          // 0=Sun … 6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow            // days back to Monday
  const mon = new Date(Date.UTC(
    today.getUTCFullYear(), today.getUTCMonth(),
    today.getUTCDate() + diffToMon,
  ))
  const fri = new Date(mon.getTime() + 4 * 86_400_000)
  return getWorkingDaysRange(mon, fri, holidays)
}

function calcEmpWorkload(
  emp: Employee,
  projects: PlanningProject[],
  weekDays: string[],
  holidays: Set<string>,
): EmpQaWorkload {
  let testingDays  = 0
  let feedbackDays = 0
  let hasNewProject = false

  for (const p of projects) {
    // Testing phase: testDate → uatDate
    testingDays += overlapDays(p.testDate, p.uatDate, weekDays)

    // Feedback UAT: uatDate+1workday → goLiveDate
    if (p.uatDate && p.goLiveDate) {
      const fbStart = addWorkingDaysH(new Date(p.uatDate), 1, holidays).toISOString().slice(0, 10)
      feedbackDays += overlapDays(fbStart, p.goLiveDate, weekDays)
    }

    if (p.itemType?.toLowerCase().includes('new')) hasNewProject = true
  }

  const totalHours    = (testingDays + feedbackDays) * 8
  const testingHours  = testingDays  * 8
  const feedbackHours = feedbackDays * 8
  const workloadPct   = Math.round((totalHours / CAPACITY_H) * 100)
  const status        = classifyStatus(workloadPct, hasNewProject)

  return {
    employee: emp,
    totalHours,
    testingHours,
    feedbackHours,
    remainingHours: Math.max(CAPACITY_H - totalHours, 0),
    workloadPct,
    status,
    taskCount: projects.length,
  }
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: QaWorkloadStatus }) {
  const c = WORKLOAD_COLORS[status]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeamDashboard() {
  const { employees, publicHolidays } = useApp()
  const [planningProjects, setPlanningProjects] = useState<PlanningProject[]>([])
  const [loading, setLoading] = useState(true)

  const holidays = useMemo(
    () => new Set(publicHolidays.map(h => h.date)),
    [publicHolidays],
  )

  useEffect(() => {
    planningDb.getAll()
      .then(setPlanningProjects)
      .catch(() => setPlanningProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const weekDays = useMemo(() => getCurrentWeekDays(holidays), [holidays])

  // Build lookup map (active employees only)
  const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees])
  const empMap = useMemo(() => buildEmployeeMap(activeEmployees), [activeEmployees])

  // Map each tester key → employee
  const testerKeys = useMemo(
    () => [...new Set(planningProjects.map(p => p.tester?.trim()).filter(Boolean))],
    [planningProjects],
  )

  // Per-employee workload (only employees that have projects)
  const workloads = useMemo((): EmpQaWorkload[] => {
    if (loading || planningProjects.length === 0) return []

    return activeEmployees.map(emp => {
      // Find all tester keys that resolve to this employee
      const myTesterKeys = testerKeys.filter(tk => resolveEmployee(tk, empMap)?.id === emp.id)
      const myProjects   = planningProjects.filter(p =>
        myTesterKeys.includes(p.tester?.trim() ?? '')
      )
      return calcEmpWorkload(emp, myProjects, weekDays, holidays)
    }).filter(w => w.taskCount > 0)   // hide employees with no QA tasks
  }, [activeEmployees, empMap, planningProjects, weekDays, holidays, loading, testerKeys])

  // Summary numbers
  const avgPct        = workloads.length ? Math.round(workloads.reduce((s, w) => s + w.workloadPct, 0) / workloads.length) : 0
  const totalFeedback = workloads.reduce((s, w) => s + w.feedbackHours, 0)

  // Chart data
  const chartData = workloads.map(w => ({
    name: w.employee.nickname || w.employee.firstName,
    testing:  w.testingHours,
    feedback: w.feedbackHours,
    pct:      w.workloadPct,
    status:   w.status,
  }))

  function barColor(status: QaWorkloadStatus) {
    return WORKLOAD_COLORS[status].heatBg
  }

  const todayStr = new Date().toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            สัปดาห์นี้ ({weekDays[0]?.slice(5).replace('-', '/') ?? '–'} – {weekDays.at(-1)?.slice(5).replace('-', '/') ?? '–'}) · Capacity {CAPACITY_H}h/คน
          </p>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500">{todayStr}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin text-indigo-500" />
          <span className="text-sm">กำลังโหลด QA Planning data…</span>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="QA Active (มีงาน)"
              value={workloads.length}
              sub={`จาก ${activeEmployees.length} คน active`}
              icon={<Users size={20} className="text-indigo-600" />}
              iconBg="bg-indigo-50 dark:bg-indigo-900/40"
            />
            <StatCard
              label="Team Avg Workload"
              value={`${avgPct}%`}
              sub={`Capacity ${CAPACITY_H}h/สัปดาห์`}
              icon={<TrendingUp size={20} className="text-green-600" />}
              iconBg="bg-green-50 dark:bg-green-900/20"
            />
            <StatCard
              label="Overloaded / High Load"
              value={`${workloads.filter(w => w.status === 'Overloaded').length} / ${workloads.filter(w => w.status === 'High Load').length}`}
              sub="คนที่มีงานหนัก"
              icon={<AlertTriangle size={20} className="text-red-500" />}
              iconBg="bg-red-50 dark:bg-red-900/20"
            />
            <StatCard
              label="Feedback UAT Hours"
              value={`${totalFeedback}h`}
              sub="ชั่วโมง Feedback UAT รวม"
              icon={<Clock size={20} className="text-orange-500" />}
              iconBg="bg-orange-50"
            />
          </div>

          {workloads.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-12 text-center text-gray-400 dark:text-slate-500">
              <p className="text-base font-medium mb-1">ไม่พบงาน QA ในสัปดาห์นี้</p>
              <p className="text-sm">Import Iteration Planning CSV และ Master Staff ก่อน แล้วมาดูที่นี่</p>
            </div>
          ) : (
            <>
              {/* Chart */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
                <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100 mb-4">Workload % รายคน (สัปดาห์นี้)</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 130]} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Workload']} />
                    <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" />
                    <ReferenceLine y={75}  stroke="#f97316" strokeDasharray="4 4" />
                    <Bar dataKey="pct" name="Workload %" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={barColor(entry.status)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Stacked hours chart */}
                <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100 mb-3 mt-6">Testing vs Feedback UAT Hours</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <Tooltip formatter={(v, n) => [`${v}h`, n]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="testing"  name="Testing"      fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="feedback" name="Feedback UAT" fill="#f97316" stackId="a" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Member Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700">
                  <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">รายละเอียดรายคน — สัปดาห์นี้</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs">
                        <th className="text-left px-5 py-3 font-medium">พนักงาน</th>
                        <th className="text-left px-4 py-3 font-medium">Group</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Workload %</th>
                        <th className="text-right px-4 py-3 font-medium">Testing</th>
                        <th className="text-right px-4 py-3 font-medium">Feedback</th>
                        <th className="text-right px-4 py-3 font-medium">Total</th>
                        <th className="text-right px-4 py-3 font-medium">Remaining</th>
                        <th className="text-right px-4 py-3 font-medium">Tasks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                      {workloads
                        .slice()
                        .sort((a, b) => b.workloadPct - a.workloadPct)
                        .map(w => {
                          const c = WORKLOAD_COLORS[w.status]
                          return (
                            <tr key={w.employee.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                              <td className="px-5 py-3">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {w.employee.firstName} {w.employee.lastName}
                                  {w.employee.nickname && (
                                    <span className="ml-1 text-xs text-gray-400 dark:text-slate-500">({w.employee.nickname})</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">{w.employee.position}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs">{w.employee.group || w.employee.department || '—'}</td>
                              <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                              <td className="px-4 py-3 w-36">
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-1">
                                  <div
                                    className="h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(w.workloadPct, 100)}%`,
                                      background: c.heatBg === 'transparent' ? '#e5e7eb' : c.heatBg,
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">{w.workloadPct}%</span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-200 font-medium">{w.testingHours}h</td>
                              <td className="px-4 py-3 text-right">
                                <span className={w.feedbackHours > 0 ? 'text-orange-600 font-medium' : 'text-gray-300 dark:text-slate-600'}>
                                  {w.feedbackHours}h
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-slate-100">{w.totalHours}h</td>
                              <td className="px-4 py-3 text-right">
                                <span className={w.remainingHours === 0 ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-slate-300'}>
                                  {w.remainingHours}h
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">{w.taskCount}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
