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
  const { activeView } = useApp()

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-6 py-4 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">{viewTitles[activeView] ?? activeView}</h1>
    </header>
  )
}
