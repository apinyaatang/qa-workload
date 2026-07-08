import { useEffect, useMemo, useState } from 'react'
import { FolderKanban, Loader2, AlertCircle, Search } from 'lucide-react'
import { planningDb } from '../../lib/planningDb'
import type { PlanningProject } from '../../types/planning'
import ProjectCard from './ProjectCard'

export default function MyProjectsView() {
  const [projects, setProjects] = useState<PlanningProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const allProjects = await planningDb.getAll()
        setProjects(allProjects)
      } catch (err: any) {
        setError(err.message ?? 'ไม่สามารถโหลดข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return projects
    return projects.filter(p =>
      [p.projectName, p.feature, p.status, p.iteration].join(' ').toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderKanban size={20} className="text-indigo-500" />
            โปรเจคของฉัน
          </h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {loading ? '…' : `${projects.length} โปรเจค`}
          </p>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาโปรเจค..."
            className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin text-indigo-500" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Grid */}
      {!loading && !error && (
        filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-slate-500">
            <FolderKanban size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? 'ไม่พบโปรเจคที่ค้นหา' : 'ยังไม่มีโปรเจคที่ได้รับมอบหมาย'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )
      )}
    </div>
  )
}
