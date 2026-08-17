import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { User, Calendar } from 'lucide-react'
import AddLeaveModal from './AddLeaveModal'

export default function EmployeesView() {
  const { employees, leaveRecords } = useApp()
  const [leaveModalEmpId, setLeaveModalEmpId] = useState<string | null>(null)

  const activeEmployees = useMemo(() => employees.filter(e => e.isActive), [employees])

  return (
    <div className="flex flex-col gap-4">
      {leaveModalEmpId && (
        <AddLeaveModal empId={leaveModalEmpId} onClose={() => setLeaveModalEmpId(null)} />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm px-5 py-4">
        <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">Monitor and Assign</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
          Active {activeEmployees.length} คน
        </p>
      </div>

      {/* Employee cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeEmployees.map(emp => {
          const approvedLeaves = leaveRecords.filter(
            l => l.employeeId === emp.id && l.status === 'approved'
          ).length

          return (
            <div
              key={emp.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 hover:shadow-md transition-all"
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
                <button
                  onClick={() => setLeaveModalEmpId(emp.id)}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-600 px-2 py-1 rounded"
                >
                  + ลา
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
