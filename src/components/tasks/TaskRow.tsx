import type { Task, DeadlineFlag } from '../../types'
import { formatDate } from '../../utils/dateUtils'

interface Props {
  task: Task & { deadlineFlag?: DeadlineFlag }
}

const statusColors: Record<string, string> = {
  'Pending':     'bg-gray-100 text-gray-600',
  'In-Progress': 'bg-blue-100 text-blue-700',
  'Done':        'bg-green-100 text-green-700',
  'Cancelled':   'bg-red-50 text-red-400 line-through',
}

const typeColors: Record<string, string> = {
  Planned: 'bg-indigo-50 text-indigo-600',
  Adhoc:   'bg-orange-50 text-orange-600',
}

export default function TaskRow({ task }: Props) {
  return (
    <div className={`px-5 py-3 flex items-start justify-between gap-4 ${task.status === 'Cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 text-sm truncate">{task.name}</p>
          {task.deadlineFlag && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              task.deadlineFlag === 'Overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {task.deadlineFlag === 'Overdue' ? '⏰ Overdue' : '⚡ Due Soon'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColors[task.taskType]}`}>
            {task.taskType}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[task.status]}`}>
            {task.status}
          </span>
          {task.azureWorkItemId && (
            <span className="text-xs text-gray-400">{task.azureWorkItemId}</span>
          )}
          <span className="text-xs text-gray-400">Deadline: {formatDate(task.deadline)}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{task.estimatedHours}h</p>
        <p className="text-xs text-gray-400">{task.source}</p>
      </div>
    </div>
  )
}
