import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { getDeadlineFlag, isTaskInPeriod, formatDate } from '../../utils/dateUtils'
import { Filter } from 'lucide-react'

const statusColors: Record<string, string> = {
  'Pending':     'bg-gray-100 text-gray-600',
  'In-Progress': 'bg-blue-100 text-blue-700',
  'Done':        'bg-green-100 text-green-700',
  'Cancelled':   'bg-red-50 text-red-400',
}

type Filter = { status: string; type: string }

export default function TasksView() {
  const { tasks, employees, selectedPeriod } = useApp()
  const [filter, setFilter] = useState<Filter>({ status: 'all', type: 'all' })

  const periodTasks = tasks.filter(t => isTaskInPeriod(t, selectedPeriod))

  const filtered = periodTasks.filter(t => {
    if (filter.status !== 'all' && t.status !== filter.status) return false
    if (filter.type !== 'all' && t.taskType !== filter.type) return false
    return true
  })

  function getEmployeeNames(ids: string[]) {
    return ids.map(id => {
      const e = employees.find(e => e.id === id)
      return e ? `${e.firstName} ${e.lastName}` : id
    }).join(', ')
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <Filter size={16} className="text-gray-400" />
        <select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none"
        >
          <option value="all">ทุก Status</option>
          {['Pending', 'In-Progress', 'Done', 'Cancelled'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filter.type}
          onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none"
        >
          <option value="all">ทุก Type</option>
          <option value="Planned">Planned</option>
          <option value="Adhoc">Adhoc</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} tasks</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                <th className="text-left px-5 py-3 font-medium">Task</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Assignee</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Hours</th>
                <th className="text-left px-4 py-3 font-medium">Deadline</th>
                <th className="text-left px-4 py-3 font-medium">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(task => {
                const flag = getDeadlineFlag(task.deadline, task.status)
                return (
                  <tr key={task.id} className={`hover:bg-gray-50/50 transition-colors ${task.status === 'Cancelled' ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 max-w-xs truncate">{task.name}</p>
                      {task.azureWorkItemId && (
                        <p className="text-xs text-gray-400 mt-0.5">{task.azureWorkItemId}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        task.taskType === 'Planned' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {task.taskType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                      {getEmployeeNames(task.assigneeIds)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[task.status]}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{task.estimatedHours}h</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(task.deadline)}</td>
                    <td className="px-4 py-3">
                      {flag && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          flag === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {flag === 'Overdue' ? '⏰ Overdue' : '⚡ Due Soon'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">ไม่มี Task ที่ตรงกับ Filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
