import { RefreshCw, CloudDownload, Sun, Moon, User } from 'lucide-react'
import PeriodFilter from '../common/PeriodFilter'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'

const viewTitles: Record<string, string> = {
  dashboard:          'Team Dashboard',
  employees:          'Monitor and Assign',
  tasks:              'รายการ Tasks',
  'adhoc-report':     'Adhoc Report',
  individual:         'รายงานรายบุคคล',
  settings:           'Master Data Settings',
  import:             'Import File',
  planning:           'QA Workload',
  'my-projects':      'โปรเจคของฉัน',
  'project-progress': 'Project Progress',
}

const hideActions = new Set(['settings', 'import', 'planning', 'my-projects', 'project-progress'])

export default function Header() {
  const { activeView, isDarkMode, toggleDarkMode } = useApp()
  const { user, role } = useAuth()

  const displayName = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'User'

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{viewTitles[activeView] ?? activeView}</h1>

      <div className="flex items-center gap-3 flex-wrap">
        {!hideActions.has(activeView) && (
          <>
            <PeriodFilter />

            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <RefreshCw size={14} />
              Refresh Import
            </button>

            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <CloudDownload size={14} />
              Sync Azure DevOps
            </button>
          </>
        )}

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600">
            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
              <User size={12} className="text-white" />
            </div>
            <div className="leading-none">
              <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{displayName}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{role}</p>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  )
}
