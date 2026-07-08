import { Calendar, Rocket, TrendingUp, ChevronRight } from 'lucide-react'
import type { PlanningProject } from '../../types/planning'
import { useApp } from '../../context/AppContext'

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 71)  return 'bg-blue-500'
  if (pct >= 31)  return 'bg-amber-500'
  return 'bg-red-500'
}

function getProgressTextColor(pct: number): string {
  if (pct >= 100) return 'text-green-600 dark:text-green-400'
  if (pct >= 71)  return 'text-blue-600 dark:text-blue-400'
  if (pct >= 31)  return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  High:     'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Medium:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Low:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
}

interface Props {
  project: PlanningProject
}

export default function ProjectCard({ project }: Props) {
  const { setActiveView, setSelectedProjectId } = useApp()
  const pct = project.testingPercent ?? 0

  function handleUpdate() {
    setSelectedProjectId(project.id)
    setActiveView('project-progress')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 dark:text-slate-500 font-medium mb-0.5">{project.iteration}</p>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2" title={project.projectName}>
            {project.projectName}
          </h3>
          {project.feature && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{project.feature}</p>
          )}
        </div>
        {project.priority && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[project.priority] ?? 'bg-gray-100 text-gray-500'}`}>
            {project.priority}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp size={12} />
            Testing Progress
          </span>
          <span className={`text-xs font-bold ${getProgressTextColor(pct)}`}>{pct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${getProgressColor(pct)}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Calendar size={11} />
          UAT: <span className="font-medium text-gray-700 dark:text-slate-200">{formatDate(project.uatDate)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Rocket size={11} />
          GoLive: <span className="font-medium text-gray-700 dark:text-slate-200">{formatDate(project.goLiveDate)}</span>
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
          {project.status || 'No status'}
        </span>

        <button
          onClick={handleUpdate}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
        >
          อัพเดท Progress
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
