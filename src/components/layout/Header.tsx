import { RefreshCw, CloudDownload } from 'lucide-react'
import PeriodFilter from '../common/PeriodFilter'
import { useApp } from '../../context/AppContext'

const viewTitles: Record<string, string> = {
  dashboard:     'Team Dashboard',
  employees:     'พนักงาน (Quick View)',
  tasks:         'รายการ Tasks',
  'adhoc-report':'Adhoc Report',
  individual:    'รายงานรายบุคคล',
  settings:      'Master Data Settings',
  import:        'Import File',
  planning:      'QA Planning',
}

const hideActions = new Set(['settings', 'import', 'planning'])

export default function Header() {
  const { activeView } = useApp()

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">{viewTitles[activeView]}</h1>

      {!hideActions.has(activeView) && (
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodFilter />

          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} />
            Refresh Import
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <CloudDownload size={14} />
            Sync Azure DevOps
          </button>
        </div>
      )}
    </header>
  )
}
