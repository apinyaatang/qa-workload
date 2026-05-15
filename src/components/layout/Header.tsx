import { RefreshCw, CloudDownload, Sun, Moon } from 'lucide-react'
import PeriodFilter from '../common/PeriodFilter'
import { useApp } from '../../context/AppContext'

const viewTitles: Record<string, string> = {
  dashboard:     'Team Dashboard',
  employees:     'Monitor and Assign',
  tasks:         'รายการ Tasks',
  'adhoc-report':'Adhoc Report',
  individual:    'รายงานรายบุคคล',
  settings:      'Master Data Settings',
  import:        'Import File',
  planning:      'QA Workload',
}

const hideActions = new Set(['settings', 'import', 'planning'])

export default function Header() {
  const { activeView, isDarkMode, toggleDarkMode } = useApp()

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{viewTitles[activeView]}</h1>

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
