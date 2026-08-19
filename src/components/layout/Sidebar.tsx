import { Users, BarChart2, Settings, LayoutDashboard, FolderKanban, ListPlus, Layers, Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { ViewType } from '../../types'

type NavItem = { view: ViewType; label: string; icon: React.ReactNode }
type NavGroup = { groupLabel?: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    items: [
      { view: 'my-projects', label: 'โปรเจคของฉัน',     icon: <FolderKanban size={17} /> },
      { view: 'extra-tasks', label: 'Extra Task',         icon: <ListPlus size={17} /> },
      { view: 'epics',       label: 'Epic (ADO)',          icon: <Layers size={17} /> },
      { view: 'dashboard',   label: 'Team Dashboard',     icon: <LayoutDashboard size={17} /> },
      { view: 'employees',   label: 'Monitor and Assign', icon: <Users size={17} /> },
    ],
  },
  {
    groupLabel: 'จัดการข้อมูล',
    items: [
      { view: 'settings', label: 'Master Data', icon: <Settings size={17} /> },
    ],
  },
]

export default function Sidebar() {
  const { activeView, setActiveView, isDarkMode, toggleDarkMode } = useApp()

  return (
    <aside className="w-60 min-h-screen bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">WorkloadIQ</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">v2.0</p>
          </div>
        </div>
        <button
          onClick={toggleDarkMode}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.groupLabel && (
              <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">
                {group.groupLabel}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeView === item.view
                      ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className={activeView === item.view ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center">Employee Workload System</p>
      </div>
    </aside>
  )
}
