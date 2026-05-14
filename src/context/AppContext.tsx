import React, { createContext, useContext, useState, useMemo, useEffect } from 'react'
import type {
  AppState, Employee, Task, LeaveRecord, PublicHoliday,
  Period, ViewType, Project, ImportSession,
} from '../types'
import { mockEmployees, mockTasks, mockLeaveRecords, mockPublicHolidays, mockProjects } from '../data/mockData'
import { getPeriod } from '../utils/dateUtils'
import { calcTeamSummary } from '../utils/workloadCalculator'
import type { TeamSummary } from '../types'
import { useLocalStorage } from '../utils/useLocalStorage'
import { isConfigured, supabase } from '../lib/supabase'
import { employeeDb, projectDb, leaveDb, holidayDb, importDb } from '../lib/db'

interface AppContextType extends AppState {
  projects: Project[]
  importSessions: ImportSession[]
  teamSummary: TeamSummary
  isLoading: boolean
  dbError: string | null
  isOnline: boolean              // true = Supabase, false = localStorage fallback
  setSelectedPeriod: (p: Period) => void
  setActiveView: (v: ViewType) => void
  setSelectedEmployeeId: (id: string | null) => void
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  refreshImport: (newTasks: Task[]) => void
  addEmployee: (emp: Employee) => void
  updateEmployee: (emp: Employee) => void
  deleteEmployee: (id: string) => void
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  deleteProject: (id: string) => void
  addLeaveRecord: (record: LeaveRecord) => void
  updateLeaveStatus: (id: string, status: 'approved' | 'rejected') => void
  addPublicHoliday: (holiday: PublicHoliday) => void
  removePublicHoliday: (id: string) => void
  addImportSession: (session: ImportSession) => void
  applyImportSession: (sessionId: string) => void
  deleteImportSession: (id: string) => void
  resetToDefaults: () => void
  // Cross-page navigation signal: set before navigating to 'planning'
  planningInitialTester: string | null
  setPlanningInitialTester: (t: string | null) => void
}

const AppContext = createContext<AppContextType | null>(null)
const defaultPeriod = getPeriod('monthly', new Date('2026-05-07'))

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Local state (always in memory) ────────────────────────────────────────
  const [employees,      setEmployees]      = useLocalStorage<Employee[]>('wiq:employees', mockEmployees)
  const [tasks,          setTasks]          = useLocalStorage<Task[]>('wiq:tasks', mockTasks)
  const [leaveRecords,   setLeaveRecords]   = useLocalStorage<LeaveRecord[]>('wiq:leaves', mockLeaveRecords)
  const [publicHolidays, setPublicHolidays] = useLocalStorage<PublicHoliday[]>('wiq:holidays', mockPublicHolidays)
  const [projects,       setProjects]       = useLocalStorage<Project[]>('wiq:projects', mockProjects)
  const [importSessions, setImportSessions] = useLocalStorage<ImportSession[]>('wiq:imports', [])

  // ── UI-only state ──────────────────────────────────────────────────────────
  const [selectedPeriod,     setSelectedPeriod]     = useState<Period>(defaultPeriod)
  const [activeView,         setActiveView]         = useState<ViewType>('dashboard')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [isLoading,               setIsLoading]               = useState(isConfigured)
  const [dbError,                 setDbError]                 = useState<string | null>(null)
  const [isOnline,                setIsOnline]                = useState(isConfigured)
  const [planningInitialTester,   setPlanningInitialTester]   = useState<string | null>(null)

  // ── Load from Supabase on mount (when configured) ─────────────────────────
  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setDbError(null)
      try {
        const [emps, projs, leaves, holidays, imports] = await Promise.all([
          employeeDb.getAll(),
          projectDb.getAll(),
          leaveDb.getAll(),
          holidayDb.getAll(),
          importDb.getAll(),
        ])
        if (cancelled) return
        setEmployees(emps)
        setProjects(projs)
        setLeaveRecords(leaves)
        setPublicHolidays(holidays)
        setImportSessions(imports)
        setIsOnline(true)
      } catch (err: any) {
        if (cancelled) return
        console.error('[AppContext] Supabase load failed:', err)
        setDbError(err.message ?? 'ไม่สามารถเชื่อมต่อ Supabase ได้ — ใช้ข้อมูลในเครื่องแทน')
        setIsOnline(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!isConfigured || !isOnline) return

    const channel = supabase.channel('workload-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, async () => {
        setEmployees(await employeeDb.getAll())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_records' }, async () => {
        setLeaveRecords(await leaveDb.getAll())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, async () => {
        setProjects(await projectDb.getAll())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_holidays' }, async () => {
        setPublicHolidays(await holidayDb.getAll())
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOnline])

  // ── helper: wrap DB call with local state optimistic update ───────────────
  function withDB(
    localUpdate: () => void,
    dbCall: () => Promise<void>,
  ): void {
    localUpdate()
    if (isOnline) {
      dbCall().catch(err => {
        console.error('[db]', err)
        setDbError(err.message)
      })
    }
  }

  // ── Tasks (localStorage only — no Supabase table) ─────────────────────────
  function addTask(task: Task) {
    setTasks(prev => [...prev, task])
  }

  function updateTask(task: Task) {
    setTasks(prev => prev.map(t => t.id === task.id ? task : t))
  }

  function refreshImport(newPlannedTasks: Task[]) {
    setTasks(prev => {
      const adhoc = prev.filter(t => t.taskType !== 'Planned')
      const ids   = new Set(newPlannedTasks.map(t => t.id))
      const flagged = adhoc.map(t =>
        t.source === 'Azure DevOps' && !ids.has(t.id) ? { ...t, taskType: 'Adhoc' as const } : t
      )
      return [...newPlannedTasks, ...flagged]
    })
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  function addEmployee(emp: Employee) {
    withDB(
      () => setEmployees(prev => [...prev, emp]),
      () => employeeDb.upsert(emp),
    )
  }

  function updateEmployee(emp: Employee) {
    withDB(
      () => setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e)),
      () => employeeDb.upsert(emp),
    )
  }

  function deleteEmployee(id: string) {
    withDB(
      () => setEmployees(prev => prev.filter(e => e.id !== id)),
      () => employeeDb.delete(id),
    )
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  function addProject(project: Project) {
    withDB(
      () => setProjects(prev => [...prev, project]),
      () => projectDb.upsert(project),
    )
  }

  function updateProject(project: Project) {
    withDB(
      () => setProjects(prev => prev.map(p => p.id === project.id ? project : p)),
      () => projectDb.upsert(project),
    )
  }

  function deleteProject(id: string) {
    withDB(
      () => setProjects(prev => prev.filter(p => p.id !== id)),
      () => projectDb.delete(id),
    )
  }

  // ── Leave ─────────────────────────────────────────────────────────────────
  function addLeaveRecord(record: LeaveRecord) {
    withDB(
      () => setLeaveRecords(prev => [...prev, record]),
      () => leaveDb.insert(record),
    )
  }

  function updateLeaveStatus(id: string, status: 'approved' | 'rejected') {
    withDB(
      () => setLeaveRecords(prev => prev.map(l => l.id === id ? { ...l, status } : l)),
      () => leaveDb.updateStatus(id, status),
    )
  }

  // ── Holidays ──────────────────────────────────────────────────────────────
  function addPublicHoliday(holiday: PublicHoliday) {
    withDB(
      () => setPublicHolidays(prev => [...prev, holiday]),
      () => holidayDb.insert(holiday),
    )
  }

  function removePublicHoliday(id: string) {
    withDB(
      () => setPublicHolidays(prev => prev.filter(h => h.id !== id)),
      () => holidayDb.delete(id),
    )
  }

  // ── Import Sessions ───────────────────────────────────────────────────────
  function addImportSession(session: ImportSession) {
    withDB(
      () => setImportSessions(prev => [session, ...prev]),
      () => importDb.insert(session),
    )
  }

  function applyImportSession(sessionId: string) {
    const session = importSessions.find(s => s.id === sessionId)
    if (!session) return
    const newTasks: Task[] = session.rows
      .filter(r => !r.error && r.taskId && r.taskName && r.estimatedHours != null && r.deadline && r.periodStart && r.periodEnd)
      .map(r => ({
        id: r.taskId!, name: r.taskName!,
        assigneeIds: r.assigneeId ? [r.assigneeId] : [],
        estimatedHours: r.estimatedHours!, deadline: r.deadline!,
        taskType: 'Planned' as const, source: 'Excel/GSheet' as const,
        status: (r.status ?? 'Pending') as any,
        periodStart: r.periodStart!, periodEnd: r.periodEnd!,
      }))
    refreshImport(newTasks)
    withDB(
      () => setImportSessions(prev => prev.map(s => s.id === sessionId ? { ...s, appliedToTasks: true } : s)),
      () => importDb.markApplied(sessionId),
    )
  }

  function deleteImportSession(id: string) {
    withDB(
      () => setImportSessions(prev => prev.filter(s => s.id !== id)),
      () => importDb.delete(id),
    )
  }

  // ── Reset to demo defaults ─────────────────────────────────────────────────
  function resetToDefaults() {
    setEmployees(mockEmployees)
    setTasks(mockTasks)
    setLeaveRecords(mockLeaveRecords)
    setPublicHolidays(mockPublicHolidays)
    setProjects(mockProjects)
    setImportSessions([])
  }

  const teamSummary = useMemo(
    () => calcTeamSummary(employees, tasks, selectedPeriod, leaveRecords, publicHolidays),
    [employees, tasks, selectedPeriod, leaveRecords, publicHolidays]
  )

  return (
    <AppContext.Provider value={{
      employees, tasks, leaveRecords, publicHolidays,
      projects, importSessions,
      selectedPeriod, activeView, selectedEmployeeId,
      teamSummary, isLoading, dbError, isOnline,
      setSelectedPeriod, setActiveView, setSelectedEmployeeId,
      addTask, updateTask, refreshImport,
      addEmployee, updateEmployee, deleteEmployee,
      addProject, updateProject, deleteProject,
      addLeaveRecord, updateLeaveStatus,
      addPublicHoliday, removePublicHoliday,
      addImportSession, applyImportSession, deleteImportSession,
      resetToDefaults,
      planningInitialTester, setPlanningInitialTester,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
