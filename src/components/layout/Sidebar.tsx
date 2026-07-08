import { Users, BarChart2, Settings, TestTube2, LayoutDashboard, FolderKanban, LogOut } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import type { ViewType } from '../../types'

type NavItem = { view: ViewType; label: string; icon: React.ReactNode; adminOnly?: boolean }
type NavGroup = { groupLabel?: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    items: [
      { view: 'my-projects', label: 'โปรเจคของฉัน',   icon: <FolderKanban size={17} /> },
      { view: 'planning',    label: 'QA Workload',      icon: <TestTube2 size={17} /> },
      { view: 'dashboard',   label: 'Team Dashboard',   icon: <LayoutDashboard size={17} />, adminOnly: true },
      { view: 'employees',   label: 'Monitor and Assign', icon: <Users size={17} />, adminOnly: true },
    ],
  },
  {
    groupLabel: 'จัดการข้อมูล',
    items: [
      { view: 'settings', label: 'Master Data', icon: <Settings size={17} />, adminOnly: true },
    ],
  },
]

export default function Sidebar() {
  const { activeView, setActiveView } = useApp()
  const { role, signOut } = useAuth()
  const isAdmin = role === 'admin'

  return (
    <aside className="w-60 min-h-screen bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">WorkloadIQ</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">v2.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin)
          if (visibleItems.length === 0) return null
          return (
            <div key={gi}>
              {group.groupLabel && (
                <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1">
                  {group.groupLabel}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => (
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
          )
        })}
      </nav>

      {/* Logout + Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-700 space-y-1">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={17} />
          ออกจากระบบ
        </button>
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center pt-1">Employee Workload System</p>
      </div>
    </aside>
  )
}
