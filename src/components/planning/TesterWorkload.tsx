import { useMemo } from 'react'
import { User, AlertCircle } from 'lucide-react'
import type { PlanningProject } from '../../types/planning'

interface Props {
  projects: PlanningProject[]
  selectedPeriodStart?: string
  selectedPeriodEnd?: string
}

interface TesterGroup {
  name: string
  totalEstimate: number
  projects: PlanningProject[]
}

const MAX_DAYS = 30

const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700',
  High: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700',
  Medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-300',
  Low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700',
  '': 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function workloadBarColor(days: number): string {
  if (days > 20) return 'bg-red-500'
  if (days >= 15) return 'bg-orange-400'
  return 'bg-green-500'
}

function workloadTextColor(days: number): string {
  if (days > 20) return 'text-red-700 dark:text-red-300'
  if (days >= 15) return 'text-orange-600 dark:text-orange-300'
  return 'text-green-700 dark:text-green-300'
}

function workloadBgColor(days: number): string {
  if (days > 20) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  if (days >= 15) return 'bg-orange-50 border-orange-200'
  return 'bg-green-50 dark:bg-green-900/20 border-green-200'
}

export function TesterWorkload({ projects, selectedPeriodStart, selectedPeriodEnd }: Props) {
  const groups = useMemo<TesterGroup[]>(() => {
    // Filter by period if provided
    let filtered = projects
    if (selectedPeriodStart || selectedPeriodEnd) {
      filtered = projects.filter(p => {
        if (!p.testDate) return true
        if (selectedPeriodStart && p.testDate < selectedPeriodStart) return false
        if (selectedPeriodEnd && p.testDate > selectedPeriodEnd) return false
        return true
      })
    }

    const map = new Map<string, PlanningProject[]>()
    for (const p of filtered) {
      const key = p.tester?.trim() || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }

    const result: TesterGroup[] = []
    for (const [name, projs] of map.entries()) {
      const totalEstimate = projs.reduce((sum, p) => sum + (p.testEstimateDay ?? 0), 0)
      const sorted = [...projs].sort((a, b) => {
        if (!a.testDate && !b.testDate) return 0
        if (!a.testDate) return 1
        if (!b.testDate) return -1
        return a.testDate.localeCompare(b.testDate)
      })
      result.push({ name, totalEstimate, projects: sorted })
    }

    // Sort: unassigned last, then by total workload desc
    result.sort((a, b) => {
      if (!a.name && b.name) return 1
      if (a.name && !b.name) return -1
      return b.totalEstimate - a.totalEstimate
    })

    return result
  }, [projects, selectedPeriodStart, selectedPeriodEnd])

  const overloadedCount = groups.filter(g => g.name && g.totalEstimate > 20).length

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 dark:text-slate-500 text-sm">
        No tester data to display.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {overloadedCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>
            <strong>{overloadedCount}</strong> tester{overloadedCount > 1 ? 's are' : ' is'} overloaded
            (more than 20 days estimated workload).
          </span>
        </div>
      )}

      {/* Tester cards */}
      {groups.map(group => {
        const isUnassigned = !group.name
        const pct = Math.min(100, (group.totalEstimate / MAX_DAYS) * 100)

        return (
          <div
            key={group.name || '__unassigned__'}
            className={`rounded-lg border shadow-sm overflow-hidden ${
              isUnassigned ? 'border-gray-200 dark:border-slate-600' : workloadBgColor(group.totalEstimate)
            }`}
          >
            {/* Card header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <User
                    size={16}
                    className={`shrink-0 ${
                      isUnassigned ? 'text-gray-400 dark:text-slate-500' : workloadTextColor(group.totalEstimate)
                    }`}
                  />
                  <span className="font-semibold text-sm text-gray-800 dark:text-slate-100 truncate">
                    {isUnassigned ? 'Unassigned' : group.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                    {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-3 shrink-0">
                  <span
                    className={`text-sm font-bold whitespace-nowrap ${
                      isUnassigned ? 'text-gray-500 dark:text-slate-400' : workloadTextColor(group.totalEstimate)
                    }`}
                  >
                    {group.totalEstimate.toFixed(1)} / {MAX_DAYS} days
                  </span>
                </div>
              </div>

              {/* Workload bar */}
              {!isUnassigned && (
                <div className="mt-2 h-2.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${workloadBarColor(group.totalEstimate)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>

            {/* Project rows */}
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {group.projects.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/50 transition-colors flex-wrap"
                >
                  {/* Priority badge */}
                  {p.priority && (
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap shrink-0 ${
                        PRIORITY_BADGE[p.priority] ?? PRIORITY_BADGE['']
                      }`}
                    >
                      {p.priority}
                    </span>
                  )}

                  {/* Project name */}
                  <span
                    className="text-xs text-gray-800 dark:text-slate-100 font-medium truncate flex-1 min-w-0"
                    title={p.projectName}
                  >
                    {p.projectName}
                  </span>

                  {/* Dates & estimate */}
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-gray-500 dark:text-slate-400">
                    <span title="Test Date">
                      Test: <span className="text-gray-700 dark:text-slate-200">{formatDate(p.testDate)}</span>
                    </span>
                    <span title="UAT Date">
                      UAT: <span className="text-gray-700 dark:text-slate-200">{formatDate(p.uatDate)}</span>
                    </span>
                    {p.testEstimateDay != null && (
                      <span className="text-gray-600 dark:text-slate-300 whitespace-nowrap">
                        {p.testEstimateDay}d
                      </span>
                    )}
                    {p.testingPercent != null && (
                      <div className="flex items-center gap-1">
                        <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.testingPercent >= 100
                                ? 'bg-green-500'
                                : p.testingPercent >= 50
                                ? 'bg-blue-400'
                                : 'bg-orange-400'
                            }`}
                            style={{ width: `${Math.min(100, p.testingPercent)}%` }}
                          />
                        </div>
                        <span>{p.testingPercent}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
