import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import DbStatusBar from './components/layout/DbStatusBar'
import TeamDashboard from './components/dashboard/TeamDashboard'
import EmployeesView from './components/employees/EmployeesView'
import TasksView from './components/tasks/TasksView'
import AdhocReport from './components/adhoc/AdhocReport'
import IndividualReport from './components/individual/IndividualReport'
import SettingsView from './components/settings/SettingsView'
import ImportView from './components/import/ImportView'
import PlanningView from './components/planning/PlanningView'
import { Loader2 } from 'lucide-react'
import './index.css'

function AppContent() {
  const { activeView, isLoading, isDarkMode } = useApp()

  function renderView() {
    switch (activeView) {
      case 'dashboard':    return <TeamDashboard />
      case 'employees':    return <EmployeesView />
      case 'tasks':        return <TasksView />
      case 'adhoc-report': return <AdhocReport />
      case 'individual':   return <IndividualReport />
      case 'settings':     return <SettingsView />
      case 'import':       return <ImportView />
      case 'planning':     return <PlanningView />
      default:             return <TeamDashboard />
    }
  }

  return (
    <div className={`flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950${isDarkMode ? ' dark' : ''}`}>
      <DbStatusBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 overflow-auto relative">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 dark:bg-slate-950/80 z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="animate-spin text-indigo-600" />
                  <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">กำลังโหลดข้อมูลจาก Supabase...</p>
                </div>
              </div>
            ) : renderView()}
          </main>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
