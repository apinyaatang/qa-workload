import { useEffect, useState } from 'react'
import { ArrowLeft, BarChart2, PencilLine, Loader2, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { planningDb } from '../../lib/planningDb'
import type { PlanningProject } from '../../types/planning'
import type { ADOStatusSummary } from '../../lib/adoService'
import AdoDashboard from './AdoDashboard'
import UpdateProgressForm from './UpdateProgressForm'

interface Props {
  projectId: string
}

type Tab = 'ado' | 'progress'

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  High:     'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Medium:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  Low:      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ProjectProgressView({ projectId }: Props) {
  const { setActiveView } = useApp()
  const [project, setProject] = useState<PlanningProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('ado')
  const [adoSummary] = useState<ADOStatusSummary[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const all = await planningDb.getAll()
        const found = all.find(p => p.id === projectId)
        if (!found) throw new Error(`ไม่พบโปรเจค ID: ${projectId}`)
        setProject(found)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-slate-500">
      <Loader2 size={22} className="animate-spin text-indigo-500" />
      <span className="text-sm">กำลังโหลด...</span>
    </div>
  )

  if (error || !project) return (
    <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      {error ?? 'ไม่พบโปรเจค'}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => setActiveView('my-projects')}
          className="mt-1 p-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
              {project.iteration}
            </span>
            {project.priority && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[project.priority] ?? ''}`}>
                {project.priority}
              </span>
            )}
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{project.projectName}</h1>
          {project.feature && <p className="text-sm text-gray-500 dark:text-slate-400">{project.feature}</p>}
          <div className="flex gap-4 mt-1 text-xs text-gray-500 dark:text-slate-400">
            <span>UAT: <strong className="text-gray-700 dark:text-slate-200">{formatDate(project.uatDate)}</strong></span>
            <span>Go Live: <strong className="text-gray-700 dark:text-slate-200">{formatDate(project.goLiveDate)}</strong></span>
            <span>Tester: <strong className="text-gray-700 dark:text-slate-200">{project.tester || '—'}</strong></span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
        <TabButton active={tab === 'ado'}      onClick={() => setTab('ado')}      icon={<BarChart2 size={14} />}   label="ADO Dashboard" />
        <TabButton active={tab === 'progress'} onClick={() => setTab('progress')} icon={<PencilLine size={14} />} label="Update Progress" />
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-5">
        {tab === 'ado' && (
          <AdoDashboard
            adoProject={project.projectName}
            adoTag={project.tags}
          />
        )}
        {tab === 'progress' && (
          <UpdateProgressForm project={project} adoSummary={adoSummary} />
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-900/20'
          : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100/60 dark:hover:bg-slate-700/50'
      }`}
    >
      {icon}{label}
    </button>
  )
}
