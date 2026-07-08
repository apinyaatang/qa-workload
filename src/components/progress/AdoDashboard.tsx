import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, AlertCircle, ExternalLink, Info } from 'lucide-react'
import { fetchWorkItemsByTag, groupByStatus, getStatusColor, type ADOWorkItem, type ADOStatusSummary } from '../../lib/adoService'

interface Props {
  adoOrg?: string
  adoProject?: string
  adoTag?: string
}

const ADO_ORG = import.meta.env.VITE_ADO_ORG_URL as string | undefined
const ADO_PAT = import.meta.env.VITE_ADO_PAT as string | undefined

export default function AdoDashboard({ adoOrg, adoProject, adoTag }: Props) {
  const [items, setItems] = useState<ADOWorkItem[]>([])
  const [summary, setSummary] = useState<ADOStatusSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const org     = adoOrg     || ADO_ORG
  const project = adoProject || ''
  const tag     = adoTag     || ''
  const pat     = ADO_PAT

  const isReady = Boolean(org && project && tag && pat)

  async function load() {
    if (!isReady) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchWorkItemsByTag(org!, project, tag, pat!)
      setItems(data)
      setSummary(groupByStatus(data))
    } catch (err: any) {
      setError(err.message ?? 'ไม่สามารถดึงข้อมูลจาก Azure DevOps ได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [org, project, tag])

  if (!pat) {
    return (
      <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-300 text-sm">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">ยังไม่ได้ตั้งค่า Azure DevOps PAT</p>
          <p className="text-xs mt-1">เพิ่ม <code className="bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">VITE_ADO_PAT</code> ใน <code>.env</code> เพื่อดึงข้อมูล Work Items</p>
        </div>
      </div>
    )
  }

  if (!project || !tag) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
        ยังไม่ได้ตั้งค่า ADO Project / Tag สำหรับโปรเจคนี้
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Project: <span className="font-medium text-gray-700 dark:text-slate-200">{project}</span>
          {' · '}Tag: <span className="font-medium text-gray-700 dark:text-slate-200">{tag}</span>
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400 dark:text-slate-500">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">กำลังดึงข้อมูลจาก Azure DevOps...</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">ดึงข้อมูลไม่สำเร็จ</p>
            <p className="text-xs mt-0.5">{error}</p>
            <p className="text-xs mt-1 opacity-70">⚠️ หากเจอ CORS error ต้องใช้ Supabase Edge Function เป็น proxy ใน Production</p>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {summary.map(s => (
              <div key={s.status} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.count}</p>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.status}</span>
              </div>
            ))}
          </div>

          {/* Work items table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                  <th className="text-left px-3 py-2 font-medium w-16">ID</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium w-24">Type</th>
                  <th className="text-left px-3 py-2 font-medium w-28">State</th>
                  <th className="text-left px-3 py-2 font-medium w-36">Assigned To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-gray-400 dark:text-slate-500">
                      <a
                        href={`${org}/_workitems/edit/${item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-0.5"
                      >
                        {item.id} <ExternalLink size={9} />
                      </a>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-slate-200 max-w-[260px]">
                      <span className="line-clamp-2">{item.title}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400">{item.workItemType}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(item.state)}`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-slate-400 truncate max-w-[140px]">{item.assignedTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">
          ไม่พบ Work Items ที่มี Tag "{tag}"
        </div>
      )}
    </div>
  )
}
