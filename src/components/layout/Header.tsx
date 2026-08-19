import { Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const viewTitles: Record<string, string> = {
  dashboard:          'Team Dashboard',
  employees:          'Monitor and Assign',
  tasks:              'รายการ Tasks',
  'adhoc-report':     'Adhoc Report',
  individual:         'รายงานรายบุคคล',
  settings:           'Master Data Settings',
  import:             'Import File',
  'my-projects':      'โปรเจคของฉัน',
  'project-progress': 'Project Progress',
}

export default function Header() {
  const { activeView, isDarkMode, toggleDarkMode } = useApp()

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{viewTitles[activeView] ?? activeView}</h1>

      <div className="flex items-center gap-3">
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
