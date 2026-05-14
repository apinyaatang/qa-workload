import { Users, BarChart2, Settings, TestTube2, LayoutDashboard } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { ViewType } from '../../types'

type NavGroup = {
  groupLabel?: string
  items: { view: ViewType; label: string; icon: React.ReactNode }[]
}

const navGroups: NavGroup[] = [
  {
    items: [
      { view: 'dashboard',  label: 'Team Dashboard',      icon: <LayoutDashboard size={17} /> },
      { view: 'planning',   label: 'QA Workload',         icon: <TestTube2 size={17} /> },
      { view: 'employees',  label: 'Monitor and Assign',  icon: <Users size={17} /> },
    ],
  },
  {
    groupLabel: 'จัดการข้อมูล',
    items: [
      { view: 'settings',  label: 'Master Data',  icon: <Settings size={17} /> },
    ],
  },
]

export default function Sidebar() {
  const { activeView, setActiveView } = useApp()

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-none">WorkloadIQ</p>
            <p className="text-xs text-gray-400 mt-0.5">v2.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.groupLabel && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={activeView === item.view ? 'text-indigo-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">Employee Workload System</p>
      </div>
    </aside>
  )
}
