import { useState } from 'react'
import { Database, Users, Calendar, ChevronRight, RotateCcw } from 'lucide-react'
import MasterProject from './MasterProject'
import MasterStaff from './MasterStaff'
import MasterHoliday from './MasterHoliday'
import { useApp } from '../../context/AppContext'

type SettingsTab = 'project' | 'staff' | 'holiday'

const tabs: { key: SettingsTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: 'project', label: 'Master Project',      icon: <Database size={18} />, desc: 'จัดการข้อมูล Project' },
  { key: 'staff',   label: 'Master Staff',         icon: <Users size={18} />,    desc: 'จัดการข้อมูลพนักงาน' },
  { key: 'holiday', label: 'วันหยุดนักขัตฤกษ์',   icon: <Calendar size={18} />, desc: 'กำหนดปฏิทินวันหยุด' },
]

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('project')
  const [confirmReset, setConfirmReset] = useState(false)
  const { resetToDefaults } = useApp()

  function handleReset() {
    resetToDefaults()
    setConfirmReset(false)
  }

  return (
    <div className="flex gap-5 h-full">
      {/* Sidebar Menu */}
      <div className="w-56 shrink-0 space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Master Data</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                  activeTab === t.key
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                <span className={activeTab === t.key ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}>{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium leading-none">{t.label}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{t.desc}</p>
                </div>
                {activeTab === t.key && <ChevronRight size={14} className="text-indigo-400 dark:text-indigo-500 shrink-0" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Reset card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">ข้อมูล Demo</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
            ข้อมูลจะถูกบันทึกในเบราว์เซอร์นี้อัตโนมัติ กด Reset เพื่อกลับเป็นข้อมูล Demo เริ่มต้น
          </p>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw size={12} /> Reset to Demo Data
            </button>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-red-600 font-medium">ยืนยันการ Reset?</p>
              <div className="flex gap-1.5">
                <button onClick={handleReset}
                  className="flex-1 px-2 py-1.5 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600">
                  ยืนยัน
                </button>
                <button onClick={() => setConfirmReset(false)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded text-xs hover:bg-gray-50 dark:hover:bg-slate-700">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === 'project' && <MasterProject />}
        {activeTab === 'staff'   && <MasterStaff />}
        {activeTab === 'holiday' && <MasterHoliday />}
      </div>
    </div>
  )
}
