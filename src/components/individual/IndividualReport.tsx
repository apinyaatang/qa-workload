import { useApp } from '../../context/AppContext'
import { calcEmployeeWorkload } from '../../utils/workloadCalculator'
import WorkloadBadge from '../common/WorkloadBadge'
import AdhocRiskBadge from '../common/AdhocRiskBadge'
import WorkloadBar from '../common/WorkloadBar'
import TaskRow from '../tasks/TaskRow'
import { ArrowLeft, User } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function IndividualReport() {
  const {
    employees, tasks, leaveRecords, publicHolidays,
    selectedPeriod, selectedEmployeeId, setSelectedEmployeeId, setActiveView,
  } = useApp()

  const employee = employees.find(e => e.id === selectedEmployeeId) ?? employees[0]
  const workload = calcEmployeeWorkload(employee, tasks, selectedPeriod, leaveRecords, publicHolidays)

  const pieData = [
    { name: 'Planned', value: workload.plannedHours, color: '#6366f1' },
    { name: 'Adhoc', value: workload.adhocHours, color: '#f97316' },
    { name: 'Remaining', value: Math.max(workload.remainingHours, 0), color: '#e2e8f0' },
  ].filter(d => d.value > 0)

  function goBack() {
    setSelectedEmployeeId(null)
    setActiveView('dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Back + Employee Info */}
      <div className="flex items-start gap-4">
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 mt-1">
          <ArrowLeft size={16} /> กลับ
        </button>
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <User size={22} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h2>
              <p className="text-sm text-gray-500">{employee.position} · {employee.department}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {employee.skills.map(s => (
                  <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <WorkloadBadge status={workload.workloadStatus} pct={workload.workloadPct} />
              <AdhocRiskBadge risk={workload.adhocRisk} />
            </div>
          </div>
        </div>
      </div>

      {/* Workload Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Capacity', value: `${workload.capacityHours}h`, sub: `${workload.workingDays} วันทำงาน` },
          { label: 'Planned Hours', value: `${workload.plannedHours}h`, sub: 'งานตามแผน' },
          { label: 'Adhoc Hours', value: `${workload.adhocHours}h`, sub: `Adhoc ${workload.adhocRatioPct}%` },
          { label: 'Remaining', value: `${workload.remainingHours}h`, sub: `${workload.remainingPct}% เหลือ` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Workload Bar Detail */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">สัดส่วนการใช้งาน Capacity</h3>
          <span className="text-lg font-bold text-gray-900">{workload.workloadPct}%</span>
        </div>
        <WorkloadBar pct={workload.workloadPct} />

        <div className="mt-4 flex items-center justify-center">
          <ResponsiveContainer width={220} height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}h`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">รายการ Tasks ({workload.tasks.length})</h3>
        </div>
        {workload.tasks.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">ไม่มี Task ใน Period นี้</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {workload.tasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
