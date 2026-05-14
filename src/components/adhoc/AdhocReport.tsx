import { useApp } from '../../context/AppContext'
import AdhocRiskBadge from '../common/AdhocRiskBadge'
import { formatDate } from '../../utils/dateUtils'
import { AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AdhocReport() {
  const { teamSummary } = useApp()
  const { memberWorkloads: mw, period, totalAdhocHours, totalPlannedHours } = teamSummary

  const totalHours = totalAdhocHours + totalPlannedHours
  const teamAdhocRatio = totalHours > 0 ? Math.round((totalAdhocHours / totalHours) * 100 * 10) / 10 : 0

  // All adhoc tasks across team
  const allAdhocTasks = mw.flatMap(w =>
    w.tasks
      .filter(t => t.taskType === 'Adhoc' && t.status !== 'Cancelled')
      .map(t => ({ ...t, employee: w.employee }))
  )

  const chartData = mw
    .filter(w => w.adhocHours > 0 || w.plannedHours > 0)
    .map(w => ({
      name: w.employee.firstName,
      adhocRatio: w.adhocRatioPct,
      adhocHours: w.adhocHours,
    }))

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Team Adhoc Hours รวม</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{totalAdhocHours}h</p>
          <p className="text-xs text-gray-400 mt-0.5">จาก {totalHours}h ทั้งหมด</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Team Adhoc Ratio</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{teamAdhocRatio}%</p>
          <div className="mt-2">
            {teamAdhocRatio > 40
              ? <span className="text-xs text-red-600 font-medium">🔴 สูงเกินไป — ควรวิเคราะห์ต้นเหตุ</span>
              : teamAdhocRatio >= 20
              ? <span className="text-xs text-orange-600 font-medium">🟠 ระดับกลาง</span>
              : <span className="text-xs text-green-600 font-medium">🟢 อยู่ในระดับปกติ</span>}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">จำนวน Adhoc Tasks</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{allAdhocTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">รายการนอกแผนใน {period.label}</p>
        </div>
      </div>

      {/* Adhoc Ratio by Person */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Adhoc Ratio % รายคน</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v) => [`${v}%`, 'Adhoc Ratio']} />
            <Bar dataKey="adhocRatio" name="Adhoc Ratio %" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per Employee Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">สรุป Adhoc รายคน</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-5 py-3 font-medium">พนักงาน</th>
                <th className="text-right px-4 py-3 font-medium">Adhoc Hours</th>
                <th className="text-right px-4 py-3 font-medium">Total Hours</th>
                <th className="text-right px-4 py-3 font-medium">Adhoc Ratio</th>
                <th className="text-left px-4 py-3 font-medium">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mw.map(w => (
                <tr key={w.employee.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{w.employee.firstName} {w.employee.lastName}</p>
                    <p className="text-xs text-gray-400">{w.employee.department}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={w.adhocHours > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>
                      {w.adhocHours}h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{w.totalHours}h</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{w.adhocRatioPct}%</td>
                  <td className="px-4 py-3">
                    <AdhocRiskBadge risk={w.adhocRisk} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adhoc Task List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" />
          <h2 className="text-base font-semibold text-gray-800">รายการ Adhoc Tasks ทั้งหมด ({allAdhocTasks.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-5 py-3 font-medium">Task</th>
                <th className="text-left px-4 py-3 font-medium">Assignee</th>
                <th className="text-left px-4 py-3 font-medium">Source ID</th>
                <th className="text-right px-4 py-3 font-medium">Est. Hours</th>
                <th className="text-left px-4 py-3 font-medium">Deadline</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allAdhocTasks.map(task => (
                <tr key={task.id + task.employee.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{task.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {task.employee.firstName} {task.employee.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {task.azureWorkItemId && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{task.azureWorkItemId}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">{task.estimatedHours}h</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(task.deadline)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      task.status === 'Done' ? 'bg-green-100 text-green-700' :
                      task.status === 'In-Progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{task.status}</span>
                  </td>
                </tr>
              ))}
              {allAdhocTasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">ไม่มี Adhoc Tasks ใน Period นี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
